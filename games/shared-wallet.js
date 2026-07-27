/* XENA GAMES 공용 서버 지갑 (Firestore wallets/{uid}.credits) — 게임제작부서

   ⚠ 미니게임 XC 서버화 1단계.
   기존에는 각 게임이 localStorage 의 xena_wallet_v1.xc 를 직접 더하고 빼서
   "XC"를 표시했다 — 개발자도구로 그 값을 아무 숫자로나 바꿔도 아무도 막을 수 없는
   구조였다. 지금부터 "XC"는 체스(OVERRIDE GRID)가 이미 쓰던 서버 지갑
   wallets/{uid}.credits 를 그대로 공유한다. 실시간 구독(onSnapshot)으로
   모든 페이지의 잔액 표시가 항상 서버 값과 일치한다.

   이번 1단계에서 서버로 옮겨진 것:
     - 데일리 시그널 수령 (+5, 7일 연속 +20) — 연속일수까지 서버가 직접 카운트
     - 데일리 시그널의 5개 퀘스트 보너스 + 전체완료 보너스 (하루 1회로 서버가 제한)
     - 메모리 그리드 / 시그널 링크 스테이지 첫클리어 보상 — submitScore 가 남긴
       "오늘 실제로 클리어했다"는 서버 기록이 있을 때만 지급됨
     - 가챠 XC 결제(추가뽑기 구매, 리셋 비용) — spendCredits 로 잔액 확인 후 차감
   아직 서버로 옮기지 못한 것 (다음 단계):
     - 가챠 뽑기 자체의 등급 추첨 로직 (현재는 클라이언트가 계산 — RNG 조작 방지는 안 됨)
     - 가챠 웰컴보너스/중복분해(dust)
     - 오버라이드 그리드/제나카드/포토월드컵 퀘스트가 "진짜로 오늘 했는지"의 독립 검증
       (지금은 하루 1회 제한만 서버가 걸고, 실제 수행 여부는 아직 클라이언트 신고를 신뢰함)

   <script src="../game/firebase-config.js"></script>
   <script src="../game/cloud-sync.js"></script>
   <script src="../shared-wallet.js"></script>  ← identity/gate 이후 아무 순서에 로드 가능
*/
(function(){
  'use strict';
  var subs = [];
  var balance = null; /* null = 아직 모름(로딩중) */
  var energyPools = {};
  var GUEST_ENERGY_KEY = 'xena_guest_energy_v2';
  var ctxReady = null;
  var unsub = null, energyUnsub = null, energyUiTimer = null;

  function notify(){ subs.forEach(function(fn){ try{ fn(balance); }catch(e){} }); }

  function ctx(){
    if (!window.XenaCloudSync) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
    if (!ctxReady) ctxReady = window.XenaCloudSync.context();
    return ctxReady;
  }

  function callFn(name, data){
    return ctx().then(function(c){
      if (!c.functionsApi || !c.functionsInstance) return Promise.reject(new Error('FUNCTIONS_UNAVAILABLE'));
      return c.functionsApi.httpsCallable(c.functionsInstance, name)(data || {}).then(function(r){ return r.data; });
    });
  }

  function energyFor(game){
    var pool = energyPools[game] || {};
    var guest = guestEnergy(game);
    var stored = typeof pool.energy === 'number' ? pool.energy : guest.energy;
    var updated = pool.energyUpdatedAt && typeof pool.energyUpdatedAt.toMillis === 'function' ? pool.energyUpdatedAt.toMillis() : guest.updatedAt;
    return Math.min(6, stored + Math.floor(Math.max(0, Date.now() - updated) / 600000));
  }

  function readGuestEnergy(){
    try { return JSON.parse(localStorage.getItem(GUEST_ENERGY_KEY) || '{}') || {}; }
    catch(e) { return {}; }
  }
  function guestEnergy(game){
    var all = readGuestEnergy(), raw = all[game] || {};
    return { energy: typeof raw.energy === 'number' ? raw.energy : 6, updatedAt: Number(raw.updatedAt) || Date.now() };
  }
  function consumeGuestEnergy(game){
    var current = guestEnergy(game);
    var available = Math.min(6, current.energy + Math.floor(Math.max(0, Date.now() - current.updatedAt) / 600000));
    if (available < 1) return Promise.reject(new Error('NO_ENERGY'));
    var all = readGuestEnergy();
    all[game] = { energy: available - 1, updatedAt: Date.now() };
    try { localStorage.setItem(GUEST_ENERGY_KEY, JSON.stringify(all)); } catch(e) {}
    energyPools[game] = all[game];
    notify();
    return Promise.resolve({ game:game, energy:available - 1, maxEnergy:6, refillMs:600000, guest:true });
  }

  function startListening(uid){
    if (unsub) { unsub(); unsub = null; }
    if (energyUnsub) { energyUnsub(); energyUnsub = null; }
    ctx().then(function(c){
      var fs = c.firestoreApi, db = c.db;
      var ref = fs.doc(db, 'wallets', uid);
      unsub = fs.onSnapshot(ref, function(snap){
        var v = snap.exists() ? snap.data() : {};
        balance = (typeof v.credits === 'number') ? v.credits : 0;
        notify();
      }, function(){ /* 권한/네트워크 에러는 조용히 무시 — 표시만 못 할 뿐 게임엔 영향 없음 */ });
      energyUnsub = fs.onSnapshot(fs.doc(db, 'energyPools', uid), function(snap){
        energyPools = snap.exists() ? (snap.data().pools || {}) : {};
        notify();
      }, function(){});
    }).catch(function(){});
  }

  function init(){
    if (!window.XenaCloudSync) return;
    window.XenaCloudSync.subscribe(function(snap){
      if (snap.user) startListening(snap.user.uid);
      else { balance = null; energyPools = {}; if (unsub) { unsub(); unsub = null; } if (energyUnsub) { energyUnsub(); energyUnsub = null; } notify(); }
    });
  }
  init();

  function claimWelcomeBonus(){ return callFn('claimWelcomeBonus', {}); }
  function claimGachaDust(grade, count, cardId, idempotencyKey){
    var key = String(idempotencyKey || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + String(Math.random()).slice(2))));
    return callFn('claimGachaDust', {grade: grade, count: count, cardId: cardId, idempotencyKey: key});
  }
  function getStreak(){ return callFn('getWallet', {}).then(function(r){ return r.streak || 0; }); }
  function claimDailySignal(){ return callFn('claimDailySignal', {}); }
  function claimQuestBonus(questId){ return callFn('claimQuestBonus', {questId: questId}); }
  function claimStageReward(game, stage){ return callFn('claimStageReward', {game: game, stage: Number(stage)}); }
  function claimWorldcupFinish(){ return callFn('claimWorldcupFinish', {}); }
  function claimChessMatch(){ return callFn('claimChessMatch', {}); }
  function spend(amount, reason, idempotencyKey){
    var key = String(idempotencyKey || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + String(Math.random()).slice(2))));
    return callFn('spendCredits', {amount: amount, reason: reason||'', idempotencyKey: key});
  }
  function consumeEnergy(game){
    return callFn('consumeEnergy', {game: game}).then(function(result){
      /* Do not wait for Firestore's snapshot round-trip before showing the
         spent gem. The server transaction remains the source of truth. */
      if (result && typeof result.energy === 'number') {
        energyPools[game] = { energy:result.energy, energyUpdatedAt:Date.now() };
        notify();
      }
      return result;
    }).catch(function(error){
      /* Guest play still gets a real per-game six-ticket pool. Signed-in users
         remain server-authoritative; only connection/auth bootstrap failures
         use this device pool so a game never starts without consuming a gem. */
      if (error && (error.code === 'resource-exhausted' || /No energy/i.test(error.message || ''))) throw error;
      return consumeGuestEnergy(game);
    });
  }
  function initEnergyUI(game){
    if(!game) return;
    if (!document.getElementById('xena-energy-style')) {
      var energyStyle = document.createElement('style'); energyStyle.id = 'xena-energy-style';
      energyStyle.textContent = '#xena-global-economy{gap:8px!important;padding:7px!important;border:1px solid rgba(94,239,255,.48)!important;border-radius:16px!important;background:linear-gradient(135deg,rgba(8,13,29,.95),rgba(27,10,43,.94))!important;box-shadow:0 10px 36px rgba(0,0,0,.48),0 0 28px rgba(63,224,255,.18)!important;font-family:Orbitron,"Rajdhani",ui-monospace,monospace!important}.xena-currency-panel,.xena-energy-panel{display:flex;align-items:center;min-height:42px;border:1px solid rgba(255,255,255,.14);border-radius:11px;padding:0 10px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.018));box-shadow:inset 0 0 16px rgba(255,255,255,.025)}#xena-global-economy .xena-xc{font:800 16px/1.1 ui-monospace,monospace;color:#f4d77b;white-space:nowrap}#xena-global-economy .xena-xc:before{content:"XC ";font-size:9px;letter-spacing:.13em;color:#fff3bb;margin-right:4px}.xena-energy-panel:before{content:"ENERGY";font:700 8px/1 ui-monospace,monospace;letter-spacing:.12em;color:#93efff;margin-right:7px}.xena-energy-panel{gap:6px;border-color:rgba(94,239,255,.32)}#xena-global-economy .xena-gems{display:flex;gap:3px;align-items:center;color:#5eefff}#xena-global-economy .xena-gem{display:grid;place-items:center;width:27px;height:30px;filter:drop-shadow(0 0 5px currentColor)}#xena-global-economy .xena-gem.empty{color:#6f7790;opacity:.35;filter:none}#xena-global-economy .xena-gem.filled{color:#5eefff}#xena-global-economy .xena-refill{font:700 10px/1.2 ui-monospace,monospace;color:#b9ff3c;min-width:39px;text-align:right}@media(max-width:600px){#xena-global-economy{top:8px!important;gap:4px!important;padding:5px!important}.xena-currency-panel,.xena-energy-panel{min-height:33px;padding:0 6px}.xena-energy-panel:before{display:none}#xena-global-economy .xena-xc{font-size:12px}#xena-global-economy .xena-gem{width:21px;height:24px}#xena-global-economy .xena-refill{font-size:8px;min-width:27px}}';
      document.head.appendChild(energyStyle);
    }
    var el = document.getElementById('xena-global-economy');
    if(!el){
      el = document.createElement('div'); el.id = 'xena-global-economy';
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:14px;padding:12px 20px;border:1px solid rgba(183,255,60,.55);border-radius:18px;background:rgba(4,6,12,.92);box-shadow:0 0 26px rgba(50,230,239,.22);font:800 18px/1 monospace;color:#f5f7ff;backdrop-filter:blur(12px)';
      document.body.appendChild(el);
    }
    function refillClock(remainingMs){
      var seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      var minutes = Math.floor(seconds / 60);
      return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function render(){
      var n = energyFor(game), pool = energyPools[game] || {};
      var updated = pool.energyUpdatedAt && typeof pool.energyUpdatedAt.toMillis === 'function' ? pool.energyUpdatedAt.toMillis() : Date.now();
      var wait = n >= 6 ? '' : refillClock(600000 - ((Date.now() - updated) % 600000));
      el.innerHTML = '<span style="color:#e8c468">'+(balance === null ? '…' : balance.toLocaleString())+' XC</span><span style="color:#b9ff3c;letter-spacing:2px">'+Array.from({length:6}, function(_,i){ return i<n ? '💎' : '◇'; }).join('')+'</span><small style="color:#b9ff3c;font-size:13px">'+(wait || 'FULL')+'</small>';
      var xcText = balance === null ? '—' : Number(balance).toLocaleString();
      var slots = Array.from({length:6}, function(_,i){ return i < n ? '◆' : '◇'; }).join('');
      var gemSvg = '<svg viewBox="0 0 32 36" width="26" height="29" aria-hidden="true"><path d="M16 1 30 12 24 31 16 35 8 31 2 12Z" fill="currentColor" opacity=".22"/><path d="M16 1 30 12 16 16 2 12Z" fill="currentColor" opacity=".95"/><path d="M2 12 16 16 16 35 8 31Z" fill="currentColor" opacity=".62"/><path d="M30 12 16 16 16 35 24 31Z" fill="currentColor" opacity=".8"/></svg>';
      var gems = Array.from({length:6}, function(_,i){ return '<span class="xena-gem '+(i < n ? 'filled' : 'empty')+'">'+gemSvg+'</span>'; }).join('');
      el.innerHTML = '<div class="xena-currency-panel"><span class="xena-xc">'+(balance === null ? '--' : String(balance))+'</span></div><div class="xena-energy-panel"><span class="xena-gems">'+gems+'</span><small class="xena-refill">'+(wait || 'FULL')+'</small></div>';
    }
    render(); if(energyUiTimer) clearInterval(energyUiTimer); energyUiTimer = setInterval(render, 1000);
    if (window.XenaWallet && typeof window.XenaWallet.subscribe === 'function') window.XenaWallet.subscribe(function(){ render(); });
    setTimeout(function(){
      var hud = document.getElementById('xena-global-economy');
      if (!hud || hud.querySelector('.xena-gem')) return;
      var current = energyFor(game), svg = '<svg viewBox="0 0 32 36" width="26" height="29" aria-hidden="true"><path d="M16 1 30 12 24 31 16 35 8 31 2 12Z" fill="currentColor" opacity=".22"/><path d="M16 1 30 12 16 16 2 12Z" fill="currentColor" opacity=".95"/><path d="M2 12 16 16 16 35 8 31Z" fill="currentColor" opacity=".62"/><path d="M30 12 16 16 16 35 24 31Z" fill="currentColor" opacity=".8"/></svg>';
      var gems = Array.from({length:6}, function(_,i){ return '<span class="xena-gem '+(i < current ? 'filled' : 'empty')+'">'+svg+'</span>'; }).join('');
      var xc = hud.querySelector('.xena-xc'); if (!xc) { var first = hud.firstElementChild; if (first) first.className = 'xena-xc'; }
      var balanceText = hud.querySelector('.xena-xc');
      hud.innerHTML = '<div class="xena-currency-panel"><span class="xena-xc">'+(balance === null ? '--' : String(balance))+'</span></div><div class="xena-energy-panel"><span class="xena-gems">'+gems+'</span><small class="xena-refill">'+(current >= 6 ? 'FULL' : 'REFILL')+'</small></div>';
    }, 0);
  }

  /* ── SIGNAL CLASH (TCG) / LIVE TOUR (방치형 디스패치) — 2026-07-22 추가 ── */
  function claimTcgMatch(difficulty, outcome){ return callFn('claimTcgMatch', {difficulty: difficulty, outcome: outcome}); }
  function unlockCity(city){ return callFn('unlockCity', {city: city}); }
  function upgradeTourCapacity(){ return callFn('upgradeTourCapacity', {}); }
  function startTour(city, grades, elements){ return callFn('startTour', {city: city, grades: grades, elements: elements || []}); }
  function claimTourReward(city){ return callFn('claimTourReward', {city: city}); }
  function cancelTour(city){ return callFn('cancelTour', {city: city}); }
  function getTours(){ return callFn('getTours', {}).then(function(r){ return r.tours || {}; }); }
  function getWalletFull(){ return callFn('getWallet', {}); }
  /* XENA MERGE — 점수 비례 XC + 주간 랭킹 */
  function claimMergeScore(score){ return callFn('claimMergeScore', {score: Math.floor(score)}); }
  function getMergeLeaderboard(){ return callFn('getMergeLeaderboard', {}); }
  function submitFeedback(text, category, language){ return callFn('submitFeedback', {text:text, category:category || 'general', language:language || 'en'}); }
  function adminListFeedback(){ return callFn('adminListFeedback', {}); }
  function adminDeleteFeedback(id){ return callFn('adminDeleteFeedback', {id:id}); }
  /* Stripe 결제창 열기 → 결제 성공 시 서버(fulfillCheckoutSession)가 지갑에 크레딧을 넣는다.
     returnPath 는 결제 후 돌아올 페이지 (예: '/games/gacha/'). 유효하지 않으면 서버가 '/game/' 로 fallback. */
  function purchase(productId, returnPath){
    var orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    return callFn('createCheckoutSession', {productId: productId, orderId: orderId, returnPath: returnPath || '/game/'})
      .then(function(r){ if (r && r.url) window.location.href = r.url; return r; });
  }

  window.XenaWallet = {
    getBalance: function(){ return balance; }, /* null = 로딩중 */
    subscribe: function(fn){ subs.push(fn); if (balance !== null) fn(balance); return function(){ subs = subs.filter(function(x){return x!==fn;}); }; },
    getStreak: getStreak,
    claimWelcomeBonus: claimWelcomeBonus,
    claimGachaDust: claimGachaDust,
    claimDailySignal: claimDailySignal,
    claimQuestBonus: claimQuestBonus,
    claimStageReward: claimStageReward,
    claimWorldcupFinish: claimWorldcupFinish,
    claimChessMatch: claimChessMatch,
    spend: spend,
    consumeEnergy: consumeEnergy,
    getEnergy: energyFor,
    initEnergyUI: initEnergyUI,
    purchase: purchase,
    claimTcgMatch: claimTcgMatch,
    unlockCity: unlockCity,
    upgradeTourCapacity: upgradeTourCapacity,
    startTour: startTour,
    claimTourReward: claimTourReward,
    cancelTour: cancelTour,
    getTours: getTours,
    getWalletFull: getWalletFull,
    claimMergeScore: claimMergeScore,
    getMergeLeaderboard: getMergeLeaderboard,
    submitFeedback: submitFeedback,
    adminListFeedback: adminListFeedback,
    adminDeleteFeedback: adminDeleteFeedback
  };
})();
