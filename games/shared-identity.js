/* XENA GAMES 통합 프로필/로그인 시스템 (게임제작부서)
   shared-profile.js 를 대체한다. 예전에는 우측상단 프로필(로컬 닉네임)과
   허브 상단중앙 계정버튼(Google 로그인 + 별도 닉네임)이 따로 있었는데,
   여기서 Google 로그인 하나로 통합한다 — 우측상단 버튼이 유일한 진입점.

   닉네임은 Firestore users/{uid} 문서에 최초 1회만 쓸 수 있고(firestore.rules
   validCreateUser/validUpdateUser 가 이후 변경을 막음) 이후로는 절대 수정 불가
   (추후 유료 재화로 변경권을 팔 예정이므로 여기서 미리 잠가둔다).

   <script src="../game/firebase-config.js"></script>
   <script src="../game/cloud-sync.js"></script>
   <script src="../shared-identity.js"></script>  ← 이 순서로 로드해야 한다.
*/
(function(){
  'use strict';
  var PKEY = 'xena_local_v1'; /* 아바타/뱃지/플레이타임 등 로컬 전용 데이터 */
  var ADMIN_UID = 'PiegXmg9KjNJS9JDS3piP0agUB02'; /* UI 노출 여부만 결정 — 실제 권한은 서버(functions)가 재검증 */
  var DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#181022"/><circle cx="32" cy="24" r="12" fill="#5a4a7a"/><path d="M10 58c0-14 10-22 22-22s22 8 22 22" fill="#5a4a7a"/></svg>'
  );

  function loadLocal(){
    var p; try{ p = JSON.parse(localStorage.getItem(PKEY) || 'null') || {}; }catch(e){ p = {}; }
    /* 구버전 shared-profile.js 가 쓰던 로컬 저장소에서 아바타/뱃지/플레이타임 1회 이관 */
    if (!p.__migrated){
      try{
        var old = JSON.parse(localStorage.getItem('xena_profile_v1') || 'null');
        if (old){
          if (old.avatar) p.avatar = old.avatar;
          if (typeof old.lifetimeEarned === 'number') p.lifetimeEarned = old.lifetimeEarned;
          if (typeof old.lastSeenXC === 'number') p.lastSeenXC = old.lastSeenXC;
          if (typeof old.playtimeMin === 'number') p.playtimeMin = old.playtimeMin;
          if (old.badges) p.badges = old.badges;
        }
      }catch(e){}
      p.__migrated = true;
    }
    if(!p.avatar) p.avatar = DEFAULT_AVATAR;
    if(typeof p.lifetimeEarned !== 'number') p.lifetimeEarned = 0;
    if(typeof p.lastSeenXC !== 'number') p.lastSeenXC = -1;
    if(typeof p.playtimeMin !== 'number') p.playtimeMin = 0;
    if(!p.badges) p.badges = {};
    return p;
  }
  function saveLocal(p){ localStorage.setItem(PKEY, JSON.stringify(p)); }
  var L = loadLocal();

  function getJSON(key, fallback){
    try{ var v = JSON.parse(localStorage.getItem(key)); return (v && typeof v==='object') ? v : fallback; }
    catch(e){ return fallback; }
  }
  function num(v){ return typeof v === 'number' && !isNaN(v) ? v : 0; }
  function lang(){ return (document.documentElement.lang === 'en') ? 'en' : 'ko'; }
  function tt(obj){ return obj[lang()] || obj.ko; }

  /* ── 로그인 상태 / 닉네임 (Firestore users/{uid}) ── */
  var cloudReady = null;
  var authUser = null;        /* Firebase Auth user (uid, displayName, photoURL...) */
  var nickname = null;        /* 확정된 닉네임 (없으면 null = 아직 설정 전) */
  var nicknameChecked = false;
  var subs = [];
  function notify(){ subs.forEach(function(fn){ try{ fn(state()); }catch(e){} }); }
  function state(){ return { signedIn: !!authUser, uid: authUser ? authUser.uid : null, nickname: nickname, avatar: L.avatar }; }

  function ctx(){
    if (!window.XenaCloudSync) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
    if (!cloudReady) cloudReady = window.XenaCloudSync.context();
    return cloudReady;
  }

  function validNickname(v){
    return typeof v === 'string' && v.length >= 2 && v.length <= 16 && /^[A-Za-z0-9가-힣 _-]+$/.test(v);
  }

  function fetchOrCreateNickname(uid){
    return ctx().then(function(c){
      var fs = c.firestoreApi, db = c.db;
      var ref = fs.doc(db, 'users', uid);
      return fs.getDoc(ref).then(function(snap){
        if (snap.exists() && snap.data().nickname){
          nickname = snap.data().nickname;
          nicknameChecked = true;
          notify();
          return nickname;
        }
        return promptForNickname(ref, fs);
      });
    });
  }

  function promptForNickname(ref, fs){
    var msg = tt({
      ko: '처음 오셨네요! 사용할 닉네임을 정해주세요.\n2~16자, 한글/영문/숫자/공백/-/_ 만 가능합니다.\n한 번 정하면 이후 무료로 변경할 수 없습니다.',
      en: 'Welcome! Choose a nickname.\n2-16 chars, letters/numbers/space/-/_ only.\nOnce set, it cannot be changed for free.'
    });
    var entered = null;
    while (true){
      entered = window.prompt(msg, '');
      if (entered === null) return null; /* 취소 — 로그인은 유지, 다음 진입 때 다시 물어봄 */
      entered = entered.trim();
      if (validNickname(entered)) break;
      msg = tt({ko:'2~16자, 한글/영문/숫자/공백/-/_ 만 가능합니다. 다시 입력해주세요.', en:'2-16 chars, letters/numbers/space/-/_ only. Try again.'}) ;
    }
    var now = fs.serverTimestamp();
    return fs.setDoc(ref, {
      uid: authUser.uid,
      nickname: entered,
      nicknameLower: entered.toLowerCase(),
      nicknameLocked: true,
      createdAt: now,
      updatedAt: now
    }).then(function(){
      nickname = entered;
      nicknameChecked = true;
      notify();
      return entered;
    }).catch(function(){ return null; });
  }

  function init(){
    if (!window.XenaCloudSync) return;
    window.XenaCloudSync.subscribe(function(snap){
      var was = authUser;
      authUser = snap.user;
      if (authUser && (!was || was.uid !== authUser.uid)){
        nickname = null; nicknameChecked = false;
        fetchOrCreateNickname(authUser.uid);
      } else if (!authUser){
        nickname = null; nicknameChecked = false;
      }
      notify();
      renderButton();
    });
    window.XenaCloudSync.connect().catch(function(){});
  }

  function signIn(){
    if (!window.XenaCloudSync) return Promise.reject(new Error('CLOUD_UNAVAILABLE'));
    return window.XenaCloudSync.signIn();
  }
  function signOut(){
    if (!window.XenaCloudSync) return Promise.resolve();
    return window.XenaCloudSync.signOut();
  }

  /* ── XC 누적 / 플레이타임 (로컬 통계 — 뱃지용) ── */
  function pollWallet(){
    var w = getJSON('xena_wallet_v1', {xc:0});
    var xc = num(w.xc);
    if (L.lastSeenXC < 0) L.lastSeenXC = xc;
    if (xc > L.lastSeenXC) L.lifetimeEarned += (xc - L.lastSeenXC);
    L.lastSeenXC = xc;
    saveLocal(L);
  }
  pollWallet();
  setInterval(pollWallet, 4000);
  window.addEventListener('storage', function(e){ if (e.key === 'xena_wallet_v1') pollWallet(); });
  setInterval(function(){
    if (document.visibilityState === 'visible'){ L.playtimeMin += 0.5; saveLocal(L); }
  }, 30000);

  /* ── 뱃지 ── */
  function collectStats(){
    var worldcup = getJSON('xena_worldcup_stats_v1', {});
    var memory = getJSON('xena_memory_v1', {});
    var shisen = getJSON('xena_shisen_v1', {});
    var signal = getJSON('xena_signal_v1', {});
    var gachaOwned = 0;
    try{
      var g = getJSON('zena_gacha_v1', {});
      if (g && g.owned) gachaOwned = Object.keys(g.owned).filter(function(k){ return g.owned[k] > 0; }).length;
    }catch(e){}
    var chessRating = 0;
    try{ chessRating = num(parseInt(localStorage.getItem('og_grid_rating'), 10)); }catch(e){}
    return {
      playtimeMin: L.playtimeMin, lifetimeEarned: L.lifetimeEarned,
      worldcupFinishes: num(worldcup.totalFinishes), memoryUnlocked: num(memory.unlocked),
      shisenUnlocked: num(shisen.unlocked), signalStreak: num(signal.streak),
      gachaOwned: gachaOwned, chessRating: chessRating
    };
  }

  var BADGES = [
    { id:'time1',  icon:'⏱️', name:{ko:'첫 발걸음',en:'First Step'},        desc:{ko:'누적 플레이 1시간',en:'1 hour played'},        need:function(s){ return s.playtimeMin >= 60; } },
    { id:'time10', icon:'🕙', name:{ko:'단골 요원',en:'Regular Agent'},      desc:{ko:'누적 플레이 10시간',en:'10 hours played'},      need:function(s){ return s.playtimeMin >= 600; } },
    { id:'time100',icon:'🏅', name:{ko:'그리드의 전설',en:'Grid Legend'},    desc:{ko:'누적 플레이 100시간',en:'100 hours played'},    need:function(s){ return s.playtimeMin >= 6000; } },
    { id:'streak7',icon:'🔥', name:{ko:'꾸준한 신호',en:'Steady Signal'},    desc:{ko:'데일리 시그널 7일 연속',en:'7-day signal streak'}, need:function(s){ return s.signalStreak >= 7; } },
    { id:'streak30',icon:'🔥', name:{ko:'불타는 충성도',en:'Blazing Loyalty'},desc:{ko:'데일리 시그널 30일 연속',en:'30-day signal streak'}, need:function(s){ return s.signalStreak >= 30; } },
    { id:'card10', icon:'🎴', name:{ko:'수집 입문',en:'Collector I'},        desc:{ko:'제나카드 10장 수집',en:'Collect 10 XENA cards'}, need:function(s){ return s.gachaOwned >= 10; } },
    { id:'card50', icon:'🎴', name:{ko:'수집 애호가',en:'Collector II'},     desc:{ko:'제나카드 50장 수집',en:'Collect 50 XENA cards'}, need:function(s){ return s.gachaOwned >= 50; } },
    { id:'card100',icon:'👑', name:{ko:'카드 마스터',en:'Card Master'},      desc:{ko:'제나카드 100장 수집',en:'Collect 100 XENA cards'}, need:function(s){ return s.gachaOwned >= 100; } },
    { id:'wc10',   icon:'🏆', name:{ko:'심사위원',en:'Judge I'},            desc:{ko:'이상형 월드컵 10회 완주',en:'Finish World Cup ×10'}, need:function(s){ return s.worldcupFinishes >= 10; } },
    { id:'wc50',   icon:'🏆', name:{ko:'최애 감별사',en:'Judge II'},         desc:{ko:'이상형 월드컵 50회 완주',en:'Finish World Cup ×50'}, need:function(s){ return s.worldcupFinishes >= 50; } },
    { id:'mem5',   icon:'🧠', name:{ko:'기억력 수련생',en:'Memory Trainee'}, desc:{ko:'메모리 그리드 5스테이지 해금',en:'Unlock Memory Grid stage 5'}, need:function(s){ return s.memoryUnlocked >= 5; } },
    { id:'mem10',  icon:'🧠', name:{ko:'완벽한 기억',en:'Perfect Recall'},   desc:{ko:'메모리 그리드 전 스테이지 해금',en:'Unlock all Memory Grid stages'}, need:function(s){ return s.memoryUnlocked >= 10; } },
    { id:'shi5',   icon:'🔗', name:{ko:'회선 수리공',en:'Line Technician'},  desc:{ko:'시그널 링크 5스테이지 해금',en:'Unlock Signal Link stage 5'}, need:function(s){ return s.shisenUnlocked >= 5; } },
    { id:'shi10',  icon:'🔗', name:{ko:'그리드 설계자',en:'Grid Architect'}, desc:{ko:'시그널 링크 전 스테이지 해금',en:'Unlock all Signal Link stages'}, need:function(s){ return s.shisenUnlocked >= 10; } },
    { id:'chess1200',icon:'♟️', name:{ko:'전략가',en:'Strategist'},         desc:{ko:'오버라이드 그리드 레이팅 1200+',en:'Override Grid rating 1200+'}, need:function(s){ return s.chessRating >= 1200; } },
    { id:'chess1500',icon:'♟️', name:{ko:'그랜드마스터',en:'Grandmaster'},   desc:{ko:'오버라이드 그리드 레이팅 1500+',en:'Override Grid rating 1500+'}, need:function(s){ return s.chessRating >= 1500; } },
    { id:'xc500',  icon:'💰', name:{ko:'신호 채굴자',en:'Credit Miner'},    desc:{ko:'누적 XC 500 획득',en:'Earn 500 XC lifetime'}, need:function(s){ return s.lifetimeEarned >= 500; } },
    { id:'xc2000', icon:'💎', name:{ko:'제나 재벌',en:'XENA Tycoon'},       desc:{ko:'누적 XC 2000 획득',en:'Earn 2000 XC lifetime'}, need:function(s){ return s.lifetimeEarned >= 2000; } }
  ];

  var newlyUnlocked = [];
  function evalBadges(){
    var s = collectStats();
    BADGES.forEach(function(b){
      var got = !!b.need(s);
      if (got && !L.badges[b.id]){ L.badges[b.id] = Date.now(); newlyUnlocked.push(b); }
    });
    saveLocal(L);
  }
  evalBadges();

  /* ── UI ── */
  var style = document.createElement('style');
  style.textContent =
    '#xprof-btn{position:fixed;top:10px;right:12px;z-index:400;width:38px;height:38px;border-radius:50%;overflow:hidden;'+
    'border:2px solid rgba(63,224,255,.55);background:rgba(4,6,12,.86);cursor:pointer;padding:0;box-shadow:0 0 12px rgba(63,224,255,.25);}'+
    '#xprof-btn img{width:100%;height:100%;object-fit:cover;display:block;}'+
    '#xprof-btn.guest{border-color:rgba(255,255,255,.35);}'+
    '#xprof-overlay{position:fixed;inset:0;z-index:500;background:rgba(3,4,8,.86);backdrop-filter:blur(6px);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:60px 14px 40px;}'+
    '#xprof-overlay.on{display:flex;}'+
    '#xprof-modal{width:100%;max-width:520px;background:linear-gradient(180deg,#12101c,#0a0912);border:1px solid rgba(63,224,255,.3);border-radius:16px;padding:22px;font-family:"JetBrains Mono",ui-monospace,monospace;color:#e8e6f2;}'+
    '#xprof-modal h2{margin:0 0 16px;font-size:15px;letter-spacing:.1em;color:#3fe0ff;display:flex;justify-content:space-between;align-items:center;}'+
    '#xprof-close{background:none;border:none;color:#9a97b5;font-size:18px;cursor:pointer;}'+
    '.xprof-head{display:flex;align-items:center;gap:14px;margin-bottom:14px;}'+
    '.xprof-avatar-wrap{position:relative;width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid rgba(63,224,255,.5);flex:0 0 auto;cursor:pointer;}'+
    '.xprof-avatar-wrap img{width:100%;height:100%;object-fit:cover;}'+
    '.xprof-avatar-wrap span{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);font-size:9px;text-align:center;padding:2px 0;}'+
    '.xprof-nick-row{flex:1;}'+
    '.xprof-nick{font-size:16px;font-weight:700;color:#fff;margin-bottom:4px;}'+
    '.xprof-nick-lock{font-size:9.5px;color:#9a97b5;line-height:1.5;}'+
    '.xprof-uid{font-size:8.5px;color:#5b586e;margin-top:6px;word-break:break-all;}'+
    '.xprof-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:11px;color:#c4c1da;}'+
    '.xprof-stats div{background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;}'+
    '.xprof-stats b{color:#3fe0ff;display:block;font-size:14px;}'+
    '.xprof-claim{display:none;margin-bottom:14px;padding:10px 12px;border-radius:10px;border:1px solid rgba(232,196,104,.4);background:rgba(232,196,104,.08);font-size:11px;color:#ffd97a;}'+
    '.xprof-claim.show{display:block;}'+
    '.xprof-claim button{margin-top:8px;font-family:inherit;font-size:10.5px;font-weight:700;padding:7px 14px;border-radius:14px;border:none;background:var(--gold,#e8c468);color:#1a1206;}'+
    '.xprof-badge-title{font-size:12px;letter-spacing:.08em;color:#a06bff;margin:4px 0 10px;}'+
    '.xprof-badges{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}'+
    '.xprof-badge{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);position:relative;cursor:default;}'+
    '.xprof-badge.got{background:rgba(160,107,255,.14);border-color:rgba(160,107,255,.5);box-shadow:0 0 10px rgba(160,107,255,.3);}'+
    '.xprof-badge.locked{opacity:.28;filter:grayscale(1);}'+
    '.xprof-badge small{font-size:7.5px;margin-top:3px;text-align:center;line-height:1.2;padding:0 2px;color:#c4c1da;}'+
    '.xprof-badge .xprof-tip{display:none;position:absolute;bottom:105%;left:50%;transform:translateX(-50%);background:#000;color:#fff;font-size:9px;padding:5px 7px;border-radius:6px;white-space:nowrap;z-index:5;}'+
    '.xprof-badge:hover .xprof-tip{display:block;}'+
    '.xprof-signout{margin-top:16px;width:100%;font-family:inherit;font-size:10.5px;letter-spacing:.08em;padding:9px 0;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#9a97b5;cursor:pointer;}'+
    '.xprof-admin{display:none;margin-top:16px;padding:12px;border-radius:10px;border:1px dashed rgba(255,107,138,.4);background:rgba(255,107,138,.06);text-align:left;}'+
    '.xprof-admin.show{display:block;}'+
    '.xprof-admin-title{font-size:10px;letter-spacing:.1em;color:#ff8fa8;margin-bottom:8px;}'+
    '.xprof-admin-row{display:flex;gap:6px;margin-bottom:6px;}'+
    '.xprof-admin-row input{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:6px 8px;color:#fff;font-family:inherit;font-size:10px;}'+
    '.xprof-admin-row button{font-family:inherit;font-size:9.5px;font-weight:700;padding:6px 10px;border-radius:6px;border:none;background:#ff6b8a;color:#2a0410;cursor:pointer;white-space:nowrap;}'+
    '.xprof-admin-out{font-size:9px;color:#c4c1da;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;margin-top:6px;}'+
    '#xprof-toast{position:fixed;top:56px;right:12px;z-index:600;background:linear-gradient(135deg,#a06bff,#3fe0ff);color:#0a0912;font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);opacity:0;transform:translateY(-8px);transition:.35s ease;pointer-events:none;}'+
    '#xprof-toast.on{opacity:1;transform:translateY(0);}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'xprof-btn';
  btn.className = 'guest';
  btn.title = tt({ko:'로그인 / 프로필',en:'Sign in / Profile'});
  btn.innerHTML = '<img id="xprof-btn-img" src="'+L.avatar+'">';
  document.body.appendChild(btn);

  var overlay = document.createElement('div');
  overlay.id = 'xprof-overlay';
  overlay.innerHTML =
    '<div id="xprof-modal">'+
      '<h2>'+tt({ko:'👤 내 프로필',en:'👤 My Profile'})+'<button id="xprof-close">✕</button></h2>'+
      '<div class="xprof-head">'+
        '<div class="xprof-avatar-wrap" id="xprof-avatar-wrap"><img id="xprof-avatar-img" src="'+L.avatar+'"><span>'+tt({ko:'변경',en:'Change'})+'</span></div>'+
        '<div class="xprof-nick-row">'+
          '<div class="xprof-nick" id="xprof-nick-text">—</div>'+
          '<div class="xprof-nick-lock">'+tt({ko:'닉네임은 최초 설정 후 변경할 수 없습니다.',en:'Nickname cannot be changed once set.'})+'</div>'+
          '<div class="xprof-uid" id="xprof-uid"></div>'+
        '</div>'+
        '<input type="file" id="xprof-file" accept="image/*" style="display:none;">'+
      '</div>'+
      '<div class="xprof-claim" id="xprof-claim">'+
        '<div id="xprof-claim-text"></div>'+
        '<button id="xprof-claim-btn">'+tt({ko:'수령하기',en:'CLAIM'})+'</button>'+
      '</div>'+
      '<div class="xprof-stats">'+
        '<div>'+tt({ko:'누적 플레이',en:'Playtime'})+'<b id="xprof-s-time">0h</b></div>'+
        '<div>'+tt({ko:'누적 XC 획득',en:'Lifetime XC'})+'<b id="xprof-s-xc">0</b></div>'+
        '<div>'+tt({ko:'보유 카드',en:'Cards Owned'})+'<b id="xprof-s-cards">0</b></div>'+
        '<div>'+tt({ko:'획득 뱃지',en:'Badges Earned'})+'<b id="xprof-s-badges">0/'+BADGES.length+'</b></div>'+
      '</div>'+
      '<div class="xprof-badge-title">🏆 '+tt({ko:'영광의 도감',en:'Hall of Fame'})+'</div>'+
      '<div class="xprof-badges" id="xprof-badge-grid"></div>'+
      '<div class="xprof-admin" id="xprof-admin">'+
        '<div class="xprof-admin-title">⚙ ADMIN</div>'+
        '<div class="xprof-admin-row"><input id="xa-uid" placeholder="target UID (비우면 나 자신)"></div>'+
        '<div class="xprof-admin-row"><input id="xa-amount" placeholder="credits (예: 1000, -500)"><button id="xa-grant">지급</button></div>'+
        '<div class="xprof-admin-row"><button id="xa-list">비정상 재화 조회</button><button id="xa-reset">대상 UID 초기화</button></div>'+
        '<div class="xprof-admin-out" id="xa-out"></div>'+
      '</div>'+
      '<button class="xprof-signout" id="xprof-signout">'+tt({ko:'로그아웃',en:'Sign out'})+'</button>'+
    '</div>';
  document.body.appendChild(overlay);

  var toast = document.createElement('div');
  toast.id = 'xprof-toast';
  document.body.appendChild(toast);

  function fmtHours(min){ var h = min/60; return h < 10 ? h.toFixed(1)+'h' : Math.round(h)+'h'; }

  function renderModal(){
    var s = collectStats();
    document.getElementById('xprof-nick-text').textContent = nickname || tt({ko:'닉네임 설정 중…',en:'Setting nickname…'});
    document.getElementById('xprof-uid').textContent = authUser ? ('UID: ' + authUser.uid) : '';
    document.getElementById('xprof-s-time').textContent = fmtHours(L.playtimeMin);
    document.getElementById('xprof-s-xc').textContent = L.lifetimeEarned;
    document.getElementById('xprof-s-cards').textContent = s.gachaOwned;
    var gotCount = Object.keys(L.badges).length;
    document.getElementById('xprof-s-badges').textContent = gotCount+'/'+BADGES.length;
    var grid = document.getElementById('xprof-badge-grid');
    grid.innerHTML = '';
    BADGES.forEach(function(b){
      var got = !!L.badges[b.id];
      var d = document.createElement('div');
      d.className = 'xprof-badge ' + (got ? 'got' : 'locked');
      d.innerHTML = (got ? b.icon : '🔒') + '<small>'+tt(b.name)+'</small><span class="xprof-tip">'+tt(b.desc)+'</span>';
      grid.appendChild(d);
    });
    renderClaimBox();
    renderAdminBox();
  }

  function callFn(name, data){
    return ctx().then(function(c){
      if (!c.functionsApi || !c.functionsInstance) return Promise.reject(new Error('FUNCTIONS_UNAVAILABLE'));
      return c.functionsApi.httpsCallable(c.functionsInstance, name)(data || {}).then(function(r){ return r.data; });
    });
  }
  function renderAdminBox(){
    var box = document.getElementById('xprof-admin');
    box.classList.toggle('show', !!(authUser && authUser.uid === ADMIN_UID));
  }
  var xaOut = null;
  function adminLog(v){
    if (!xaOut) xaOut = document.getElementById('xa-out');
    xaOut.textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 1);
  }
  var xaGrant = document.getElementById('xa-grant');
  var xaList = document.getElementById('xa-list');
  var xaReset = document.getElementById('xa-reset');
  if (xaGrant) xaGrant.addEventListener('click', function(){
    var targetUid = document.getElementById('xa-uid').value.trim() || (authUser && authUser.uid);
    var amount = Number(document.getElementById('xa-amount').value);
    if (!targetUid || !amount){ adminLog('targetUid/amount 확인'); return; }
    adminLog('처리 중…');
    callFn('adminGrantCredits', {targetUid:targetUid, amount:amount}).then(adminLog).catch(function(e){ adminLog('오류: '+(e.message||e)); });
  });
  if (xaList) xaList.addEventListener('click', function(){
    adminLog('조회 중…');
    callFn('adminListWallets', {threshold:500}).then(adminLog).catch(function(e){ adminLog('오류: '+(e.message||e)); });
  });
  if (xaReset) xaReset.addEventListener('click', function(){
    var targetUid = document.getElementById('xa-uid').value.trim();
    if (!targetUid){ adminLog('초기화할 대상 UID를 입력하세요'); return; }
    if (!window.confirm('정말 '+targetUid+' 의 재화를 0으로 초기화할까요?')) return;
    adminLog('처리 중…');
    callFn('adminResetWallet', {targetUid:targetUid}).then(adminLog).catch(function(e){ adminLog('오류: '+(e.message||e)); });
  });

  function renderClaimBox(){
    var box = document.getElementById('xprof-claim');
    if (!window.XenaLeaderboard || !window.XenaLeaderboard.available() || !authUser){ box.classList.remove('show'); return; }
    window.XenaLeaderboard.claimWeeklyReward().then(function(r){
      if (r && r.claimedTotal > 0){
        box.classList.add('show');
        document.getElementById('xprof-claim-text').textContent =
          tt({ko:'🏆 지난주 랭킹 보상 '+r.claimedTotal+' 크레딧이 도착했습니다! (체스 지갑에 반영됨)',
              en:'🏆 Last week\'s ranking reward: '+r.claimedTotal+' credits arrived! (added to your chess wallet)'});
      } else {
        box.classList.remove('show');
      }
    });
  }
  document.getElementById('xprof-claim-btn') && document.getElementById('xprof-claim-btn').addEventListener('click', function(){
    document.getElementById('xprof-claim').classList.remove('show');
  });

  function openModal(){
    if (!authUser){ signIn().catch(function(){}); return; }
    evalBadges(); renderModal(); overlay.classList.add('on');
  }
  function closeModal(){ overlay.classList.remove('on'); }
  btn.addEventListener('click', openModal);
  document.getElementById('xprof-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });
  document.getElementById('xprof-signout').addEventListener('click', function(){ signOut(); closeModal(); });

  document.getElementById('xprof-avatar-wrap').addEventListener('click', function(){
    document.getElementById('xprof-file').click();
  });
  document.getElementById('xprof-file').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      var img = new Image();
      img.onload = function(){
        var size = 160;
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var c2d = canvas.getContext('2d');
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side)/2, sy = (img.height - side)/2;
        c2d.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        L.avatar = dataUrl; saveLocal(L);
        document.getElementById('xprof-avatar-img').src = dataUrl;
        document.getElementById('xprof-btn-img').src = dataUrl;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function renderButton(){
    btn.classList.toggle('guest', !authUser);
    btn.title = authUser ? (nickname || tt({ko:'프로필',en:'Profile'})) : tt({ko:'로그인',en:'Sign in'});
  }

  function showToast(b){
    toast.innerHTML = '🎉 ' + tt({ko:'새 뱃지 획득! ',en:'New badge! '}) + b.icon + ' ' + tt(b.name);
    toast.classList.add('on');
    setTimeout(function(){ toast.classList.remove('on'); }, 3800);
  }
  if (newlyUnlocked.length){
    var i = 0;
    (function next(){
      if (i >= newlyUnlocked.length) return;
      showToast(newlyUnlocked[i]); i++;
      setTimeout(next, 4200);
    })();
  }
  setInterval(function(){
    var before = Object.keys(L.badges).length;
    evalBadges();
    if (Object.keys(L.badges).length > before && !overlay.classList.contains('on')){
      newlyUnlocked.forEach(showToast); newlyUnlocked = [];
    }
  }, 10000);

  init();
  renderButton();

  /* 주간기록 옆 프로필칩 렌더용 API + 로그인 게이트(shared-gate.js)에서 쓰는 API */
  window.XenaProfile = {
    chipHTML: function(){
      return '<span class="xprof-chip" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">'+
        '<img src="'+L.avatar+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;">'+
        '<span style="font-size:9px;color:#9a97b5;">'+(nickname || 'XENA FAN')+'</span></span>';
    },
    getNickname: function(){ return nickname || 'XENA FAN'; },
    getAvatar: function(){ return L.avatar; }
  };
  window.XenaIdentity = {
    subscribe: function(fn){ subs.push(fn); fn(state()); return function(){ subs = subs.filter(function(x){return x!==fn;}); }; },
    getState: state,
    signIn: signIn,
    signOut: signOut,
    openProfile: openModal
  };
})();
