(function () {
  "use strict";

  const SDK_VERSION = "12.15.0";
  const config = window.XenaFirebaseConfig || {};
  const configured = Boolean(config.enabled && config.apiKey && config.authDomain && config.projectId && config.appId);
  const listeners = new Set();
  const state = { configured, phase: configured ? "idle" : "disabled", user: null, profile: null, wallet: null, error: "" };

  let appInstance = null;
  let auth = null;
  let db = null;
  let provider = null;
  let authApi = null;
  let firestoreApi = null;
  let functionsApi = null;
  let functionsInstance = null;
  let sdkPromise = null;

  function cleanNickname(value) {
    return String(value || "").trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 16);
  }

  function publicUser(user) {
    return user ? { uid: user.uid, displayName: user.displayName || "", email: user.email || "", photoURL: user.photoURL || "" } : null;
  }

  function snapshot() {
    return { ...state, user: state.user ? { ...state.user } : null, profile: state.profile ? { ...state.profile } : null, wallet: state.wallet ? { ...state.wallet } : null };
  }

  function notify() {
    const next = snapshot();
    listeners.forEach((listener) => {
      try { listener(next); } catch (_) { /* keep auth listeners isolated */ }
    });
  }

  function setState(next) {
    Object.assign(state, next);
    notify();
  }

  async function connect() {
    if (!configured) return snapshot();
    if (sdkPromise) return sdkPromise;
    setState({ phase: "connecting", error: "" });
    sdkPromise = (async () => {
      const [appModule, authModule, firestoreModule, functionsModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-functions.js`),
      ]);
      appInstance = appModule.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
      authApi = authModule;
      firestoreApi = firestoreModule;
      functionsApi = functionsModule;
      auth = authModule.getAuth(appInstance);
      db = firestoreModule.getFirestore(appInstance);
      functionsInstance = functionsModule.getFunctions(appInstance, "us-central1");
      provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await new Promise((resolve) => {
        let first = true;
        authModule.onAuthStateChanged(auth, (user) => {
          setState({ phase: user ? "signed-in" : "signed-out", user: publicUser(user), error: "", profile: user ? state.profile : null, wallet: user ? state.wallet : null });
          if (first) { first = false; resolve(); }
        });
      });
      return snapshot();
    })().catch((error) => {
      sdkPromise = null;
      setState({ phase: "error", error: String(error && error.code || "AUTH_ERROR") });
      throw error;
    });
    return sdkPromise;
  }

  async function signIn() {
    await connect();
    const result = await authApi.signInWithPopup(auth, provider);
    setState({ phase: "signed-in", user: publicUser(result.user), error: "" });
    await loadProfile();
    await ensureWallet();
    return snapshot();
  }

  async function signOut() {
    await connect();
    await authApi.signOut(auth);
    setState({ phase: "signed-out", user: null, profile: null, wallet: null, error: "" });
  }

  function requireUser() {
    if (!auth || !auth.currentUser) throw new Error("AUTH_REQUIRED");
    return auth.currentUser;
  }

  async function loadProfile() {
    await connect();
    const user = requireUser();
    const ref = firestoreApi.doc(db, "users", user.uid);
    const snap = await firestoreApi.getDoc(ref);
    const profile = snap.exists() ? snap.data() : null;
    setState({ profile });
    return profile;
  }

  async function ensureNickname(nickname) {
    await connect();
    const user = requireUser();
    const existing = await loadProfile();
    if (existing && existing.nicknameLocked) return existing;
    const safe = cleanNickname(nickname);
    if (safe.length < 2) throw new Error("INVALID_NICKNAME");
    const now = firestoreApi.serverTimestamp();
    const profile = { uid: user.uid, nickname: safe, nicknameLower: safe.toLowerCase(), nicknameLocked: true, createdAt: now, updatedAt: now };
    await firestoreApi.setDoc(firestoreApi.doc(db, "users", user.uid), profile, { merge: false });
    return loadProfile();
  }

  async function callFunction(name, data) {
    await connect();
    requireUser();
    const callable = functionsApi.httpsCallable(functionsInstance, name);
    const result = await callable(data || {});
    return result.data;
  }

  async function ensureWallet() {
    const wallet = await callFunction("ensurePlayer", {});
    setState({ wallet });
    return wallet;
  }

  async function saveProgress(gameKey, payload) {
    await connect();
    const user = requireUser();
    const ref = firestoreApi.doc(db, "gameProgress", user.uid);
    await firestoreApi.setDoc(ref, { uid: user.uid, schemaVersion: 1, [gameKey]: payload || {}, updatedAt: firestoreApi.serverTimestamp() }, { merge: true });
  }

  async function submitLeaderboard(gameKey, stage, score) {
    await connect();
    const user = requireUser();
    const profile = state.profile || await loadProfile();
    const week = new Date().toISOString().slice(0, 10);
    const boardId = `${gameKey}_${week}_${stage}`;
    await firestoreApi.setDoc(firestoreApi.doc(db, "leaderboards", boardId, "entries", user.uid), {
      uid: user.uid, nickname: profile && profile.nickname || "XENA", game: gameKey, week, stage, score: Number(score) || 0, updatedAt: firestoreApi.serverTimestamp(),
    }, { merge: true });
  }

  window.XenaAuth = Object.freeze({
    snapshot,
    connect,
    signIn,
    signOut,
    loadProfile,
    ensureNickname,
    ensureWallet,
    saveProgress,
    submitLeaderboard,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  });
})();
