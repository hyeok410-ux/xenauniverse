const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const PAID_PRODUCTS = Object.freeze({
  // 오버라이드 그리드용 프리미엄 재화 (Anomaly Shards) — 기존
  AS_120: { name: "Anomaly Shards 120", shards: 120, amountKrw: 1500 },
  AS_650: { name: "Anomaly Shards 700", shards: 700, amountKrw: 7500 },
  AS_1400: { name: "Anomaly Shards 1,600", shards: 1600, amountKrw: 15000 },
  // 미니게임 통합 재화 (XC = wallets/{uid}.credits) — 새로 추가
  // 큰 팩일수록 보너스 XC 비율 증가: 표준 1XC=1.5원 → 최상위 팩 1XC≈1원
  XC_1000: { name: "XC 1,000", credits: 1000, amountKrw: 1500 },
  XC_5500: { name: "XC 5,500 (10% bonus)", credits: 5500, amountKrw: 7500 },
  XC_15000: { name: "XC 15,000 (25% bonus)", credits: 15000, amountKrw: 15000 },
});

function stripeRequest(path, params, idempotencyKey) {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: new URLSearchParams(params),
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Stripe request failed.");
    return body;
  });
}

function verifyStripeSignature(rawBody, signature) {
  const parts = String(signature || "").split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatureValue = parts.find((part) => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !signatureValue || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET.value()).update(`${timestamp}.${rawBody}`).digest("hex");
  if (expected.length !== signatureValue.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureValue));
}

// 대표님 전용 관리자 UID. 로그인 후 프로필 패널에 표시되는 UID를 여기에 채워 넣어야
// adminGrantCredits / adminListWallets 가 동작한다. 비어 있으면 항상 거부된다.
const ADMIN_UID = "PiegXmg9KjNJS9JDS3piP0agUB02";

const MATCH_REWARDS = Object.freeze({
  ai_easy_win: { credits: 20, shards: 0 },
  ai_normal_win: { credits: 35, shards: 0 },
  ai_hard_win: { credits: 55, shards: 0 },
  event_easy_win: { credits: 100, shards: 2 },
  event_normal_win: { credits: 180, shards: 5 },
  event_hard_win: { credits: 300, shards: 10 },
});

const DAILY_AI_LIMITS = Object.freeze({
  ai_easy_win: 30,
  ai_normal_win: 30,
  ai_hard_win: 20,
});

function newYorkDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) throw new HttpsError("unauthenticated", "Google sign-in is required.");
  return request.auth.uid;
}

function cleanNickname(value) {
  return String(value || "").trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 20);
}

exports.createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const productId = String(request.data && request.data.productId || "");
  const product = PAID_PRODUCTS[productId];
  const clientOrderId = String(request.data && request.data.orderId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!product || !clientOrderId) throw new HttpsError("invalid-argument", "Invalid payment product or order id.");

  const orderRef = db.doc(`paymentOrders/${uid}_${clientOrderId}`);
  const existing = await orderRef.get();
  if (existing.exists && existing.get("checkoutUrl") && ["created", "open"].includes(existing.get("status"))) {
    return { url: existing.get("checkoutUrl"), sessionId: existing.get("stripeSessionId") };
  }

  // 결제 완료/취소 후 돌아갈 경로 — 클라이언트가 지정 (예: '/games/gacha/' 또는 '/game/').
  // 서버는 오픈 리다이렉트 방지를 위해 상대경로 슬래시 시작 + '..' 없음 만 허용한다.
  const rawReturn = String(request.data && request.data.returnPath || "/game/");
  const returnPath = /^\/[a-zA-Z0-9/_-]{1,80}\/$/.test(rawReturn) ? rawReturn : "/game/";
  const successUrl = `https://xenauniverse.com${returnPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `https://xenauniverse.com${returnPath}?payment=cancelled`;

  let session;
  try {
    session = await stripeRequest("/v1/checkout/sessions", {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price_data][currency]": "krw",
      "line_items[0][price_data][product_data][name]": product.name,
      "line_items[0][price_data][unit_amount]": String(product.amountKrw),
      "line_items[0][quantity]": "1",
      "metadata[uid]": uid,
      "metadata[productId]": productId,
      "metadata[clientOrderId]": clientOrderId,
    }, `xena-${uid}-${clientOrderId}`);
  } catch (error) {
    console.error("createCheckoutSession failed", error);
    throw new HttpsError("unavailable", "Payment provider is not ready.");
  }

  await orderRef.set({
    uid, productId, clientOrderId, stripeSessionId: session.id, checkoutUrl: session.url,
    amountKrw: product.amountKrw,
    shards: product.shards || 0, credits: product.credits || 0,
    status: "created",
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { url: session.url, sessionId: session.id };
});

