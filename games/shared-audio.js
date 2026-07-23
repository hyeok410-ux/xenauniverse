/* XENA GAMES 공용 오디오/배경 매니저 — 게임제작부서
   - 페이지별 BGM 2곡 중 랜덤 재생, 곡이 끝나면 다시 랜덤 선택 (연속 반복 허용)
   - 공용 효과음(SFX) 재생
   - 화면잠금/탭전환 시 모든 소리 완전 정지 (BGM + 페이지 내 모든 audio/video + WebAudio)
   - 배경아트 적용: 가운데는 어둡게(게임화면 가독성), 양 사이드는 밝게
*/
(function(){
  var LS_KEY = 'xena_audio_v1';
  var ASSET_BASE = (function(){
    var scripts = document.getElementsByTagName('script');
    for (var i=0;i<scripts.length;i++){
      /* ?v=... 캐시버스팅 쿼리를 먼저 떼어내야 경로가 깨지지 않는다 */
      var src = (scripts[i].getAttribute('src')||'').split('?')[0];
      if (src.indexOf('shared-audio.js') !== -1){
        return src.replace('shared-audio.js','') + '_assets/';
      }
    }
    return '../_assets/';
  })();

  var BGM_SETS = {
    hub:      ['hub_1.mp3','hub_2.mp3'],
    gacha:    ['gacha_1.mp3','gacha_2.mp3'],
    memory:   ['memory_1.mp3','memory_2.mp3'],
    shisen:   ['shisen_1.mp3','shisen_2.mp3'],
    signal:   ['signal_1.mp3','signal_2.mp3'],
    worldcup: ['worldcup_1.mp3','worldcup_2.mp3'],
    merge:    ['merge_1.mp3','merge_2.mp3'],
    dispatch: ['dispatch_1.mp3','dispatch_2.mp3'],
    tcg:      ['tcg_1.mp3','tcg_2.mp3'],
    raid:     ['hub_1.mp3','hub_2.mp3'],
    stageguard:['signal_1.mp3','signal_2.mp3']
  };
  var BG_FILES = {
    hub:'hub.jpg', gacha:'gacha.jpg', memory:'memory.jpg',
    shisen:'shisen.jpg', signal:'signal.jpg', worldcup:'worldcup.jpg', merge:'merge.jpg',
    dispatch:'dispatch.jpg', tcg:'tcg.jpg',
    raid:'hub.jpg', stageguard:'signal.jpg'
  };
  /* center = 가운데 어둡기(높을수록 어두움), edge = 양 사이드 어둡기(낮을수록 밝음) */
  var BG_TUNE = {
    hub:      {center:.70, edge:.26, bright:1.06},
    gacha:    {center:.88, edge:.24, bright:1.02},
    memory:   {center:.88, edge:.24, bright:1.02},
    shisen:   {center:.88, edge:.24, bright:1.02},
    signal:   {center:.62, edge:.32, bright:1.08},
    worldcup: {center:.86, edge:.24, bright:1.02},
    merge:    {center:.55, edge:.28, bright:1.05},
    dispatch: {center:.68, edge:.26, bright:1.05},
    tcg:      {center:.86, edge:.24, bright:1.02},
    raid:     {center:.62, edge:.25, bright:1.08},
    stageguard:{center:.58, edge:.25, bright:1.08}
  };

  function loadState(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(raw) return Object.assign({muted:false, volume:0.55, sfxVolume:0.8}, JSON.parse(raw));
    }catch(e){}
    return {muted:false, volume:0.55, sfxVolume:0.8};
  }
  function saveState(s){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch(e){} }

  var state = loadState();
  var bgmAudio = null;
  var currentSetKey = null;
  var sfxCache = {};
  var suspended = false;      /* 화면잠금/탭전환으로 정지된 상태 */
  var wasPlaying = false;

  function pickNext(list, excludeSrc){
    if (list.length <= 1) return list[0];
    var pool = list.filter(function(f){ return ASSET_BASE+'bgm/'+f !== excludeSrc; });
    if (!pool.length) pool = list;
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function playBgm(setKey){
    var list = BGM_SETS[setKey];
    if (!list) return;
    currentSetKey = setKey;
    if (!bgmAudio){
      bgmAudio = new Audio();
      bgmAudio.addEventListener('ended', function(){
        if (!currentSetKey || suspended) return;
        startTrack(pickNext(BGM_SETS[currentSetKey], bgmAudio.src));
      });
    }
    startTrack(list[Math.floor(Math.random()*list.length)]);
  }

  function startTrack(file){
    if (suspended) return;
    bgmAudio.src = ASSET_BASE + 'bgm/' + file;
    bgmAudio.volume = state.muted ? 0 : state.volume;
    bgmAudio.play().catch(function(){});
  }

  function sfx(name){
    if (state.muted || suspended || document.hidden) return;
    var a = sfxCache[name];
    if (!a){
      a = new Audio(ASSET_BASE + 'sfx/' + name + '.mp3');
      sfxCache[name] = a;
    }
    try{
      var node = a.cloneNode();
      node.volume = state.sfxVolume;
      node.play().catch(function(){});
    }catch(e){}
  }

  /* ── 화면잠금 / 탭전환 시 전체 음소거 ──
     폰에서 화면을 잠그면 document.hidden 이 true 가 되지만 <audio> 는 계속 재생되므로
     BGM, 페이지 내 모든 미디어, WebAudio 컨텍스트를 전부 정지시킨다. */
  function allMedia(){
    var out = [];
    try{
      document.querySelectorAll('audio, video').forEach(function(el){ out.push(el); });
    }catch(e){}
    return out;
  }
  function audioContexts(){
    return (window.__xAudioCtxs && window.__xAudioCtxs.length) ? window.__xAudioCtxs : [];
  }
  function suspendAll(){
    if (suspended) return;
    suspended = true;
    if (bgmAudio && !bgmAudio.paused){ wasPlaying = true; bgmAudio.pause(); }
    allMedia().forEach(function(el){
      if (el !== bgmAudio && !el.paused){ el.__xPaused = true; try{ el.pause(); }catch(e){} }
    });
    audioContexts().forEach(function(ctx){
      try{ if (ctx.state === 'running'){ ctx.__xSusp = true; ctx.suspend(); } }catch(e){}
    });
  }
  function resumeAll(){
    if (!suspended) return;
    suspended = false;
    if (wasPlaying && bgmAudio){ wasPlaying = false; bgmAudio.play().catch(function(){}); }
    allMedia().forEach(function(el){
      if (el.__xPaused){ el.__xPaused = false; try{ el.play().catch(function(){}); }catch(e){} }
    });
    audioContexts().forEach(function(ctx){
      try{ if (ctx.__xSusp){ ctx.__xSusp = false; ctx.resume(); } }catch(e){}
    });
  }
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) suspendAll(); else resumeAll();
  });
  /* iOS 등 일부 환경에서 잠금 시 visibilitychange 가 늦거나 안 오는 경우 대비 */
  window.addEventListener('pagehide', suspendAll);
  window.addEventListener('blur', function(){ if (document.hidden) suspendAll(); });
  window.addEventListener('pageshow', function(){ if (!document.hidden) resumeAll(); });
  window.addEventListener('focus', function(){ if (!document.hidden) resumeAll(); });

  /* ── 배경아트 (가운데 어둡게 / 사이드 밝게) + 글자 가독성 ── */
  function setBackground(setKey){
    var file = BG_FILES[setKey];
    if (!file) return;
    var tune = BG_TUNE[setKey] || {center:.85, edge:.28, bright:1.02};
    var url = ASSET_BASE + 'bg/' + file;
    var mid = ((tune.center + tune.edge) / 2).toFixed(2);
    var style = document.createElement('style');
    style.id = 'xaud-bg';
    style.textContent =
      'body::before{content:"";position:fixed;inset:0;z-index:-3;' +
        'background:url("'+url+'") center/cover no-repeat fixed;' +
        'filter:brightness('+tune.bright+') saturate(1.12);}' +
      /* 가운데(게임 영역)는 진하게, 좌우 가장자리로 갈수록 옅게 */
      'body::after{content:"";position:fixed;inset:0;z-index:-2;' +
        'background:radial-gradient(ellipse 60% 82% at 50% 48%,' +
          'rgba(5,6,10,'+tune.center+') 0%,' +
          'rgba(5,6,10,'+mid+') 52%,' +
          'rgba(5,6,10,'+tune.edge+') 100%);}' +
      'body{background:transparent !important;}' +
      /* 기존 장식 레이어는 배경사진을 가리지 않도록 약화 */
      '.bg-fx, .bg-grid{opacity:.45;}' +
      /* 사진 위 글자 가독성 */
      'h1,h2,h3,.hero p,.lede,.sub,.tag,.desc{text-shadow:0 2px 10px rgba(0,0,0,.75);}';
    document.head.appendChild(style);
  }

  function toggleMute(){
    state.muted = !state.muted;
    if (bgmAudio) bgmAudio.volume = state.muted ? 0 : state.volume;
    saveState(state);
    updateMuteBtn();
  }

  var muteBtn;
  function injectMuteToggle(){
    var css = document.createElement('style');
    css.textContent =
      '#xaud-mute{position:fixed;top:10px;right:66px;z-index:301;width:34px;height:34px;border-radius:50%;'+
      'border:1px solid rgba(63,224,255,.4);background:rgba(4,6,12,.86);backdrop-filter:blur(10px);'+
      'color:#cfeaf2;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s ease;}'+
      '#xaud-mute:hover{border-color:#3fe0ff;box-shadow:0 0 12px rgba(63,224,255,.3);}'+
      '@media(max-width:560px){#xaud-mute{top:8px;right:54px;width:30px;height:30px;font-size:13px;}}';
    document.head.appendChild(css);
    muteBtn = document.createElement('button');
    muteBtn.id = 'xaud-mute';
    muteBtn.type = 'button';
    document.body.appendChild(muteBtn);
    muteBtn.addEventListener('click', toggleMute);
    updateMuteBtn();
  }
  function updateMuteBtn(){
    if (!muteBtn) return;
    muteBtn.textContent = state.muted ? '🔇' : '🔊';
    muteBtn.title = state.muted ? '음소거 해제' : '음소거';
  }

  function unlockOnFirstGesture(){
    var handler = function(){
      if (bgmAudio && bgmAudio.paused && currentSetKey && !suspended) bgmAudio.play().catch(function(){});
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
  }

  window.XenaAudio = {
    init: function(setKey){
      injectMuteToggle();
      setBackground(setKey);
      playBgm(setKey);
      unlockOnFirstGesture();
    },
    sfx: sfx,
    suspendAll: suspendAll,
    resumeAll: resumeAll
  };
})();
