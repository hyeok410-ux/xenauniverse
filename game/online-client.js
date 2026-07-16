(function () {
  "use strict";

  const snapshot = Object.freeze({
    status: "offline",
    lastError: "STATIC_WEB_PROTOTYPE",
  });

  window.OverrideGridOnline = {
    connect() { return false; },
    send() { return false; },
    snapshot() { return snapshot; },
    subscribe(listener) {
      if (typeof listener === "function") listener(snapshot);
      return function unsubscribe() {};
    },
  };
})();
