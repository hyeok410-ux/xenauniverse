(function () {
  "use strict";

  const SDK_VERSION = "12.15.0";
  const listeners = new Set();
  const config = window.XenaFirebaseConfig || {};
  const configured = Boolean(config.enabled && config.apiKey && config.authDomain && config.projectId && config.appId);
  const state = {
    configured,
    phase: configured ? "idle" : "disabled",
    user: null,
    error: "",
    remoteExists: null,
    lastSyncedAt: "",
  };

  let sdkPromise = null;
  let auth = null;
  let db = null;
  let provider = null;
  let authApi = null;
  let firestoreApi = null;

  function publicUser(user) {
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
    };
  }

  function snapshot() {
    return {
      configured: state.configured,
      phase: state.phase,
      user: state.user ? { ...state.user } : null,
      error: state.error,
      remoteExists: state.remoteExists,
      lastSyncedAt: state.lastSyncedAt,
    };
  }

  function notify() {
    const next = snapshot();
    listeners.forEach((listener) => {
      try { listener(next); } catch (_) { /* UI listeners must not stop sync. */ }
    });
  }

  function setState(next) {
    Object.assign(state, next);
    notify();
  }

  function friendlyError(error) {
    const code = String(error && error.code || "");
    if (code.includes("popup-closed")) return "LOGIN_CANCELLED";
    if (code.includes("popup-blocked")) return "POPUP_BLOCKED";
    if (code.includes("unauthorized-domain")) return "UNAUTHORIZED_DOMAIN";
    if (code.includes("permission-denied")) return "PERMISSION_DENIED";
    if (code.includes("network-request-failed") || code.includes("unavailable")) return "NETWORK_ERROR";
    return "CLOUD_ERROR";
  }

  async function connect() {
    if (!configured) return snapshot();
    if (sdkPromise) return sdkPromise;

    setState({ phase: "connecting", error: "" });
    sdkPromise = (async () => {
      try {
        const [appModule, authModule, firestoreModule] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        ]);
        const app = appModule.initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          appId: config.appId,
        });
        authApi = authModule;
        firestoreApi = firestoreModule;
        auth = authModule.getAuth(app);
        db = firestoreModule.getFirestore(app);
        provider = new authModule.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        await new Promise((resolve) => {
          let first = true;
          authModule.onAuthStateChanged(auth, (user) => {
            setState({
              phase: user ? "signed-in" : "signed-out",
              user: publicUser(user),
              error: "",
              remoteExists: user ? state.remoteExists : null,
            });
            if (first) {
              first = false;
              resolve();
            }
          });
        });
        return snapshot();
      } catch (error) {
        sdkPromise = null;
        setState({ phase: "error", error: friendlyError(error) });
        throw error;
      }
    })();
    return sdkPromise;
  }

  async function signIn() {
    await connect();
    setState({ phase: "signing-in", error: "" });
    try {
      const result = await authApi.signInWithPopup(auth, provider);
      setState({ phase: "signed-in", user: publicUser(result.user), error: "" });
      return snapshot();
    } catch (error) {
      setState({ phase: auth && auth.currentUser ? "signed-in" : "signed-out", error: friendlyError(error) });
      throw error;
    }
  }

  async function signOut() {
    await connect();
    await authApi.signOut(auth);
    setState({ phase: "signed-out", user: null, error: "", remoteExists: null, lastSyncedAt: "" });
  }

  function requireUser() {
    if (!auth || !auth.currentUser) throw new Error("AUTH_REQUIRED");
    return auth.currentUser;
  }

  async function load() {
    await connect();
    const user = requireUser();
    setState({ phase: "loading", error: "" });
    try {
      const reference = firestoreApi.doc(db, "players", user.uid);
      const result = await firestoreApi.getDoc(reference);
      if (!result.exists()) {
        setState({ phase: "signed-in", remoteExists: false, lastSyncedAt: "" });
        return null;
      }
      const data = result.data();
      if (data.schemaVersion !== 1 || typeof data.saveCode !== "string") throw new Error("UNSUPPORTED_CLOUD_SAVE");
      setState({ phase: "signed-in", remoteExists: true, lastSyncedAt: data.clientUpdatedAt || "" });
      return { saveCode: data.saveCode, clientUpdatedAt: data.clientUpdatedAt || "" };
    } catch (error) {
      setState({ phase: "signed-in", error: friendlyError(error) });
      throw error;
    }
  }

  async function save(saveCode) {
    if (typeof saveCode !== "string" || !saveCode.trim()) throw new Error("INVALID_SAVE_CODE");
    await connect();
    const user = requireUser();
    setState({ phase: "saving", error: "" });
    const clientUpdatedAt = new Date().toISOString();
    try {
      const reference = firestoreApi.doc(db, "players", user.uid);
      await firestoreApi.setDoc(reference, {
        uid: user.uid,
        schemaVersion: 1,
        saveCode,
        clientUpdatedAt,
        updatedAt: firestoreApi.serverTimestamp(),
      });
      setState({ phase: "signed-in", remoteExists: true, lastSyncedAt: clientUpdatedAt });
      return snapshot();
    } catch (error) {
      setState({ phase: "signed-in", error: friendlyError(error) });
      throw error;
    }
  }

  async function context() {
    await connect();
    return { auth, db, authApi, firestoreApi };
  }

  window.XenaCloudSync = Object.freeze({
    snapshot,
    connect,
    signIn,
    signOut,
    load,
    save,
    context,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  });
})();
