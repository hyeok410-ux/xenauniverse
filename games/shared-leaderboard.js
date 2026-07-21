/* XENA GAMES 공용 주간 랭킹 (Firebase Firestore + Cloud Functions) — 게임제작부서
   경로: leaderboards/{game}_{week}_s{stage}/entries/{uid}

   ⚠ 기록 제출은 더 이상 클라이언트가 직접 Firestore 에 쓰지 않는다.
     서버(functions/index.js 의 submitScore)가 스테이지별 물리적 최소/최대 시간과
     대조해 조작된 기록을 거부한 뒤에만 저장한다 (firestore.rules 도 클라이언트
     직접 쓰기를 전부 막아둠 — 이 파일이 우회할 방법은 없다).
   읽기는 누구나(비로그인 포함) 가능.
   Firebase 실패는 전부 삼켜서 게임 진행에 영향을 주지 않는다.
*/
(function(){
  var READY = null;
  var ALLOWED_GAMES = ['memory', 'shisen'];

  function weekKey(){
    var d = new Date();
    var onejan = new Date(d.getFullYear(), 0, 1);
    var wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + wk;
  }

  function boardId(game, stage){
    return game + '_' + weekKey() + '_s' + stage;
  }

  function available(){
    return !!(window.XenaCloudSync && window.XenaFirebaseConfig && window.XenaFirebaseConfig.enabled);
  }

  function ctx(){
    if (!available()) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
    if (!READY) READY = window.XenaCloudSync.context();
    return READY;
  }

  function currentUser(){
    try{
      var s = window.XenaCloudSync.snapshot();
      return s && s.user ? s.user : null;
    }catch(e){ return null; }
  }

  function callFn(name, data){
    return ctx().then(function(c){
      if (!c.functionsApi || !c.functionsInstance) return Promise.reject(new Error('FUNCTIONS_UNAVAILABLE'));
      var callable = c.functionsApi.httpsCallable(c.functionsInstance, name);
      return callable(data || {}).then(function(r){ return r.data; });
    });
  }

  /* ── 기록 제출: 서버(submitScore)가 검증 후 저장. 기존 기록보다 빠를 때만 갱신 ── */
  function submit(game, stage, seconds){
    if (!available()) return Promise.resolve({ok:false, reason:'CLOUD_UNAVAILABLE'});
    if (ALLOWED_GAMES.indexOf(game) === -1) return Promise.resolve({ok:false, reason:'BAD_GAME'});
    if (!(typeof seconds === 'number' && isFinite(seconds) && seconds >= 0)) {
      return Promise.resolve({ok:false, reason:'BAD_TIME'});
    }
    if (!currentUser()) return Promise.resolve({ok:false, reason:'AUTH_REQUIRED'});

    return callFn('submitScore', {game:game, stage:Number(stage), seconds:seconds})
      .then(function(r){ return {ok:true, improved:!!r.improved, best:r.best}; })
      .catch(function(e){ return {ok:false, reason:(e && (e.code || e.message)) || 'ERROR'}; });
  }

  /* ── 특정 스테이지 상위 N명 (score 오름차순 = 빠른 순) — 읽기는 클라이언트에서 직접 ── */
  function top(game, stage, n){
    n = n || 20;
    if (!available()) return Promise.resolve([]);
    return ctx().then(function(c){
      var fs = c.firestoreApi, db = c.db;
      var q = fs.query(
        fs.collection(db, 'leaderboards', boardId(game, stage), 'entries'),
        fs.orderBy('score', 'asc'),
        fs.limit(n)
      );
      return fs.getDocs(q).then(function(snap){
        var out = [];
        snap.forEach(function(d){
          var v = d.data();
          out.push({uid:v.uid, nick:v.nickname || 'XENA FAN', seconds:v.score});
        });
        return out;
      });
    }).catch(function(){ return []; });
  }

  /* ── 전 스테이지 1위 한 번에 ── */
  function topAll(game, stageCount){
    var jobs = [];
    for (var i=1; i<=stageCount; i++){
      jobs.push(top(game, i, 1).then(function(rows){ return rows[0] || null; }));
    }
    return Promise.all(jobs).catch(function(){ return []; });
  }

  /* ── 주간 보상 수령 (1/2/3등 credits 를 wallets/{uid} 로 반영) ── */
  function claimWeeklyReward(){
    if (!available() || !currentUser()) return Promise.resolve({claimedTotal:0, claimedList:[]});
    return callFn('claimWeeklyReward', {}).catch(function(){ return {claimedTotal:0, claimedList:[]}; });
  }

  window.XenaLeaderboard = {
    submit: submit,
    top: top,
    topAll: topAll,
    weekKey: weekKey,
    available: available,
    currentUser: currentUser,
    claimWeeklyReward: claimWeeklyReward,
    signIn: function(){
      if (!available()) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
      return window.XenaCloudSync.signIn();
    }
  };
})();
