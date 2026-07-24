(function () {
  "use strict";

  const ROOM_STORAGE_KEY = "og_online_room";
  const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const listeners = new Set();
  const state = {
    status: "offline",
    lastError: "",
    roomCode: "",
    role: "",
    color: "",
    room: null,
  };

  let roomUnsubscribe = null;
  let cloudContext = null;

  function snapshot() {
    return {
      status: state.status,
      lastError: state.lastError,
      roomCode: state.roomCode,
      role: state.role,
      color: state.color,
      room: state.room ? { ...state.room } : null,
    };
  }

  function notify(next) {
    Object.assign(state, next || {});
    const value = snapshot();
    listeners.forEach((listener) => {
      try { listener(value); } catch (_) { /* UI listeners must not break room sync. */ }
    });
  }

  function errorCode(error) {
    const code = String(error && (error.code || error.message) || "");
    if (code.includes("ROOM_NOT_FOUND")) return "ROOM_NOT_FOUND";
    if (code.includes("ROOM_FULL")) return "ROOM_FULL";
    if (code.includes("ROOM_FINISHED")) return "ROOM_FINISHED";
    if (code.includes("NOT_YOUR_TURN")) return "NOT_YOUR_TURN";
    if (code.includes("REVISION_CONFLICT")) return "REVISION_CONFLICT";
    if (code.includes("permission-denied")) return "PERMISSION_DENIED";
    if (code.includes("unavailable") || code.includes("network")) return "NETWORK_ERROR";
    return "ONLINE_ERROR";
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, "").slice(0, 8);
  }

  function createCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  }

  function currentUser() {
    return cloudContext && cloudContext.auth && cloudContext.auth.currentUser;
  }

  function roomExpired(room) {
    if (!room || !room.expiresAt) return false;
    const milliseconds = typeof room.expiresAt.toMillis === "function" ? room.expiresAt.toMillis() : new Date(room.expiresAt).getTime();
    return Number.isFinite(milliseconds) && milliseconds <= Date.now();
  }

  async function connect() {
    const cloud = window.XenaCloudSync;
    if (!cloud || !cloud.snapshot().configured) {
      notify({ status: "offline", lastError: "CLOUD_NOT_CONFIGURED" });
      return snapshot();
    }
    notify({ status: "connecting", lastError: "" });
    try {
      cloudContext = await cloud.context();
      if (!currentUser()) {
        notify({ status: "auth-required", lastError: "LOGIN_REQUIRED" });
        return snapshot();
      }
      notify({ status: "connected", lastError: "" });
      const savedRoom = normalizeCode(localStorage.getItem(ROOM_STORAGE_KEY));
      if (savedRoom && !state.roomCode) await openRoom(savedRoom, { reconnect: true });
      return snapshot();
    } catch (error) {
      notify({ status: "offline", lastError: errorCode(error) });
      throw error;
    }
  }

  function roomReference(code) {
    return cloudContext.firestoreApi.doc(cloudContext.db, "matches", code);
  }

  function watchRoom(code) {
    if (roomUnsubscribe) roomUnsubscribe();
    const reference = roomReference(code);
    roomUnsubscribe = cloudContext.firestoreApi.onSnapshot(reference, (documentSnapshot) => {
      if (!documentSnapshot.exists()) {
        localStorage.removeItem(ROOM_STORAGE_KEY);
        notify({ status: "connected", roomCode: "", role: "", color: "", room: null, lastError: "ROOM_NOT_FOUND" });
        return;
      }
      const room = documentSnapshot.data();
      const uid = currentUser() && currentUser().uid;
      const role = room.hostUid === uid ? "host" : room.guestUid === uid ? "guest" : "spectator";
      const color = room.whiteUid === uid ? "white" : room.blackUid === uid ? "black" : "";
      if (role !== "spectator") localStorage.setItem(ROOM_STORAGE_KEY, code);
      notify({ status: room.status === "waiting" ? "waiting" : room.status, roomCode: code, role, color, room, lastError: "" });
    }, (error) => {
      notify({ status: "connected", lastError: errorCode(error) });
    });
  }

  async function openRoom(value, options = {}) {
    if (!cloudContext || !currentUser()) await connect();
    const code = normalizeCode(value);
    if (code.length !== 8) throw new Error("ROOM_NOT_FOUND");
    const reference = roomReference(code);
    const user = currentUser();
    try {
      await cloudContext.firestoreApi.runTransaction(cloudContext.db, async (transaction) => {
        const roomSnapshot = await transaction.get(reference);
        if (!roomSnapshot.exists()) throw new Error("ROOM_NOT_FOUND");
        const room = roomSnapshot.data();
        if (roomExpired(room)) throw new Error("ROOM_FINISHED");
        if (room.status === "finished" || room.status === "cancelled") throw new Error("ROOM_FINISHED");
        if (room.hostUid === user.uid || room.guestUid === user.uid) return;
        if (options.reconnect) throw new Error("ROOM_NOT_FOUND");
        if (room.guestUid) throw new Error("ROOM_FULL");
        transaction.update(reference, {
          guestUid: user.uid,
          blackUid: user.uid,
          status: "active",
          updatedAt: cloudContext.firestoreApi.serverTimestamp(),
        });
      });
      watchRoom(code);
      return snapshot();
    } catch (error) {
      localStorage.removeItem(ROOM_STORAGE_KEY);
      notify({ status: "connected", lastError: errorCode(error) });
      throw error;
    }
  }

  async function createRoom(payload) {
    if (!cloudContext || !currentUser()) await connect();
    const user = currentUser();
    if (!user) throw new Error("LOGIN_REQUIRED");
    let code = createCode();
    let reference = roomReference(code);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await cloudContext.firestoreApi.getDoc(reference);
      if (!existing.exists()) break;
      code = createCode();
      reference = roomReference(code);
    }
    const enemyPack = payload.pack === "xena" ? "sovran" : "xena";
    const room = {
      schemaVersion: 1,
      code,
      status: "waiting",
      hostUid: user.uid,
      guestUid: null,
      whiteUid: user.uid,
      blackUid: null,
      whitePack: payload.pack,
      blackPack: enemyPack,
      timeRule: payload.timeRule,
      stateJson: JSON.stringify(payload.gameState),
      clocks: payload.clocks,
      turnUid: user.uid,
      revision: 0,
      lastAction: null,
      lastActorUid: null,
      winnerColor: null,
      finishReason: null,
      emote: null,
      createdAt: cloudContext.firestoreApi.serverTimestamp(),
      updatedAt: cloudContext.firestoreApi.serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
    try {
      await cloudContext.firestoreApi.setDoc(reference, room);
      watchRoom(code);
      return code;
    } catch (error) {
      notify({ status: "connected", lastError: errorCode(error) });
      throw error;
    }
  }

  async function submit(payload) {
    if (!state.roomCode || !state.room) throw new Error("ROOM_NOT_FOUND");
    const reference = roomReference(state.roomCode);
    const user = currentUser();
    try {
      await cloudContext.firestoreApi.runTransaction(cloudContext.db, async (transaction) => {
        const roomSnapshot = await transaction.get(reference);
        if (!roomSnapshot.exists()) throw new Error("ROOM_NOT_FOUND");
        const room = roomSnapshot.data();
        if (room.status !== "active") throw new Error("ROOM_FINISHED");
        if (room.turnUid !== user.uid) throw new Error("NOT_YOUR_TURN");
        if (room.revision !== payload.expectedRevision) throw new Error("REVISION_CONFLICT");
        const nextTurnUid = payload.gameState.turn === "white" ? room.whiteUid : room.blackUid;
        const update = {
          stateJson: JSON.stringify(payload.gameState),
          clocks: payload.clocks,
          turnUid: nextTurnUid,
          revision: room.revision + 1,
          status: payload.finished ? "finished" : "active",
          lastAction: payload.action || null,
          lastActorUid: user.uid,
          updatedAt: cloudContext.firestoreApi.serverTimestamp(),
        };
        if (payload.finished) {
          update.winnerColor = payload.winnerColor || "draw";
          update.finishReason = payload.finishReason || "game-over";
        }
        transaction.update(reference, update);
      });
      return true;
    } catch (error) {
      notify({ lastError: errorCode(error) });
      throw error;
    }
  }

  async function send(message) {
    if (!state.roomCode || !state.room || message.type !== "game.emote") return false;
    const user = currentUser();
    try {
      await cloudContext.firestoreApi.updateDoc(roomReference(state.roomCode), {
        emote: { id: message.emoteId, uid: user.uid, nonce: Date.now() },
        updatedAt: cloudContext.firestoreApi.serverTimestamp(),
      });
      return true;
    } catch (error) {
      notify({ lastError: errorCode(error) });
      return false;
    }
  }

  async function resign() {
    if (!state.roomCode || !state.room || state.room.status !== "active") return false;
    const reference = roomReference(state.roomCode);
    const user = currentUser();
    try {
      await cloudContext.firestoreApi.runTransaction(cloudContext.db, async (transaction) => {
        const roomSnapshot = await transaction.get(reference);
        if (!roomSnapshot.exists()) throw new Error("ROOM_NOT_FOUND");
        const room = roomSnapshot.data();
        if (room.status !== "active") throw new Error("ROOM_FINISHED");
        const color = room.whiteUid === user.uid ? "white" : room.blackUid === user.uid ? "black" : "";
        if (!color) throw new Error("PERMISSION_DENIED");
        transaction.update(reference, {
          status: "finished",
          winnerColor: color === "white" ? "black" : "white",
          finishReason: "resignation",
          revision: room.revision + 1,
          lastAction: { kind: "resign", color },
          lastActorUid: user.uid,
          updatedAt: cloudContext.firestoreApi.serverTimestamp(),
        });
      });
      return true;
    } catch (error) {
      notify({ lastError: errorCode(error) });
      return false;
    }
  }

  async function leave() {
    if (state.roomCode && state.room && state.role === "host" && state.room.status === "waiting" && cloudContext) {
      try {
        await cloudContext.firestoreApi.updateDoc(roomReference(state.roomCode), {
          status: "cancelled",
          updatedAt: cloudContext.firestoreApi.serverTimestamp(),
        });
      } catch (_) { /* Expiration cleanup can remove an abandoned waiting room later. */ }
    }
    if (roomUnsubscribe) roomUnsubscribe();
    roomUnsubscribe = null;
    localStorage.removeItem(ROOM_STORAGE_KEY);
    notify({ status: currentUser() ? "connected" : "auth-required", roomCode: "", role: "", color: "", room: null, lastError: "" });
  }

  window.OverrideGridOnline = Object.freeze({
    connect,
    createRoom,
    joinRoom: openRoom,
    submit,
    resign,
    send,
    leave,
    normalizeCode,
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  });
})();
