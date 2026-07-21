const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// 대표님 전용 관리자 UID. 로그인 후 프로필 패널에 표시되는 UID를 여기에 채워 넣어야
// adminGrantCredits / adminListWallets 가 동작한다. 비어 있으면 항상 거부된다.
const ADMIN_UID = "";

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

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(entryRef);
    if (snap.exists) {
      const prev = snap.get("score");
      if (typeof prev === "number" && prev <= seconds) return { improved: false, best: prev };
    }
    tx.set(entryRef, {
      uid, nickname, game, week, stage: String(stage), score: seconds,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { improved: true, best: seconds };
  });

  return { ok: true, ...result };
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
