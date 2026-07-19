/* XENA GAMES 공용 프로필 · 뱃지 시스템 (게임제작부서)
   모든 게임 페이지에 <script src="../shared-profile.js"></script> 로 삽입.
   localStorage만 사용 (제로 예산 원칙). */
(function(){
  'use strict';
  var PKEY = 'xena_profile_v1';
  var DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#181022"/><circle cx="32" cy="24" r="12" fill="#5a4a7a"/><path d="M10 58c0-14 10-22 22-22s22 8 22 22" fill="#5a4a7a"/></svg>'
  );

  function load(){
    try{
      var p = JSON.parse(localStorage.getItem(PKEY) || 'null');
      if(!p) p = {};
    }catch(e){ p = {}; }
    if(!p.nickname) p.nickname = 'XENA FAN #' + Math.floor(1000 + Math.random()*9000);
    if(!p.avatar) p.avatar = DEFAULT_AVATAR;
    if(typeof p.lifetimeEarned !== 'number') p.lifetimeEarned = 0;
    if(typeof p.lastSeenXC !== 'number') p.lastSeenXC = -1;
    if(typeof p.playtimeMin !== 'number') p.playtimeMin = 0;
    if(!p.badges) p.badges = {};
    if(!p.createdAt) p.createdAt = Date.now();
    return p;
  }
  function save(p){ localStorage.setItem(PKEY, JSON.stringify(p)); }
  var P = load();

  function getJSON(key, fallback){
    try{ var v = JSON.parse(localStorage.getItem(key)); return (v && typeof v==='object') ? v : fallback; }
    catch(e){ return fallback; }
  }
  function num(v){ return typeof v === 'number' && !isNaN(v) ? v : 0; }

  /* ── XC 획득 누적 추적 (증가분만 감지 — 지출은 감소이므로 무시됨) ── */
  function pollWallet(){
    var w = getJSON('xena_wallet_v1', {xc:0});
    var xc = num(w.xc);
    if(P.lastSeenXC < 0) P.lastSeenXC = xc;
    if(xc > P.lastSeenXC) P.lifetimeEarned += (xc - P.lastSeenXC);
    P.lastSeenXC = xc;
    save(P);
  }
  pollWallet();
  setInterval(pollWallet, 4000);
  window.addEventListener('storage', function(e){ if(e.key === 'xena_wallet_v1') pollWallet(); });

  /* ── 플레이 시간 누적 (탭이 보이는 동안만) ── */
  setInterval(function(){
    if(document.visibilityState === 'visible'){
      P.playtimeMin += 0.5;
      save(P);
    }
  }, 30000);

  /* ── 뱃지 조건 정의 ── */
  function collectStats(){
    var worldcup = getJSON('xena_worldcup_stats_v1', {});
    var memory = getJSON('xena_memory_v1', {});
    var shisen = getJSON('xena_shisen_v1', {});
    var signal = getJSON('xena_signal_v1', {});
    var gachaOwned = 0;
    try{
      var g = getJSON('zena_gacha_v1', {});
      if(g && g.owned) gachaOwned = Object.keys(g.owned).filter(function(k){ return g.owned[k] > 0; }).length;
    }catch(e){}
    var chessRating = 0;
    try{ chessRating = num(parseInt(localStorage.getItem('og_grid_rating'), 10)); }catch(e){}
    return {
      playtimeMin: P.playtimeMin,
      lifetimeEarned: P.lifetimeEarned,
      worldcupFinishes: num(worldcup.totalFinishes),
      memoryUnlocked: num(memory.unlocked),
      shisenUnlocked: num(shisen.unlocked),
      signalStreak: num(signal.streak),
      gachaOwned: gachaOwned,
      chessRating: chessRating
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
      if(got && !P.badges[b.id]){
        P.badges[b.id] = Date.now();
        newlyUnlocked.push(b);
      }
    });
    save(P);
  }
  evalBadges();

  function lang(){ return (document.documentElement.lang === 'en') ? 'en' : 'ko'; }
  function tt(obj){ return obj[lang()] || obj.ko; }

  /* ── UI 삽입 ── */
  var style = document.createElement('style');
  style.textContent =
    '#xprof-btn{position:fixed;top:10px;right:12px;z-index:400;width:38px;height:38px;border-radius:50%;overflow:hidden;'+
    'border:2px solid rgba(63,224,255,.55);background:rgba(4,6,12,.86);cursor:pointer;padding:0;box-shadow:0 0 12px rgba(63,224,255,.25);}'+
    '#xprof-btn img{width:100%;height:100%;object-fit:cover;display:block;}'+
    '#xprof-overlay{position:fixed;inset:0;z-index:500;background:rgba(3,4,8,.86);backdrop-filter:blur(6px);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:60px 14px 40px;}'+
    '#xprof-overlay.on{display:flex;}'+
    '#xprof-modal{width:100%;max-width:520px;background:linear-gradient(180deg,#12101c,#0a0912);border:1px solid rgba(63,224,255,.3);border-radius:16px;padding:22px;font-family:"JetBrains Mono",ui-monospace,monospace;color:#e8e6f2;}'+
    '#xprof-modal h2{margin:0 0 16px;font-size:15px;letter-spacing:.1em;color:#3fe0ff;display:flex;justify-content:space-between;align-items:center;}'+
    '#xprof-close{background:none;border:none;color:#9a97b5;font-size:18px;cursor:pointer;}'+
    '.xprof-head{display:flex;align-items:center;gap:14px;margin-bottom:18px;}'+
    '.xprof-avatar-wrap{position:relative;width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid rgba(63,224,255,.5);flex:0 0 auto;cursor:pointer;}'+
    '.xprof-avatar-wrap img{width:100%;height:100%;object-fit:cover;}'+
    '.xprof-avatar-wrap span{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);font-size:9px;text-align:center;padding:2px 0;}'+
    '#xprof-nick{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 11px;color:#fff;font-family:inherit;font-size:13px;}'+
    '.xprof-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;font-size:11px;color:#c4c1da;}'+
    '.xprof-stats div{background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;}'+
    '.xprof-stats b{color:#3fe0ff;display:block;font-size:14px;}'+
    '.xprof-badge-title{font-size:12px;letter-spacing:.08em;color:#a06bff;margin:4px 0 10px;}'+
    '.xprof-badges{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}'+
    '.xprof-badge{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);position:relative;cursor:default;}'+
    '.xprof-badge.got{background:rgba(160,107,255,.14);border-color:rgba(160,107,255,.5);box-shadow:0 0 10px rgba(160,107,255,.3);}'+
    '.xprof-badge.locked{opacity:.28;filter:grayscale(1);}'+
    '.xprof-badge small{font-size:7.5px;margin-top:3px;text-align:center;line-height:1.2;padding:0 2px;color:#c4c1da;}'+
    '.xprof-badge .xprof-tip{display:none;position:absolute;bottom:105%;left:50%;transform:translateX(-50%);background:#000;color:#fff;font-size:9px;padding:5px 7px;border-radius:6px;white-space:nowrap;z-index:5;}'+
    '.xprof-badge:hover .xprof-tip{display:block;}'+
    '#xprof-toast{position:fixed;top:56px;right:12px;z-index:600;background:linear-gradient(135deg,#a06bff,#3fe0ff);color:#0a0912;font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);opacity:0;transform:translateY(-8px);transition:.35s ease;pointer-events:none;}'+
    '#xprof-toast.on{opacity:1;transform:translateY(0);}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'xprof-btn';
  btn.title = tt({ko:'프로필',en:'Profile'});
  btn.innerHTML = '<img id="xprof-btn-img" src="'+P.avatar+'">';
  document.body.appendChild(btn);

  var overlay = document.createElement('div');
  overlay.id = 'xprof-overlay';
  overlay.innerHTML =
    '<div id="xprof-modal">'+
      '<h2>'+tt({ko:'👤 내 프로필',en:'👤 My Profile'})+'<button id="xprof-close">✕</button></h2>'+
      '<div class="xprof-head">'+
        '<div class="xprof-avatar-wrap" id="xprof-avatar-wrap"><img id="xprof-avatar-img" src="'+P.avatar+'"><span>'+tt({ko:'변경',en:'Change'})+'</span></div>'+
        '<input type="text" id="xprof-nick" maxlength="16" value="">'+
        '<input type="file" id="xprof-file" accept="image/*" style="display:none;">'+
      '</div>'+
      '<div class="xprof-stats">'+
        '<div>'+tt({ko:'누적 플레이',en:'Playtime'})+'<b id="xprof-s-time">0h</b></div>'+
        '<div>'+tt({ko:'누적 XC 획득',en:'Lifetime XC'})+'<b id="xprof-s-xc">0</b></div>'+
        '<div>'+tt({ko:'보유 카드',en:'Cards Owned'})+'<b id="xprof-s-cards">0</b></div>'+
        '<div>'+tt({ko:'획득 뱃지',en:'Badges Earned'})+'<b id="xprof-s-badges">0/'+BADGES.length+'</b></div>'+
      '</div>'+
      '<div class="xprof-badge-title">🏆 '+tt({ko:'영광의 도감',en:'Hall of Fame'})+'</div>'+
      '<div class="xprof-badges" id="xprof-badge-grid"></div>'+
    '</div>';
  document.body.appendChild(overlay);

  var toast = document.createElement('div');
  toast.id = 'xprof-toast';
  document.body.appendChild(toast);

  function fmtHours(min){ var h = min/60; return h < 10 ? h.toFixed(1)+'h' : Math.round(h)+'h'; }

  function renderModal(){
    var s = collectStats();
    document.getElementById('xprof-nick').value = P.nickname;
    document.getElementById('xprof-s-time').textContent = fmtHours(P.playtimeMin);
    document.getElementById('xprof-s-xc').textContent = P.lifetimeEarned;
    document.getElementById('xprof-s-cards').textContent = s.gachaOwned;
    var gotCount = Object.keys(P.badges).length;
    document.getElementById('xprof-s-badges').textContent = gotCount+'/'+BADGES.length;
    var grid = document.getElementById('xprof-badge-grid');
    grid.innerHTML = '';
    BADGES.forEach(function(b){
      var got = !!P.badges[b.id];
      var d = document.createElement('div');
      d.className = 'xprof-badge ' + (got ? 'got' : 'locked');
      d.innerHTML = (got ? b.icon : '🔒') + '<small>'+tt(b.name)+'</small><span class="xprof-tip">'+tt(b.desc)+'</span>';
      grid.appendChild(d);
    });
  }

  function openModal(){ evalBadges(); renderModal(); overlay.classList.add('on'); }
  function closeModal(){ overlay.classList.remove('on'); }
  btn.addEventListener('click', openModal);
  document.getElementById('xprof-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });

  document.getElementById('xprof-nick').addEventListener('change', function(e){
    var v = e.target.value.trim();
    if(v){ P.nickname = v.slice(0,16); save(P); document.getElementById('xprof-btn-img').src = P.avatar; }
  });

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
        var ctx = canvas.getContext('2d');
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side)/2, sy = (img.height - side)/2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        P.avatar = dataUrl;
        save(P);
        document.getElementById('xprof-avatar-img').src = dataUrl;
        document.getElementById('xprof-btn-img').src = dataUrl;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function showToast(b){
    toast.innerHTML = '🎉 ' + tt({ko:'새 뱃지 획득! ',en:'New badge! '}) + b.icon + ' ' + tt(b.name);
    toast.classList.add('on');
    setTimeout(function(){ toast.classList.remove('on'); }, 3800);
  }
  if(newlyUnlocked.length){
    var i = 0;
    (function next(){
      if(i >= newlyUnlocked.length) return;
      showToast(newlyUnlocked[i]); i++;
      setTimeout(next, 4200);
    })();
  }

  /* 다른 게임 페이지에서 재평가 트리거(예: 뱃지 조건 즉시 반영) */
  setInterval(function(){
    var before = Object.keys(P.badges).length;
    evalBadges();
    if(Object.keys(P.badges).length > before && !overlay.classList.contains('on')){
      newlyUnlocked.forEach(showToast);
      newlyUnlocked = [];
    }
  }, 10000);

  /* 주간기록 옆 프로필칩 렌더용 API */
  window.XenaProfile = {
    chipHTML: function(){
      return '<span class="xprof-chip" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">'+
        '<img src="'+P.avatar+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;">'+
        '<span style="font-size:9px;color:#9a97b5;">'+P.nickname+'</span></span>';
    },
    getNickname: function(){ return P.nickname; },
    getAvatar: function(){ return P.avatar; }
  };
})();
