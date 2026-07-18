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
  const eventRef = db.doc(`rewardEvents/${uid}_${eventId}`);
  const walletRef = db.doc(`wallets/${uid}`);
  await db.runTransaction(async (transaction) => {
    const event = await transaction.get(eventRef);
    if (event.exists) return;
    transaction.set(eventRef, { uid, eventId, rewardKey, credits: reward.credits, shards: reward.shards, createdAt: FieldValue.serverTimestamp() });
    transaction.set(walletRef, { uid, credits: FieldValue.increment(reward.credits), shards: FieldValue.increment(reward.shards), schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  const wallet = await walletRef.get();
  return { credits: wallet.get("credits") || 0, shards: wallet.get("shards") || 0 };
});
