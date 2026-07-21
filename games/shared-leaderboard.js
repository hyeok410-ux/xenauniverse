/* XENA GAMES 공용 주간 랭킹 (Firebase Firestore) — 게임제작부서
   경로: leaderboards/{game}_{week}_s{stage}/entries/{uid}

   ⚠ 문서 스키마는 이미 배포된 firestore.rules 의 validLeaderboardEntry() 를 그대로 따른다.
     허용 필드: uid / nickname / game / week / stage / score / updatedAt  (이 외 필드는 거부됨)
     - game 은 'memory' | 'shisen' 만 허용
     - stage 는 문자열, score 는 숫자(여기서는 클리어 초 — 작을수록 상위)
     - nickname 은 16자 이하
   읽기는 누구나(비로그인 포함), 쓰기는 본인 uid 문서만 가능.
   Firebase 실패는 전부 삼켜서 게임 진행에 영향을 주지 않는다.
*/
(function(){
  var READY = null;
  var ALLOWED_GAMES = ['memory', 'shisen'];

  function weekKey(){
    var d = new Date();
    var onejan = new Date(d.getFullYear(), 0, 1);
    var wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + wk;   /* 예: 2026-W30 (rules 상 12자 이하) */
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

  /* rules: nickname 은 16자 이하 문자열 */
  function nickname(){
    var n = '';
    try{
      if (window.XenaProfile && window.XenaProfile.getNickname) n = window.XenaProfile.getNickname() || '';
    }catch(e){}
    if (!n){
      var u = currentUser();
      n = (u && u.displayName) ? u.displayName : 'XENA FAN';
    }
    return String(n).slice(0, 16);
  }

  /* ── 기록 제출: 기존 기록보다 빠를 때만 갱신 ── */
  function submit(game, stage, seconds){
    if (!available()) return Promise.resolve({ok:false, reason:'CLOUD_UNAVAILABLE'});
    if (ALLOWED_GAMES.indexOf(game) === -1) return Promise.resolve({ok:false, reason:'BAD_GAME'});
    if (!(typeof seconds === 'number' && isFinite(seconds) && seconds >= 0)) {
      return Promise.resolve({ok:false, reason:'BAD_TIME'});
    }
    var user = currentUser();
    if (!user) return Promise.resolve({ok:false, reason:'AUTH_REQUIRED'});

    return ctx().then(function(c){
      var fs = c.firestoreApi, db = c.db;
      var ref = fs.doc(db, 'leaderboards', boardId(game, stage), 'entries', user.uid);
      return fs.getDoc(ref).then(function(snap){
        if (snap.exists()){
          var prev = snap.data().score;
          if (typeof prev === 'number' && prev <= seconds) return {ok:true, improved:false, best:prev};
        }
        /* rules 의 hasOnly([...]) 때문에 아래 7개 필드만 정확히 보내야 한다 */
        return fs.setDoc(ref, {
          uid: user.uid,
          nickname: nickname(),
          game: game,
          week: weekKey(),
          stage: String(stage),
          score: seconds,
          updatedAt: fs.serverTimestamp()
        }).then(function(){ return {ok:true, improved:true, best:seconds}; });
      });
    }).catch(function(e){
      return {ok:false, reason:(e && (e.code || e.message)) || 'ERROR'};
    });
  }

  /* ── 특정 스테이지 상위 N명 (score 오름차순 = 빠른 순) ── */
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

  window.XenaLeaderboard = {
    submit: submit,
    top: top,
    topAll: topAll,
    weekKey: weekKey,
    available: available,
    currentUser: currentUser,
    signIn: function(){
      if (!available()) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
      return window.XenaCloudSync.signIn();
    }
  };
})();
