/* XENA GAMES 로그인 게이트 (게임제작부서)
   games/ 이하 모든 페이지는 Google 로그인 전에는 플레이할 수 없다.

   ⚠ 이미 로그인된 사용자에게 "로그인하세요" 문구가 매 페이지 이동마다 잠깐씩
   보였다 사라지는 문제가 있었다 — 정적 다중페이지 사이트라 페이지를 옮길 때마다
   Firebase Auth 세션을 처음부터 다시 확인해야 하는데, 그 확인(수백ms) 동안
   무조건 "로그인하세요" 문구를 먼저 그렸기 때문. 지금은 첫 확인이 끝나기 전까지는
   아무 문구 없는 로딩 화면만 보여주고, 로그인이 안 되어있다고 "확인된" 뒤에야
   로그인 버튼을 그린다. 로그인된 사용자는 로딩 화면만 잠깐 보고 바로 게이트가 걷힌다.

   ── 관리자 전용 베타 잠금 ──
   이 스크립트보다 먼저 `<script>window.__xenaAdminOnly = true;</script>` 를 두면,
   로그인은 됐어도 shared-identity.js 의 ADMIN_UID 가 아니면 게이트가 절대 안 걷힌다
   (버튼도 없음 — 클릭할 대상 자체가 없다). 베타 게임(TCG/방치형) 페이지 전용.

   로드 순서: firebase-config.js → cloud-sync.js → shared-identity.js → shared-gate.js
*/
(function(){
  'use strict';
  function lang(){ return (document.documentElement.lang === 'en') ? 'en' : 'ko'; }
  function tt(obj){ return obj[lang()] || obj.ko; }
  var adminOnly = !!window.__xenaAdminOnly;

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
    '#xgate-err{margin-top:14px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.68rem;color:#ff6b8a;min-height:1em;}'+
    '#xgate .xgate-spin{width:26px;height:26px;border-radius:50%;margin:0 auto;'+
      'border:2px solid rgba(63,224,255,.25);border-top-color:#3fe0ff;animation:xgateSpin .8s linear infinite;}'+
    '@keyframes xgateSpin{to{transform:rotate(360deg);}}'+
    '#xgate .xgate-prompt{display:none;}'+
    '#xgate .xgate-denied{display:none;}'+
    '#xgate.xgate-ready .xgate-spin-wrap{display:none;}'+
    '#xgate.xgate-ready .xgate-prompt{display:block;}'+
    '#xgate.xgate-denied-state .xgate-spin-wrap{display:none;}'+
    '#xgate.xgate-denied-state .xgate-prompt{display:none;}'+
    '#xgate.xgate-denied-state .xgate-denied{display:block;}'+
    '#xgate-back{display:inline-block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.72rem;letter-spacing:.12em;'+
      'color:#c4c1da;border:1px solid rgba(255,255,255,.14);padding:11px 26px;border-radius:24px;text-decoration:none;}'+
    '#xgate-back:hover{color:#fff;border-color:rgba(255,255,255,.3);}';
  document.head.appendChild(style);

  var gate = document.createElement('div');
  gate.id = 'xgate';
  gate.innerHTML =
    '<div class="xgate-box">'+
      '<div class="xgate-mark">XENA GAMES</div>'+
      '<div class="xgate-spin-wrap"><div class="xgate-spin"></div></div>'+
      '<div class="xgate-prompt">'+
        '<h2>'+tt({ko:'로그인 후 플레이할 수 있습니다', en:'Sign in to play'})+'</h2>'+
        '<p>'+tt({ko:'모든 XENA 미니게임은 Google 로그인 회원만 플레이할 수 있어요.<br>기록과 주간 랭킹이 내 계정에 안전하게 저장됩니다.',
                   en:'All XENA mini-games require a Google sign-in.<br>Your records and weekly ranking are saved to your account.'})+'</p>'+
        '<button id="xgate-btn">'+tt({ko:'Google로 로그인',en:'Sign in with Google'})+'</button>'+
        '<div id="xgate-err"></div>'+
      '</div>'+
      '<div class="xgate-denied">'+
        '<h2>'+tt({ko:'관리자 전용 베타', en:'Admin-only beta'})+'</h2>'+
        '<p>'+tt({ko:'이 게임은 아직 대표님만 테스트할 수 있는 비공개 베타입니다.<br>공개되면 여기서 바로 플레이할 수 있어요.',
                   en:'This game is a private beta, testable by the admin only for now.<br>You\'ll be able to play here once it opens up.'})+'</p>'+
        '<a id="xgate-back" href="../">'+tt({ko:'← XENA GAMES로 돌아가기',en:'← Back to XENA GAMES'})+'</a>'+
      '</div>'+
    '</div>';
  document.documentElement.appendChild(gate);
  document.body.style.overflow = 'hidden'; /* 게이트 떠 있는 동안 뒤 스크롤 방지 */

  function reveal(){
    gate.classList.add('hide');
    document.body.style.overflow = '';
  }
  function showPrompt(){
    gate.classList.add('xgate-ready');
  }
  function showDenied(){
    gate.classList.add('xgate-denied-state');
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

  var firstCheckDone = false;
  function evaluate(state){
    if (state.signedIn && state.nickname){
      if (adminOnly && !state.isAdmin){ showDenied(); return; }
      reveal();
      return;
    }
    if (firstCheckDone && !state.signedIn) showPrompt();
  }
  function waitForIdentity(){
    if (!window.XenaIdentity || !window.XenaCloudSync){ setTimeout(waitForIdentity, 50); return; }
    /* 첫 인증상태 확인이 끝나는 시점 = connect() 이행 시점.
       그 전까지는 로딩 스피너만, "로그인하세요" 문구는 절대 먼저 보여주지 않는다. */
    window.XenaCloudSync.connect().catch(function(){}).then(function(){
      firstCheckDone = true;
      evaluate(window.XenaIdentity.getState());
    });
    window.XenaIdentity.subscribe(evaluate);
  }
  waitForIdentity();
})();