async function fulfillCheckoutSession(session) {
  const metadata = session.metadata || {};
  const uid = String(metadata.uid || "");
  const productId = String(metadata.productId || "");
  const product = PAID_PRODUCTS[productId];
  if (!uid || !product || session.mode !== "payment" || session.payment_status !== "paid") return false;
  const grantedShards = Number(product.shards || 0);
  const grantedCredits = Number(product.credits || 0);
  const purchaseRef = db.doc(`purchases/${session.id}`);
  const walletRef = db.doc(`wallets/${uid}`);
  await db.runTransaction(async (tx) => {
    const purchase = await tx.get(purchaseRef);
    if (purchase.exists && ["paid", "refunded"].includes(purchase.get("status"))) return;
    tx.set(purchaseRef, {
      uid, productId, stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      amountKrw: product.amountKrw, grantedShards, grantedCredits, status: "paid",
      paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const walletUpdate = { uid, updatedAt: FieldValue.serverTimestamp() };
    if (grantedShards) walletUpdate.shards = FieldValue.increment(grantedShards);
    if (grantedCredits) walletUpdate.credits = FieldValue.increment(grantedCredits);
    tx.set(walletRef, walletUpdate, { merge: true });
    tx.set(db.doc(`paymentOrders/${uid}_${metadata.clientOrderId || session.id}`), { status: "paid", stripeSessionId: session.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return true;
}

async function reverseRefund(paymentIntentId, chargeId) {
  const byIntent = paymentIntentId ? await db.collection("purchases").where("stripePaymentIntentId", "==", paymentIntentId).limit(1).get() : { empty: true };
  const byCharge = byIntent.empty && chargeId ? await db.collection("purchases").where("stripeChargeId", "==", chargeId).limit(1).get() : byIntent;
  if (byCharge.empty) return false;
  const purchaseRef = byCharge.docs[0].ref;
  await db.runTransaction(async (tx) => {
    const purchase = await tx.get(purchaseRef);
    if (!purchase.exists || purchase.get("status") === "refunded") return;
    const uid = purchase.get("uid");
    const grantedShards = Number(purchase.get("grantedShards") || 0);
    const grantedCredits = Number(purchase.get("grantedCredits") || 0);
    const walletRef = db.doc(`wallets/${uid}`);
    const wallet = await tx.get(walletRef);
    // 두 통화 모두 잔액이 부족하면 그만큼 debt 로 기록 (사후 정산)
    const refundUpdate = { updatedAt: FieldValue.serverTimestamp() };
    const meta = {};
    if (grantedShards > 0) {
      const available = Math.max(0, Number(wallet.get("shards") || 0));
      const debit = Math.min(available, grantedShards);
      const debt = grantedShards - debit;
      refundUpdate.shards = FieldValue.increment(-debit);
      if (debt > 0) refundUpdate.premiumShardDebt = FieldValue.increment(debt);
      meta.refundShardDebit = debit; meta.refundShardDebt = debt;
    }
    if (grantedCredits > 0) {
      const available = Math.max(0, Number(wallet.get("credits") || 0));
      const debit = Math.min(available, grantedCredits);
      const debt = grantedCredits - debit;
      refundUpdate.credits = FieldValue.increment(-debit);
      if (debt > 0) refundUpdate.creditDebt = FieldValue.increment(debt);
      meta.refundCreditDebit = debit; meta.refundCreditDebt = debt;
    }
    tx.set(walletRef, refundUpdate, { merge: true });
    tx.set(purchaseRef, { status: "refunded", refundedAt: FieldValue.serverTimestamp(), ...meta, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return true;
}

exports.stripeWebhook = onRequest({ secrets: [STRIPE_WEBHOOK_SECRET] }, async (request, response) => {
  const rawBody = request.rawBody ? request.rawBody.toString("utf8") : "";
  if (!rawBody || !verifyStripeSignature(rawBody, request.get("stripe-signature"))) {
    response.status(400).send("Invalid signature");
    return;
  }
  let event;
  try { event = JSON.parse(rawBody); } catch (_) { response.status(400).send("Invalid event"); return; }
  try {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      await fulfillCheckoutSession(event.data.object);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      await reverseRefund(typeof charge.payment_intent === "string" ? charge.payment_intent : "", charge.id);
    }
    response.status(200).send("ok");
  } catch (error) {
    console.error("stripeWebhook failed", error);
    response.status(500).send("Webhook processing failed");
  }
});

exports.ensurePlayer = onCall(async (request) => {
  const uid = requireAuth(request);
  const walletRef = db.doc(`wallets/${uid}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(walletRef);
    if (!snapshot.exists) transaction.create(walletRef, { uid, credits: 0, shards: 0, schemaVersion: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  const wallet = await walletRef.get();
  return { credits: wallet.get("credits") || 0, shards: wallet.get("shards") || 0 };
});

exports.migratePlayer = onCall(async (request) => {
  const uid = requireAuth(request);
  const progressCode = String(request.data && request.data.progressCode || "");
  if (!progressCode || progressCode.length >= 50000) throw new HttpsError("invalid-argument", "Invalid progress payload.");
  const nickname = cleanNickname(request.data && request.data.nickname);
  const playerRef = db.doc(`players/${uid}`);
  const walletRef = db.doc(`wallets/${uid}`);
  await db.runTransaction(async (transaction) => {
    const wallet = await transaction.get(walletRef);
    const player = await transaction.get(playerRef);
    if (!wallet.exists) transaction.create(walletRef, { uid, credits: 0, shards: 0, schemaVersion: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    if (!player.exists) transaction.set(playerRef, { uid, schemaVersion: 2, saveCode: progressCode, clientUpdatedAt: new Date().toISOString(), profile: { nickname, createdAt: new Date().toISOString() }, activity: request.data.activity || { totalMinutes: 0, games: {}, lastGame: "" }, updatedAt: FieldValue.serverTimestamp() });
  });
  // Legacy local credits are intentionally not accepted: they are client-controlled and cannot be proven.
  return { migrated: true, walletTrusted: false };
});

exports.awardMatchReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const eventId = String(request.data && request.data.eventId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  const rewardKey = String(request.data && request.data.rewardKey || "");
  const reward = MATCH_REWARDS[rewardKey];
  if (!eventId || !reward) throw new HttpsError("invalid-argument", "Invalid reward request.");
  const dayKey = newYorkDateKey();
  const eventRef = db.doc(`rewardEvents/${uid}_${dayKey}_${eventId}`);
  const dailyRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);
  let granted = { credits: 0, shards: 0 };
  await db.runTransaction(async (transaction) => {
    const event = await transaction.get(eventRef);
    if (event.exists) return;
    const daily = await transaction.get(dailyRef);
    const dailyData = daily.exists ? daily.data() : {};
    const eventWins = dailyData.eventWins || {};
    const aiCounts = dailyData.aiCounts || {};

    if (rewardKey.startsWith("event_")) {
      const difficulty = rewardKey.replace(/^event_/, "").replace(/_win$/, "");
      if (eventWins[difficulty]) throw new HttpsError("already-exists", "This event reward was already claimed today.");
      granted = { ...reward };
      const nextEventWins = { ...eventWins, [difficulty]: true };
      if (nextEventWins.easy && nextEventWins.normal && nextEventWins.hard && !dailyData.eventBonusClaimed) {
        granted.credits += 500;
        granted.shards += 3;
        transaction.set(dailyRef, { uid, dayKey, eventWins: nextEventWins, eventBonusClaimed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        transaction.set(dailyRef, { uid, dayKey, eventWins: nextEventWins, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    } else {
      const limit = DAILY_AI_LIMITS[rewardKey] || 0;
      const current = Number(aiCounts[rewardKey] || 0);
      if (current >= limit) throw new HttpsError("resource-exhausted", "Daily AI reward limit reached.");
      granted = { ...reward };
      transaction.set(dailyRef, { uid, dayKey, aiCounts: { ...aiCounts, [rewardKey]: current + 1 }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    transaction.set(eventRef, { uid, dayKey, eventId, rewardKey, credits: granted.credits, shards: granted.shards, createdAt: FieldValue.serverTimestamp() });
    transaction.set(walletRef, { uid, credits: FieldValue.increment(granted.credits), shards: FieldValue.increment(granted.shards), schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  const wallet = await walletRef.get();
  return { credits: wallet.get("credits") || 0, shards: wallet.get("shards") || 0, granted };
});

/* ── 주간 랭킹: 서버 검증 기록 제출 ──
   클라이언트는 더 이상 leaderboards 하위 entries 문서에 직접 쓰지 못한다 (firestore.rules 참고).
   여기서 스테이지별 최소/최대 클리어 시간을 직접 알고 있는 값과 대조해
   물리적으로 불가능한 기록(0초, 음수, 제한시간 초과 등)을 걸러낸다. */
const STAGE_TIME_LIMITS = Object.freeze({
  // [스테이지 번호]: 그 스테이지의 제한시간(초) — 각 게임 index.html 의 STAGES 배열과 동일하게 유지
  shisen: { 1: 50, 2: 65, 3: 80, 4: 110, 5: 140, 6: 170, 7: 200, 8: 230, 9: 260, 10: 290 },
  memory: { 1: 25, 2: 35, 3: 45, 4: 55, 5: 70, 6: 85, 7: 100, 8: 115, 9: 130, 10: 150 },
});
// 스테이지 난이도에 비례한 최소 물리적 소요시간(초) — 이보다 빠르면 조작으로 간주해 거부
const STAGE_MIN_SECONDS = Object.freeze({
  shisen: { 1: 3, 2: 4, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17, 10: 19 },
  memory: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11 },
});
// 스테이지가 높을수록 더 큰 주간 포인트 (요청하신 "높은 스테이지에 더 높은 점수")
function stagePoints(stage) { return stage * 10; }

function weekKeyUTC(date = new Date()) {
  const onejan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date - onejan) / 86400000);
  const wk = Math.ceil((days + onejan.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${wk}`;
}

exports.submitScore = onCall(async (request) => {
  const uid = requireAuth(request);
  const game = String(request.data && request.data.game || "");
  const stage = Number(request.data && request.data.stage);
  const seconds = Number(request.data && request.data.seconds);

  const limits = STAGE_TIME_LIMITS[game];
  if (!limits) throw new HttpsError("invalid-argument", "Unknown game.");
  if (!Number.isInteger(stage) || !limits[stage]) throw new HttpsError("invalid-argument", "Unknown stage.");
  const minSec = STAGE_MIN_SECONDS[game][stage];
  const maxSec = limits[stage];
  if (!Number.isFinite(seconds) || seconds < minSec || seconds > maxSec) {
    throw new HttpsError("invalid-argument", `Score out of physically possible range (${minSec}-${maxSec}s).`);
  }

  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists || !userDoc.get("nickname")) {
    throw new HttpsError("failed-precondition", "Set a nickname before submitting a score.");
  }
  const nickname = userDoc.get("nickname");

  const week = weekKeyUTC();
  const boardId = `${game}_${week}_s${stage}`;
  const entryRef = db.doc(`leaderboards/${boardId}/entries/${uid}`);
  const dayKey = newYorkDateKey();
  const clearRef = db.doc(`dailyClears/${uid}_${dayKey}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(entryRef);
    let improved = true, best = seconds;
    if (snap.exists) {
      const prev = snap.get("score");
      if (typeof prev === "number" && prev <= seconds) { improved = false; best = prev; }
    }
    if (improved) {
      tx.set(entryRef, {
        uid, nickname, game, week, stage: String(stage), score: seconds,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    // 오늘 이 게임/스테이지를 실제로 클리어했다는 서버 기록 (claimStageReward 가 이 값으로만 보상을 내줌)
    tx.set(clearRef, { uid, dayKey, [`${game}_${stage}`]: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { improved, best };
  });

  return { ok: true, ...result };
});

/* ── 스테이지 클리어 하루 첫 보상 (memory/shisen) ──
   submitScore 가 오늘 실제로 그 스테이지를 클리어했다고 남긴 dailyClears 기록이
   있을 때만 지급한다 — 클라이언트가 그냥 "클리어했다"고 우기는 걸로는 못 받는다. */
const STAGE_REWARD = Object.freeze({
  shisen: (stage) => stage * 2,
  memory: (stage) => stage,
});
exports.claimStageReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const game = String(request.data && request.data.game || "");
  const stage = Number(request.data && request.data.stage);
  const rewardFn = STAGE_REWARD[game];
  if (!rewardFn || !STAGE_TIME_LIMITS[game] || !STAGE_TIME_LIMITS[game][stage]) {
    throw new HttpsError("invalid-argument", "Unknown game/stage.");
  }
  const dayKey = newYorkDateKey();
  const clearRef = db.doc(`dailyClears/${uid}_${dayKey}`);
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);
  const reward = rewardFn(stage);
  const flagKey = `${game}_${stage}`;

  const result = await db.runTransaction(async (tx) => {
    const clear = await tx.get(clearRef);
    if (!clear.exists || !clear.get(flagKey)) {
      throw new HttpsError("failed-precondition", "No verified clear for this stage today.");
    }
    const claim = await tx.get(claimRef);
    const stageRewards = (claim.exists && claim.get("stageRewards")) || {};
    const claimKey = `${game}_${stage}`;
    if (stageRewards[claimKey]) return { granted: 0 };
    tx.set(claimRef, { uid, dayKey, stageRewards: { ...stageRewards, [claimKey]: true }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(walletRef, { uid, credits: FieldValue.increment(reward), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: reward };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 데일리 시그널 수령 (+5 XC + 연속출석 단계 보너스) ──
   [2026-07-25] 7일마다 +20 하나뿐이던 걸 3/7/15/30/100/365일 단계별 보너스로 확장.
   365일 달성 시 스트릭을 0으로 리셋(그 다음 출석이 다시 1일차) — "최대 1년 연속 받으면
   초기화" 요청 반영. 하루라도 거르면 1일차부터 다시 시작(기존 로직 그대로 유지).
   연속 출석일수는 서버가 직접 센다 — localStorage 조작으로는 스트릭을 늘릴 수 없다. */
const STREAK_BONUS = Object.freeze({ 3: 10, 7: 20, 15: 40, 30: 80, 100: 300, 365: 1000 });
exports.claimDailySignal = onCall(async (request) => {
  const uid = requireAuth(request);
  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const streakRef = db.doc(`signalStreaks/${uid}`);
  const walletRef = db.doc(`wallets/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    if (claim.exists && claim.get("signalClaimed")) {
      throw new HttpsError("already-exists", "Already claimed today.");
    }
    const streakDoc = await tx.get(streakRef);
    const prevDay = streakDoc.exists ? streakDoc.get("lastDayKey") : null;
    const prevStreak = (streakDoc.exists && streakDoc.get("streak")) || 0;
    const yesterday = newYorkDateKey(new Date(Date.now() - 86400000));
    let streak = prevDay === yesterday ? prevStreak + 1 : 1;
    const bonus = STREAK_BONUS[streak] || 0;
    const total = 5 + bonus;
    const resetAfterYear = streak >= 365;
    if (resetAfterYear) streak = 0; /* 1년 연속 달성 보너스까지 지급한 뒤 다음날부터 다시 1일차 */

    tx.set(claimRef, { uid, dayKey, signalClaimed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(streakRef, { uid, streak, lastDayKey: dayKey, updatedAt: FieldValue.serverTimestamp() });
    tx.set(walletRef, { uid, credits: FieldValue.increment(total), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: total, streak: resetAfterYear ? 365 : streak, bonus };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 데일리 시그널 페이지의 5개 퀘스트 보너스 + 전체완료 보너스 ──
   ⚠ 아직 각 게임을 "진짜로 오늘 했는지"까지 서버가 재검증하지는 않는다 (그러려면
   게임마다 별도 서버 로직이 더 필요함 — 다음 단계 작업). 지금 단계에서 막는 것은
   "하루에 여러 번 받기"(localStorage 조작으로 무한 반복 수령) 하나이며, 이것만으로도
   기존의 완전 무제한 조작보다는 크게 개선된다. */
const QUEST_BONUS = Object.freeze({
  chess: 10, gacha: 8, worldcup: 10, memory: 8, shisen: 8, tcg: 10, idle: 10, merge: 10, allbonus: 25,
});
exports.claimQuestBonus = onCall(async (request) => {
  const uid = requireAuth(request);
  const questId = String(request.data && request.data.questId || "");
  const amount = QUEST_BONUS[questId];
  if (!amount) throw new HttpsError("invalid-argument", "Unknown quest.");
  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    const quests = (claim.exists && claim.get("quests")) || {};
    if (quests[questId]) throw new HttpsError("already-exists", "Already claimed today.");
    tx.set(claimRef, { uid, dayKey, quests: { ...quests, [questId]: true }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(walletRef, { uid, credits: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: amount };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 제나카드 웰컴 보너스: 평생 1회, +50 XC ── */
exports.claimWelcomeBonus = onCall(async (request) => {
  const uid = requireAuth(request);
  const walletRef = db.doc(`wallets/${uid}`);
  const AMOUNT = 50;
  const result = await db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef);
    if (wallet.exists && wallet.get("welcomeClaimed")) return { granted: 0 };
    tx.set(walletRef, { uid, credits: FieldValue.increment(AMOUNT), welcomeClaimed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: AMOUNT };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 제나카드 중복 카드 분해 (dust) ──
   카드 소유 자체는 아직 서버에 없으므로(다음 단계 작업), 등급별 단가는 서버가 신뢰하는
   표로 고정하고 "몇 장을 분해했는지"만 클라이언트 값을 받아 상한을 두고 계산한다.
   완전한 검증은 아니지만 최소한 "등급 단가 조작"은 막는다. */
const DUST_VALUE = Object.freeze({ N: 1, R: 3, S: 10, SR: 30, SSR: 100 });
exports.claimGachaDust = onCall(async (request) => {
  const uid = requireAuth(request);
  const grade = String(request.data && request.data.grade || "");
  const count = Number(request.data && request.data.count);
  const unit = DUST_VALUE[grade];
  if (!unit) throw new HttpsError("invalid-argument", "Unknown grade.");
  if (!Number.isInteger(count) || count <= 0 || count > 500) {
    throw new HttpsError("invalid-argument", "Invalid count.");
  }
  const amount = unit * count;
  const walletRef = db.doc(`wallets/${uid}`);
  await walletRef.set({ uid, credits: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const wallet = await walletRef.get();
  return { granted: amount, credits: wallet.get("credits") || 0 };
});

/* ── 이상형 월드컵 완주 보상: 5 XC, 하루 3회 한도 ── */
exports.claimWorldcupFinish = onCall(async (request) => {
  const uid = requireAuth(request);
  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);
  const LIMIT = 3, AMOUNT = 5;

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    const count = (claim.exists && claim.get("worldcupCount")) || 0;
    if (count >= LIMIT) throw new HttpsError("resource-exhausted", "Daily limit reached.");
    tx.set(claimRef, { uid, dayKey, worldcupCount: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(walletRef, { uid, credits: FieldValue.increment(AMOUNT), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: AMOUNT, count: count + 1, limit: LIMIT };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 오버라이드 그리드 플레이 감지 보상: 8 XC, 하루 3회 한도 ── */
exports.claimChessMatch = onCall(async (request) => {
  const uid = requireAuth(request);
  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);
  const LIMIT = 3, AMOUNT = 8;

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    const count = (claim.exists && claim.get("chessMatchCount")) || 0;
    if (count >= LIMIT) throw new HttpsError("resource-exhausted", "Daily limit reached.");
    tx.set(claimRef, { uid, dayKey, chessMatchCount: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(walletRef, { uid, credits: FieldValue.increment(AMOUNT), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted: AMOUNT, count: count + 1, limit: LIMIT };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── 범용 소비: 가챠 팩 XC 구매, 리셋 비용 등 잔액이 충분할 때만 원자적으로 차감 ──
   무엇을 얻는지(카드 등)는 아직 클라이언트가 계산 — 여기서는 "잔액 조작 방지"만 보장한다. */
exports.spendCredits = onCall(async (request) => {
  const uid = requireAuth(request);
  const amount = Number(request.data && request.data.amount);
  const reason = String(request.data && request.data.reason || "").slice(0, 40);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new HttpsError("invalid-argument", "Invalid amount.");
  }
  const walletRef = db.doc(`wallets/${uid}`);
  const result = await db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef);
    const current = (wallet.exists && wallet.get("credits")) || 0;
    if (current < amount) throw new HttpsError("failed-precondition", "Insufficient balance.");
    tx.set(walletRef, { uid, credits: FieldValue.increment(-amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { spent: amount, reason };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ══════════════════════════════════════════════════════════════
   SIGNAL CLASH (TCG) · LIVE TOUR (방치형 디스패치) — 2026-07-22 추가
   games/tcg/, games/idle/ 를 로컬 localStorage 지갑에서 서버 지갑으로
   전환하며 신설. 카드 소유권 자체는 아직 서버에 없으므로(다음 단계 작업),
   claimGachaDust 와 동일한 수준으로 "등급 문자열"만 클라이언트에게 받고
   금액은 서버가 고정한 표로 계산한다 — 단가 조작만 막는 최소 검증.
   ══════════════════════════════════════════════════════════════ */

/* 카드 등급 → 코스트(시간)/파워. shared/xena-cards.js 의 GRADE_STATS 와 반드시 동일하게 유지.
   ZENA_TCG_전체통합_카드DB_v1.md §3-2 canonical (2026-07-22): R=1/1, S=2/2, SR=3/4, SSR=4/6.
   N은 그 문서에 없어(TCG는 R+만) 방치형 온보딩용으로 R과 동급 취급. */
const GRADE_COST  = Object.freeze({ N: 1, R: 1, S: 2, SR: 3, SSR: 4 });
const GRADE_POWER = Object.freeze({ N: 1, R: 1, S: 2, SR: 4, SSR: 6 });
/* 카드 파워 수치가 확 낮아진 만큼(과거 SSR 11 → 6) 이전에 합의된 XC 페이스를 유지하려면
   배율을 올려야 함 — 8 → 15 (SSR 3장 4시간 투어 기준 과거 규모와 비슷하게 재계산, 대표 확인 필요). */
const REWARD_PER_POWER = 15;

/* ── SIGNAL CLASH: AI 난이도별 승/패 보상. 하루 총 5판(난이도 무관 합산)까지만 지급.
   승수는 하루 제한과 별개로 wallets/{uid}.tcgWins 에 영구 누적 — LIVE TOUR 4번째 슬롯 게이트가 이 값을 본다. */
const TCG_REWARDS = Object.freeze({ easy: 8, normal: 15, hard: 30, veryhard: 50 });
const TCG_LOSS_REWARD = 5;
const TCG_FIRST_WIN_BONUS = 20;
const TCG_DAILY_LIMIT = 5;

exports.claimTcgMatch = onCall(async (request) => {
  const uid = requireAuth(request);
  const difficulty = String(request.data && request.data.difficulty || "");
  const outcome = String(request.data && request.data.outcome || "");
  if (!TCG_REWARDS[difficulty]) throw new HttpsError("invalid-argument", "Unknown difficulty.");
  if (outcome !== "win" && outcome !== "loss") throw new HttpsError("invalid-argument", "Unknown outcome.");

  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    const data = claim.exists ? claim.data() : {};
    const played = Number(data.tcgMatches || 0);
    if (played >= TCG_DAILY_LIMIT) throw new HttpsError("resource-exhausted", "Daily match reward limit reached.");

    let granted = outcome === "win" ? TCG_REWARDS[difficulty] : TCG_LOSS_REWARD;
    let firstWin = false;
    if (outcome === "win" && !data.tcgFirstWin) { granted += TCG_FIRST_WIN_BONUS; firstWin = true; }

    tx.set(claimRef, {
      uid, dayKey, tcgMatches: played + 1,
      tcgFirstWin: data.tcgFirstWin || firstWin,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const walletUpdate = { uid, credits: FieldValue.increment(granted), updatedAt: FieldValue.serverTimestamp() };
    if (outcome === "win") walletUpdate.tcgWins = FieldValue.increment(1);
    tx.set(walletRef, walletUpdate, { merge: true });

    return { granted, firstWin, played: played + 1, limit: TCG_DAILY_LIMIT };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── XENA MERGE: 점수 비례 XC 보상 ──
   ⚠ 시간 대비 물리적 최대 점수 검증(SIGNAL CLASH/SIGNAL LINK 처럼)까지는 아직 없다 —
   그러려면 머지 특유의 물리엔진 결과를 서버가 재현해야 해서 범위 밖. 대신 (1) 한 판당
   받을 수 있는 점수에 상한을 두고, (2) 하루 지급 횟수를 제한해서 무한 반복 수령을 막는다. */
const MERGE_MAX_SCORE_PER_CLAIM = 20000;   /* 이보다 큰 점수를 보내면 이 값으로 잘라서 계산 */
const MERGE_XC_PER_SCORE = 1 / 25;         /* 점수 25당 XC 1 */
const MERGE_MAX_REWARD = 300;              /* 한 판 보상 상한 */
const MERGE_DAILY_LIMIT = 5;
exports.claimMergeScore = onCall(async (request) => {
  const uid = requireAuth(request);
  const scoreRaw = Number(request.data && request.data.score);
  if (!Number.isFinite(scoreRaw) || scoreRaw < 0) throw new HttpsError("invalid-argument", "Invalid score.");
  const score = Math.min(Math.floor(scoreRaw), MERGE_MAX_SCORE_PER_CLAIM);

  const dayKey = newYorkDateKey();
  const claimRef = db.doc(`dailyRewardClaims/${uid}_${dayKey}`);
  const walletRef = db.doc(`wallets/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const claim = await tx.get(claimRef);
    const data = claim.exists ? claim.data() : {};
    const played = Number(data.mergePlays || 0);
    if (played >= MERGE_DAILY_LIMIT) throw new HttpsError("resource-exhausted", "Daily reward limit reached.");

    const granted = Math.min(MERGE_MAX_REWARD, Math.floor(score * MERGE_XC_PER_SCORE));
    tx.set(claimRef, { uid, dayKey, mergePlays: played + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(walletRef, { uid, credits: FieldValue.increment(granted), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted, played: played + 1, limit: MERGE_DAILY_LIMIT };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

/* ── LIVE TOUR: 도시 해금 ──
   서울은 항상 무료 해금 상태여야 하지만, Firestore엔 실제로 기록된 적이 없었다(클라이언트/서버
   양쪽 다 "필드가 아예 없을 때만" 기본값 ["seoul"]로 가정했을 뿐). 그래서 다른 도시를 처음
   해금(arrayUnion)하는 순간 unlockedCities 필드가 그 도시 하나만 담은 채로 새로 생성되어
   서울이 배열에서 빠지고, 이후 서울 관련 검사(startTour 등)가 전부 "잠김"으로 잘못 판정했다.
   normalizeUnlocked()로 seoul을 항상 강제 포함시켜 근본적으로 고친다. */
function normalizeUnlocked(arr){
  var out = Array.isArray(arr) ? arr.slice() : [];
  if (out.indexOf("seoul") < 0) out.unshift("seoul");
  return out;
}
/* element는 도시별 "궁합 속성" — 파견한 카드들의 속성(SOUND/SOUL/DARK/LIGHT/METAL/BUG)이
   이 값과 얼마나 겹치느냐로 보상 시너지 보너스가 붙는다(아래 SYNERGY_BONUS). 카드 소유권을
   서버가 직접 검증하지 않는 기존 설계(grades만 신뢰)와 동일한 신뢰 수준으로, elements도
   client가 보고한 값을 그대로 쓴다 — grade와 마찬가지로 고정 배율표만 참조하고 카드 DB를
   서버에 복제하지 않는다. */
const CITY_TABLE = Object.freeze({
  seoul:  { mult: 1.00, cost: 0,     element: 'SOUND' },
  tokyo:  { mult: 1.25, cost: 1200,  element: 'SOUL'  },
  ny:     { mult: 1.50, cost: 7000,  element: 'METAL' },
  london: { mult: 1.80, cost: 22000, element: 'LIGHT' },
});
const VALID_ELEMENTS = Object.freeze(['SOUND', 'SOUL', 'DARK', 'LIGHT', 'METAL', 'BUG']);
/* 보낸 카드 중 도시 속성과 일치하는 비율에 따른 보상 보너스 */
function synergyBonus(elements, cityElement){
  if (!Array.isArray(elements) || !elements.length) return 0;
  const matches = elements.filter((e) => e === cityElement).length;
  const ratio = matches / elements.length;
  if (ratio >= 1) return 0.30;
  if (ratio >= 0.66) return 0.15;
  return 0;
}
exports.unlockCity = onCall(async (request) => {
  const uid = requireAuth(request);
  const city = String(request.data && request.data.city || "");
  const info = CITY_TABLE[city];
  if (!info) throw new HttpsError("invalid-argument", "Unknown city.");
  const walletRef = db.doc(`wallets/${uid}`);
  const result = await db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef);
    const data = wallet.exists ? wallet.data() : {};
    const unlocked = normalizeUnlocked(data.unlockedCities);
    if (unlocked.indexOf(city) >= 0) return { already: true };
    const credits = data.credits || 0;
    if (credits < info.cost) throw new HttpsError("failed-precondition", "Insufficient balance.");
    tx.set(walletRef, {
      uid, credits: FieldValue.increment(-info.cost),
      unlockedCities: FieldValue.arrayUnion(city, "seoul"),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { unlocked: city };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0, unlockedCities: normalizeUnlocked(wallet.get("unlockedCities")) };
});

/* ── LIVE TOUR: 투어 정원 확장(3→4장), 35,000 XC + SIGNAL CLASH 30승 ──
   "도감 60%" 조건은 카드 소유권이 아직 서버에 없어 지금 단계에선 검증 불가 —
   화면엔 계속 표시하되(목표 제시용) 서버는 XC+승수만 강제한다. */
const CAPACITY_UPGRADE_COST = 35000;
const CAPACITY_UPGRADE_WINS = 30;
exports.upgradeTourCapacity = onCall(async (request) => {
  const uid = requireAuth(request);
  const walletRef = db.doc(`wallets/${uid}`);
  const result = await db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef);
    const data = wallet.exists ? wallet.data() : {};
    if (data.tourCapacity >= 4) return { already: true };
    const wins = data.tcgWins || 0;
    if (wins < CAPACITY_UPGRADE_WINS) throw new HttpsError("failed-precondition", "Not enough SIGNAL CLASH wins.");
    const credits = data.credits || 0;
    if (credits < CAPACITY_UPGRADE_COST) throw new HttpsError("failed-precondition", "Insufficient balance.");
    tx.set(walletRef, {
      uid, credits: FieldValue.increment(-CAPACITY_UPGRADE_COST), tourCapacity: 4,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { capacity: 4 };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0, capacity: wallet.get("tourCapacity") || 3 };
});

/* ── LIVE TOUR: 투어 시작/수령/취소 ──
   시간은 서버 timestamp 가 기준이라 클라이언트가 기기 시계를 돌려도 소용없다.
   카드 소유권이 아직 서버에 없으므로 "어떤 카드를 보냈는지"는 등급 문자열만 받고,
   보상 금액은 서버가 고정한 등급별 파워표로 계산한다(단가 조작만 방지, claimGachaDust와 동일 수준). */
exports.startTour = onCall(async (request) => {
  const uid = requireAuth(request);
  const city = String(request.data && request.data.city || "");
  const grades = Array.isArray(request.data && request.data.grades) ? request.data.grades : [];
  const elementsRaw = Array.isArray(request.data && request.data.elements) ? request.data.elements : [];
  const cityInfo = CITY_TABLE[city];
  if (!cityInfo) throw new HttpsError("invalid-argument", "Unknown city.");
  if (!grades.length || grades.length > 4 || grades.some((g) => !GRADE_COST[g])) {
    throw new HttpsError("invalid-argument", "Invalid card grades.");
  }
  /* elements는 선택 입력(구버전 클라이언트 호환) — 있으면 grades와 길이가 같고 유효한 속성이어야 함 */
  const elements = elementsRaw.length === grades.length && elementsRaw.every((e) => VALID_ELEMENTS.indexOf(e) >= 0)
    ? elementsRaw : [];

  const walletRef = db.doc(`wallets/${uid}`);
  const tourRef = db.doc(`tours/${uid}_${city}`);
  const result = await db.runTransaction(async (tx) => {
    const [wallet, tour] = await Promise.all([tx.get(walletRef), tx.get(tourRef)]);
    const data = wallet.exists ? wallet.data() : {};
    const unlocked = normalizeUnlocked(data.unlockedCities);
    if (unlocked.indexOf(city) < 0) throw new HttpsError("failed-precondition", "City is locked.");
    const capacity = data.tourCapacity || 3;
    if (grades.length > capacity) throw new HttpsError("failed-precondition", "Too many cards for current tour capacity.");
    if (tour.exists) throw new HttpsError("already-exists", "A tour is already running for this city.");

    const durationMs = Math.max.apply(null, grades.map((g) => GRADE_COST[g])) * 3600000;
    tx.set(tourRef, {
      uid, city, grades, elements, durationMs,
      startAt: FieldValue.serverTimestamp(),
      claimedAt: null,
    });
    return { durationMs };
  });
  return result;
});

exports.claimTourReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const city = String(request.data && request.data.city || "");
  const cityInfo = CITY_TABLE[city];
  if (!cityInfo) throw new HttpsError("invalid-argument", "Unknown city.");

  const walletRef = db.doc(`wallets/${uid}`);
  const tourRef = db.doc(`tours/${uid}_${city}`);
  const result = await db.runTransaction(async (tx) => {
    const tour = await tx.get(tourRef);
    if (!tour.exists) throw new HttpsError("not-found", "No tour running for this city.");
    const t = tour.data();
    if (t.uid !== uid) throw new HttpsError("permission-denied", "Not your tour.");
    const startAtMs = t.startAt && t.startAt.toMillis ? t.startAt.toMillis() : 0;
    if (Date.now() < startAtMs + t.durationMs) throw new HttpsError("failed-precondition", "Tour not finished yet.");

    const sumPower = t.grades.reduce((s, g) => s + (GRADE_POWER[g] || 0), 0);
    const bonus = synergyBonus(t.elements, cityInfo.element);
    const granted = Math.floor(sumPower * REWARD_PER_POWER * cityInfo.mult * (1 + bonus));

    tx.delete(tourRef);
    tx.set(walletRef, { uid, credits: FieldValue.increment(granted), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { granted, bonus };
  });
  const wallet = await walletRef.get();
  return { ...result, credits: wallet.get("credits") || 0 };
});

exports.cancelTour = onCall(async (request) => {
  const uid = requireAuth(request);
  const city = String(request.data && request.data.city || "");
  const tourRef = db.doc(`tours/${uid}_${city}`);
  const tour = await tourRef.get();
  if (!tour.exists) return { ok: true };
  if (tour.get("uid") !== uid) throw new HttpsError("permission-denied", "Not your tour.");
  await tourRef.delete();
  return { ok: true };
});

/* ── LIVE TOUR: 현재 진행 중인 모든 투어 조회 (로컬 캐시 유실 시 복구용) ── */
exports.getTours = onCall(async (request) => {
  const uid = requireAuth(request);
  const snap = await db.collection("tours").where("uid", "==", uid).get();
  const tours = {};
  snap.forEach((doc) => {
    const d = doc.data();
    tours[d.city] = {
      grades: d.grades, elements: d.elements || [], durationMs: d.durationMs,
      startAt: d.startAt && d.startAt.toMillis ? d.startAt.toMillis() : Date.now(),
    };
  });
  return { tours };
});

/* ── 잔액 + 연속출석 조회 ── */
exports.getWallet = onCall(async (request) => {
  const uid = requireAuth(request);
  const [wallet, streakDoc] = await Promise.all([
    db.doc(`wallets/${uid}`).get(),
    db.doc(`signalStreaks/${uid}`).get(),
  ]);
  const dayKey = newYorkDateKey();
  const yesterday = newYorkDateKey(new Date(Date.now() - 86400000));
  const lastDay = streakDoc.exists ? streakDoc.get("lastDayKey") : null;
  const streak = (lastDay === dayKey || lastDay === yesterday) ? ((streakDoc.exists && streakDoc.get("streak")) || 0) : 0;
  return {
    credits: wallet.get("credits") || 0, shards: wallet.get("shards") || 0, streak,
    unlockedCities: normalizeUnlocked(wallet.get("unlockedCities")),
    tourCapacity: wallet.get("tourCapacity") || 3,
    tcgWins: wallet.get("tcgWins") || 0,
  };
});

/* ── 주간 랭킹 마감 + 포인트 합산 + 1~3등 보상 지급 ──
   매주 월요일 00:10 UTC 에 "직전 주" 를 정산한다.
   포인트 = 그 주에 기록한 스테이지별 최고기록 하나당 stage*10, 전 스테이지 합산.
   1/2/3등에게 wallets/{uid}.credits 로 보상을 지급한다 (미니게임 XC 는 아직
   서버화되지 않았으므로, 이미 서버 검증되어 있는 체스 크레딧 지갑을 재사용한다). */
const WEEKLY_PRIZES = [500, 300, 150]; // 1등/2등/3등 credits

exports.settleWeeklyRanking = onSchedule({ schedule: "10 0 * * 1", timeZone: "Etc/UTC" }, async () => {
  const prevMonday = new Date();
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const week = weekKeyUTC(prevMonday);

  for (const game of Object.keys(STAGE_TIME_LIMITS)) {
    const totals = new Map(); // uid -> {points, nickname}
    const stageNums = Object.keys(STAGE_TIME_LIMITS[game]).map(Number);
    for (const stage of stageNums) {
      const boardId = `${game}_${week}_s${stage}`;
      const entries = await db.collection(`leaderboards/${boardId}/entries`).get();
      entries.forEach((doc) => {
        const v = doc.data();
        const prev = totals.get(v.uid) || { points: 0, nickname: v.nickname };
        prev.points += stagePoints(stage);
        prev.nickname = v.nickname;
        totals.set(v.uid, prev);
      });
    }
    if (!totals.size) continue;

    const ranked = Array.from(totals.entries())
      .map(([uid, v]) => ({ uid, points: v.points, nickname: v.nickname }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    const rewardRef = db.doc(`weeklyRewards/${game}_${week}`);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(rewardRef);
      if (existing.exists) return; // 이미 정산된 주는 건너뜀 (중복 지급 방지)
      const winners = ranked.map((r, i) => ({ ...r, rank: i + 1, credits: WEEKLY_PRIZES[i] || 0, claimed: false }));
      tx.set(rewardRef, { game, week, winners, settledAt: FieldValue.serverTimestamp() });
    });
  }
});

/* 플레이어가 자기 보상을 지갑에 반영 (claimed 플래그로 1회만) */
exports.claimWeeklyReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const snap = await db.collection("weeklyRewards").get();
  let claimedTotal = 0;
  const claimedList = [];
  await db.runTransaction(async (tx) => {
    for (const doc of snap.docs) {
      const data = doc.data();
      const winners = Array.isArray(data.winners) ? data.winners : [];
      const idx = winners.findIndex((w) => w.uid === uid && !w.claimed);
      if (idx === -1) continue;
      winners[idx] = { ...winners[idx], claimed: true };
      tx.update(doc.ref, { winners });
      claimedTotal += winners[idx].credits;
      claimedList.push({ game: data.game, week: data.week, rank: winners[idx].rank, credits: winners[idx].credits });
    }
    if (claimedTotal > 0) {
      tx.set(db.doc(`wallets/${uid}`), { uid, credits: FieldValue.increment(claimedTotal), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  return { claimedTotal, claimedList };
});

/* ── 관리자 전용 ── */
function requireAdmin(request) {
  const uid = requireAuth(request);
  if (!ADMIN_UID || uid !== ADMIN_UID) throw new HttpsError("permission-denied", "Admin only.");
  return uid;
}

exports.adminGrantCredits = onCall(async (request) => {
  requireAdmin(request);
  const targetUid = String(request.data && request.data.targetUid || "");
  const amount = Number(request.data && request.data.amount);
  if (!targetUid || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000000) {
    throw new HttpsError("invalid-argument", "Invalid target/amount.");
  }
  await db.doc(`wallets/${targetUid}`).set(
    { uid: targetUid, credits: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  const wallet = await db.doc(`wallets/${targetUid}`).get();
  return { credits: wallet.get("credits") || 0 };
});

// 비정상 재화 보유자 조회 전용 — 초기화는 하지 않고 목록만 반환한다 (요청하신 대로 "조회 먼저").
exports.adminListWallets = onCall(async (request) => {
  requireAdmin(request);
  const threshold = Number(request.data && request.data.threshold) || 500;
  const snap = await db.collection("wallets").orderBy("credits", "desc").limit(50).get();
  const flagged = [];
  snap.forEach((doc) => {
    const v = doc.data();
    if ((v.credits || 0) >= threshold || (v.shards || 0) >= threshold) {
      flagged.push({ uid: v.uid, credits: v.credits || 0, shards: v.shards || 0 });
    }
  });
  return { threshold, flagged, totalChecked: snap.size };
});

exports.adminResetWallet = onCall(async (request) => {
  requireAdmin(request);
  const targetUid = String(request.data && request.data.targetUid || "");
  if (!targetUid) throw new HttpsError("invalid-argument", "targetUid required.");
  await db.doc(`wallets/${targetUid}`).set(
    { uid: targetUid, credits: 0, shards: 0, updatedAt: FieldValue.serverTimestamp(), resetReason: "admin_anomaly_reset" },
    { merge: true }
  );
  return { ok: true };
});
