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
  var ctxReady = null;
  var unsub = null;

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

  function startListening(uid){
    if (unsub) { unsub(); unsub = null; }
    ctx().then(function(c){
      var fs = c.firestoreApi, db = c.db;
      var ref = fs.doc(db, 'wallets', uid);
      unsub = fs.onSnapshot(ref, function(snap){
        var v = snap.exists() ? snap.data() : {};
        balance = (typeof v.credits === 'number') ? v.credits : 0;
        notify();
      }, function(){ /* 권한/네트워크 에러는 조용히 무시 — 표시만 못 할 뿐 게임엔 영향 없음 */ });
    }).catch(function(){});
  }

  function init(){
    if (!window.XenaCloudSync) return;
    window.XenaCloudSync.subscribe(function(snap){
      if (snap.user) startListening(snap.user.uid);
      else { balance = null; if (unsub) { unsub(); unsub = null; } notify(); }
    });
  }
  init();

  function claimWelcomeBonus(){ return callFn('claimWelcomeBonus', {}); }
  function claimGachaDust(grade, count){ return callFn('claimGachaDust', {grade: grade, count: count}); }
  function getStreak(){ return callFn('getWallet', {}).then(function(r){ return r.streak || 0; }); }
  function claimDailySignal(){ return callFn('claimDailySignal', {}); }
  function claimQuestBonus(questId){ return callFn('claimQuestBonus', {questId: questId}); }
  function claimStageReward(game, stage){ return callFn('claimStageReward', {game: game, stage: Number(stage)}); }
  function claimWorldcupFinish(){ return callFn('claimWorldcupFinish', {}); }
  function claimChessMatch(){ return callFn('claimChessMatch', {}); }
  function spend(amount, reason){ return callFn('spendCredits', {amount: amount, reason: reason||''}); }

  /* ── SIGNAL CLASH (TCG) / LIVE TOUR (방치형 디스패치) — 2026-07-22 추가 ── */
  function claimTcgMatch(difficulty, outcome){ return callFn('claimTcgMatch', {difficulty: difficulty, outcome: outcome}); }
  function unlockCity(city){ return callFn('unlockCity', {city: city}); }
  function upgradeTourCapacity(){ return callFn('upgradeTourCapacity', {}); }
  function startTour(city, grades, elements){ return callFn('startTour', {city: city, grades: grades, elements: elements || []}); }
  function claimTourReward(city){ return callFn('claimTourReward', {city: city}); }
  function cancelTour(city){ return callFn('cancelTour', {city: city}); }
  function getTours(){ return callFn('getTours', {}).then(function(r){ return r.tours || {}; }); }
  function getWalletFull(){ return callFn('getWallet', {}); }
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
    purchase: purchase,
    claimTcgMatch: claimTcgMatch,
    unlockCity: unlockCity,
    upgradeTourCapacity: upgradeTourCapacity,
    startTour: startTour,
    claimTourReward: claimTourReward,
    cancelTour: cancelTour,
    getTours: getTours,
    getWalletFull: getWalletFull
  };
})();
