const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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
