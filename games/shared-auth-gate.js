/*
 * XENA GAMES account gate
 *
 * Load this after firebase-config.js, cloud-sync.js and shared-identity.js on
 * every playable game page. The overlay blocks both pointer and keyboard
 * interaction until Firebase reports a signed-in Google account.
 */
(function () {
  'use strict';

  if (window.XenaGamesAuthGate) return;

  var unlocked = false;
  var listeners = [];
  var savedBodyOverflow = null;

  var regionLanguage = null;
  function fallbackLanguage() {
    var zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    var browserLanguage = String(navigator.language || '').toLowerCase();
    return (browserLanguage.indexOf('ko') === 0 || zone === 'Asia/Seoul') ? 'ko' : 'en';
  }
  function isEnglish() { return (regionLanguage || fallbackLanguage()) === 'en'; }
  function copy(ko, en) { return isEnglish() ? en : ko; }
  function emit() {
    listeners.slice().forEach(function (listener) {
      try { listener({ unlocked: unlocked }); } catch (_) { /* isolated consumer */ }
    });
  }

  var style = document.createElement('style');
  style.id = 'xena-auth-gate-style';
  style.textContent =
    '#xena-auth-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 38%,rgba(103,63,180,.26),transparent 36%),rgba(4,5,13,.97);backdrop-filter:blur(13px);color:#fff;text-align:center}'+
    '#xena-auth-gate[hidden]{display:none!important}'+
    '.xena-auth-card{width:min(390px,100%);padding:32px 28px;border:1px solid rgba(74,230,255,.48);border-radius:22px;background:linear-gradient(145deg,rgba(21,19,42,.98),rgba(7,9,21,.98));box-shadow:0 0 0 1px rgba(190,108,255,.1) inset,0 20px 80px rgba(0,0,0,.5)}'+
    '.xena-auth-mark{margin-bottom:14px;font:700 11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.34em;color:#4ae6ff;text-shadow:0 0 18px rgba(74,230,255,.75)}'+
    '.xena-auth-card h1{margin:0 0 11px;font:800 clamp(22px,6vw,29px)/1.18 system-ui,sans-serif;letter-spacing:-.04em}'+
    '.xena-auth-card p{margin:0 0 24px;color:#c7c4dc;font:14px/1.65 system-ui,sans-serif}'+
    '#xena-auth-gate-login{min-height:48px;width:100%;border:0;border-radius:14px;background:linear-gradient(110deg,#54e8ff,#bf7bff);box-shadow:0 9px 25px rgba(103,205,255,.25);color:#0b0920;font:800 14px/1 system-ui,sans-serif;cursor:pointer}'+
    '#xena-auth-gate-login:disabled{opacity:.62;cursor:wait}'+
    '#xena-auth-gate-status{min-height:18px;margin:13px 0 0;color:#ff9ab3;font:12px/1.4 system-ui,sans-serif}'+
    '.xena-auth-spinner{display:inline-block;width:18px;height:18px;border:2px solid rgba(74,230,255,.24);border-top-color:#4ae6ff;border-radius:50%;vertical-align:-4px;margin-right:8px;animation:xenaAuthSpin .8s linear infinite}'+
    '@keyframes xenaAuthSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  var gate = document.createElement('section');
  gate.id = 'xena-auth-gate';
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('role', 'dialog');
  gate.innerHTML =
    '<div class="xena-auth-card">' +
      '<div class="xena-auth-mark">XENA GAMES</div>' +
      '<h1 id="xena-auth-gate-title"></h1>' +
      '<p id="xena-auth-gate-message"></p>' +
      '<button id="xena-auth-gate-login" type="button"></button>' +
      '<div id="xena-auth-gate-status" role="status" aria-live="polite"></div>' +
    '</div>';
  /* Keep the dialog outside <body> so body can be made inert while locked.
     This blocks keyboard focus from reaching a game behind the overlay too. */
  document.documentElement.appendChild(gate);

  var title = document.getElementById('xena-auth-gate-title');
  var message = document.getElementById('xena-auth-gate-message');
  var button = document.getElementById('xena-auth-gate-login');
  var status = document.getElementById('xena-auth-gate-status');

  /* The login gate follows the visitor's country rather than the language
     selected in the hub. Korea receives Korean; the United States and every
     other country receive English. A timezone/browser-language fallback keeps
     the screen usable when the short country lookup is unavailable. */
  (function resolveCountryLanguage(){
    var cacheKey = 'xena_gate_country_v1';
    var fallback = fallbackLanguage();
    try {
      var saved = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (saved && saved.code && saved.expiresAt > Date.now()) {
        regionLanguage = String(saved.code).toUpperCase() === 'KR' ? 'ko' : 'en';
        return;
      }
    } catch (_) {}
    var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 1800); });
    Promise.race([
      fetch('https://api.country.is/', { cache: 'no-store' }).then(function(response){ return response.ok ? response.json() : null; }).catch(function(){ return null; }),
      timeout
    ]).then(function(data){
      var code = String(data && data.country || '').toUpperCase();
      regionLanguage = code ? (code === 'KR' ? 'ko' : 'en') : fallback;
      if (code) try { sessionStorage.setItem(cacheKey, JSON.stringify({ code: code, expiresAt: Date.now() + 86400000 })); } catch (_) {}
      if (!unlocked) renderLocked('ready');
    });
  })();

  function renderLocked(kind) {
    title.textContent = copy('로그인 후 플레이할 수 있습니다', 'Sign in to play');
    message.textContent = copy('XENA Games의 모든 플레이 기록과 카드 컬렉션은 Google 계정에 안전하게 연결됩니다.', 'Your XENA Games records and card collection are securely linked to your Google account.');
    button.textContent = copy('Google로 로그인', 'Continue with Google');
    status.innerHTML = kind === 'checking' ? '<span class="xena-auth-spinner"></span>' + copy('로그인 상태를 확인하고 있습니다', 'Checking your sign-in…') : '';
    gate.hidden = false;
  }

  function setLocked(kind) {
    var changed = unlocked;
    unlocked = false;
    renderLocked(kind || 'ready');
    if (savedBodyOverflow === null) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    /* Set both the reflected property and the attribute.  Some embedded
       mobile WebViews expose the attribute before exposing HTMLElement.inert;
       either way, focus must not escape to the locked game behind the modal. */
    document.body.inert = true;
    document.body.setAttribute('inert', '');
    if (changed) emit();
  }

  function setUnlocked() {
    if (!unlocked) {
      unlocked = true;
      emit();
    }
    gate.hidden = true;
    if (savedBodyOverflow !== null) {
      document.body.style.overflow = savedBodyOverflow;
      savedBodyOverflow = null;
    }
    document.body.inert = false;
    document.body.removeAttribute('inert');
  }

  function evaluate(identity) {
    if (identity && identity.signedIn) setUnlocked();
    else setLocked('ready');
  }

  function eventShouldBeBlocked(event) {
    return !unlocked && !gate.contains(event.target);
  }
  ['pointerdown', 'click', 'dblclick', 'contextmenu', 'submit', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      if (!eventShouldBeBlocked(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });

  button.addEventListener('click', function () {
    if (!window.XenaIdentity || typeof window.XenaIdentity.signIn !== 'function') {
      status.textContent = copy('로그인 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.', 'The sign-in module could not be loaded. Please refresh this page.');
      return;
    }
    button.disabled = true;
    status.innerHTML = '<span class="xena-auth-spinner"></span>' + copy('Google 로그인 창을 열고 있습니다', 'Opening Google sign-in…');
    window.XenaIdentity.signIn().catch(function (error) {
      var code = String(error && (error.code || error.message) || '');
      status.textContent = code.indexOf('popup') >= 0
        ? copy('로그인 창이 닫혔거나 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.', 'The sign-in popup was closed or blocked. Allow popups and try again.')
        : copy('로그인에 실패했습니다. 네트워크 연결을 확인해 주세요.', 'Sign-in failed. Check your network and try again.');
    }).finally(function () { button.disabled = false; });
  });

  function bindIdentity() {
    if (!window.XenaIdentity || typeof window.XenaIdentity.subscribe !== 'function') {
      setTimeout(bindIdentity, 50);
      return;
    }
    window.XenaIdentity.subscribe(evaluate);
    evaluate(window.XenaIdentity.getState && window.XenaIdentity.getState());
  }

  var redirectingAfterSignOut = false;
  window.addEventListener('xena:session-cleared', function () {
    setLocked('ready');
    /* Most legacy game scripts keep their save object in memory.  A return to
       the guarded hub guarantees that a fresh sign-in cannot reveal a stale
       deck, collection, profile or score from the previous account. */
    if (redirectingAfterSignOut) return;
    redirectingAfterSignOut = true;
    window.setTimeout(function () {
      if (window.location.pathname === '/games/' || /\/games\/index\.html$/.test(window.location.pathname)) window.location.reload();
      else window.location.replace('/games/');
    }, 0);
  });
  window.addEventListener('pageshow', function () {
    evaluate(window.XenaIdentity && window.XenaIdentity.getState && window.XenaIdentity.getState());
  });

  window.XenaGamesAuthGate = Object.freeze({
    isUnlocked: function () { return unlocked; },
    requireAuth: function () {
      if (unlocked) return true;
      setLocked('ready');
      return false;
    },
    subscribe: function (listener) {
      listeners.push(listener);
      listener({ unlocked: unlocked });
      return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
    }
  });

  setLocked('checking');
  bindIdentity();
})();
