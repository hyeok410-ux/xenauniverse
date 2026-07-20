/* XENA GAMES 공용 오디오 매니저 — 게임제작부서
   - 페이지별 BGM 2곡 중 랜덤 재생, 곡이 끝나면 다시 랜덤으로 다음 곡 선택 (연속 반복이어도 상관없음)
   - 공용 효과음(SFX) 재생 함수 제공
   - localStorage에 음소거/볼륨 상태 저장, 우측 상단 프로필 버튼 옆에 음소거 토글 제공
*/
(function(){
  var LS_KEY = 'xena_audio_v1';
  var ASSET_BASE = (function(){
    // games/ 하위 어느 폴더에서 로드되든 games/_assets/ 를 절대 상대경로로 찾음
    var scripts = document.getElementsByTagName('script');
    for (var i=0;i<scripts.length;i++){
      var src = scripts[i].getAttribute('src')||'';
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
    worldcup: ['worldcup_1.mp3','worldcup_2.mp3']
  };
  var BG_FILES = {
    hub:'hub.jpg', gacha:'gacha.jpg', memory:'memory.jpg',
    shisen:'shisen.jpg', signal:'signal.jpg', worldcup:'worldcup.jpg'
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

  function pickNext(list, excludeSrc){
    if (list.length === 1) return list[0];
    var candidates = list.filter(function(f){ return excludeSrc.indexOf(f) === -1 || list.length === 1; });
    var pool = list.length > 1 ? list.filter(function(f){ return ASSET_BASE+'bgm/'+f !== excludeSrc; }) : list;
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
        if (!currentSetKey) return;
        var l = BGM_SETS[currentSetKey];
        var next = pickNext(l, bgmAudio.src);
        startTrack(next);
      });
    }
    var first = list[Math.floor(Math.random()*list.length)];
    startTrack(first);
  }

  function startTrack(file){
    bgmAudio.src = ASSET_BASE + 'bgm/' + file;
    bgmAudio.volume = state.muted ? 0 : state.volume;
    bgmAudio.play().catch(function(){ /* 오토플레이 차단 시 첫 클릭에서 재시도 */ });
  }

  function sfx(name){
    if (state.muted) return;
    var key = name;
    var a = sfxCache[key];
    if (!a){
      a = new Audio(ASSET_BASE + 'sfx/' + name + '.mp3');
      sfxCache[key] = a;
    }
    try{
      var node = a.cloneNode();
      node.volume = state.sfxVolume;
      node.play().catch(function(){});
    }catch(e){}
  }

  function setBackground(setKey){
    var file = BG_FILES[setKey];
    if (!file) return;
    var url = ASSET_BASE + 'bg/' + file;
    var style = document.createElement('style');
    style.textContent =
      'body::before{content:"";position:fixed;inset:0;z-index:-2;' +
      'background:url("'+url+'") center/cover no-repeat fixed;}' +
      'body::after{content:"";position:fixed;inset:0;z-index:-1;' +
      'background:linear-gradient(180deg, rgba(5,6,10,.82), rgba(5,6,10,.93));}';
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
      if (bgmAudio && bgmAudio.paused && currentSetKey) bgmAudio.play().catch(function(){});
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
    sfx: sfx
  };
})();
