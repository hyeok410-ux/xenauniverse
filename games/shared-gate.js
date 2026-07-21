/* XENA GAMES 로그인 게이트 (게임제작부서)
   games/ 이하 모든 페이지는 Google 로그인 전에는 플레이할 수 없다.
   전체화면 오버레이로 덮어 클릭/터치를 막고, shared-identity.js 가 로그인+닉네임
   설정까지 마쳤다고 알려주면(state.signedIn && state.nickname) 오버레이를 걷는다.

   로드 순서: firebase-config.js → cloud-sync.js → shared-identity.js → shared-gate.js
*/
(function(){
  'use strict';
  function lang(){ return (document.documentElement.lang === 'en') ? 'en' : 'ko'; }
  function tt(obj){ return obj[lang()] || obj.ko; }

  var style = document.createElement('style');
  style.textContent =
    '#xgate{position:fixed;inset:0;z-index:900;background:rgba(3,4,10,.97);backdrop-filter:blur(10px);'+
      'display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;}'+
    '#xgate.hide{display:none;}'+
    '#xgate .xgate-box{max-width:360px;}'+
    '#xgate .xgate-mark{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.4em;color:#3fe0ff;'+
      'text-shadow:0 0 16px rgba(63,224,255,.5);margin-bottom:18px;text-transform:uppercase;}'+
    '#xgate h2{font-family:-apple-system,"Segoe UI",sans-serif;font-size:1.5rem;font-weight:800;color:#fff;margin-bottom:12px;}'+
    '#xgate p{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.78rem;color:#c4c1da;line-height:1.7;margin-bottom:26px;}'+
    '#xgate-btn{font-family:-apple-system,"Segoe UI",sans-serif;font-size:.92rem;font-weight:700;color:#0a0912;'+
      'background:linear-gradient(120deg,#3fe0ff,#a06bff);border:none;padding:14px 30px;border-radius:26px;'+
      'cursor:pointer;box-shadow:0 8px 24px rgba(63,224,255,.25);}'+
    '#xgate-btn:disabled{opacity:.5;cursor:default;}'+
    '#xgate-err{margin-top:14px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.68rem;color:#ff6b8a;min-height:1em;}';
  document.head.appendChild(style);

  var gate = document.createElement('div');
  gate.id = 'xgate';
  gate.innerHTML =
    '<div class="xgate-box">'+
      '<div class="xgate-mark">XENA GAMES</div>'+
      '<h2>'+tt({ko:'로그인 후 플레이할 수 있습니다', en:'Sign in to play'})+'</h2>'+
      '<p>'+tt({ko:'모든 XENA 미니게임은 Google 로그인 회원만 플레이할 수 있어요.<br>기록과 주간 랭킹이 내 계정에 안전하게 저장됩니다.',
                 en:'All XENA mini-games require a Google sign-in.<br>Your records and weekly ranking are saved to your account.'})+'</p>'+
      '<button id="xgate-btn">'+tt({ko:'Google로 로그인',en:'Sign in with Google'})+'</button>'+
      '<div id="xgate-err"></div>'+
    '</div>';
  document.documentElement.appendChild(gate);
  document.body.style.overflow = 'hidden'; /* 게이트 떠 있는 동안 뒤 스크롤 방지 */

  function reveal(){
    gate.classList.add('hide');
    document.body.style.overflow = '';
  }

  var btn = document.getElementById('xgate-btn');
  var err = document.getElementById('xgate-err');
  btn.addEventListener('click', function(){
    if (!window.XenaIdentity) return;
    btn.disabled = true;
    err.textContent = '';
    window.XenaIdentity.signIn().catch(function(){
      err.textContent = tt({ko:'로그인에 실패했습니다. 팝업 차단을 확인해주세요.', en:'Sign-in failed. Please check your popup blocker.'});
    }).finally(function(){ btn.disabled = false; });
  });

  function waitForIdentity(){
    if (!window.XenaIdentity){ setTimeout(waitForIdentity, 50); return; }
    window.XenaIdentity.subscribe(function(state){
      if (state.signedIn && state.nickname) reveal();
    });
  }
  waitForIdentity();
})();
