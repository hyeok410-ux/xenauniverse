/* Mobile battle immersion: request fullscreen first (must happen in a user
   gesture), then lock landscape when the browser supports Screen Orientation. */
(function (global) {
  'use strict';

  function isMobile() {
    return global.matchMedia && global.matchMedia('(max-width: 920px), (pointer: coarse)').matches;
  }
  function lockLandscape() {
    try {
      if (global.screen && global.screen.orientation && global.screen.orientation.lock) {
        return global.screen.orientation.lock('landscape').catch(function () { return false; });
      }
    } catch (_) {}
    return Promise.resolve(false);
  }
  function enter() {
    if (!isMobile()) return Promise.resolve(false);
    document.documentElement.classList.add('xena-immersive');
    var root = document.documentElement;
    var request = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    try {
      if (request) {
        var result = request.call(root);
        if (result && result.then) return result.then(lockLandscape).catch(lockLandscape);
      }
    } catch (_) {}
    return lockLandscape();
  }
  function exit() {
    document.documentElement.classList.remove('xena-immersive');
    try {
      if (global.screen && global.screen.orientation && global.screen.orientation.unlock) global.screen.orientation.unlock();
      if (document.fullscreenElement && document.exitFullscreen) return document.exitFullscreen().catch(function () {});
      if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {}
    return Promise.resolve();
  }
  global.addEventListener('pagehide', exit);
  global.XenaMobileImmersive = { enter: enter, exit: exit, isMobile: isMobile };
}(window));
