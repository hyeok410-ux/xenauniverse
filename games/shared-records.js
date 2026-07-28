/* Shared per-difficulty AI records for XENA's three main games. */
(function () {
  'use strict';
  var KEY = 'xena_ai_records_v1';
  var DIFFICULTIES = ['easy', 'normal', 'hard', 'veryhard'];
  var GAMES = ['override_grid', 'signal_clash', 'signal_warfare'];

  function blankLine(){ return { wins:0, losses:0, draws:0 }; }
  function blankGame(){ return { easy:blankLine(), normal:blankLine(), hard:blankLine(), veryhard:blankLine() }; }
  function read(){
    var data = {};
    try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
    GAMES.forEach(function (game) {
      if (!data[game] || typeof data[game] !== 'object') data[game] = blankGame();
      DIFFICULTIES.forEach(function (difficulty) {
        var line = data[game][difficulty] || {};
        data[game][difficulty] = {
          wins: Math.max(0, Number(line.wins) || 0),
          losses: Math.max(0, Number(line.losses) || 0),
          draws: Math.max(0, Number(line.draws) || 0)
        };
      });
    });
    return data;
  }
  function write(data){ try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} }
  function snapshot(game){
    var data = read();
    return game ? data[game] : data;
  }
  function record(game, difficulty, outcome){
    if (GAMES.indexOf(game) < 0 || DIFFICULTIES.indexOf(difficulty) < 0) return snapshot(game);
    var field = outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : outcome === 'draw' ? 'draws' : '';
    if (!field) return snapshot(game);
    var data = read();
    data[game][difficulty][field] += 1;
    write(data);
    window.dispatchEvent(new CustomEvent('xena-records-change', { detail:{ game:game } }));
    return data[game];
  }
  function ensureStyle(){
    if (document.getElementById('xena-records-style')) return;
    var style = document.createElement('style');
    style.id = 'xena-records-style';
    style.textContent = '.xena-ai-records{position:fixed;right:12px;bottom:12px;z-index:8000;width:min(310px,calc(100vw - 24px));border:1px solid rgba(63,224,255,.35);border-radius:14px;background:rgba(5,8,17,.93);color:#eaf9ff;font:600 11px/1.35 ui-monospace,monospace;box-shadow:0 12px 38px rgba(0,0,0,.48),0 0 22px rgba(63,224,255,.12);backdrop-filter:blur(12px)}.xena-ai-records summary{cursor:pointer;padding:10px 13px;color:#70efff;letter-spacing:.12em}.xena-record-grid{display:grid;grid-template-columns:1fr repeat(3,auto);gap:6px 12px;padding:0 13px 12px}.xena-record-grid b{color:#fff}.xena-record-grid span{color:#a8b6c9}.xena-record-grid .head{font-size:9px;color:#ff67c8;letter-spacing:.08em}@media(max-width:600px){.xena-ai-records{right:8px;bottom:8px}.xena-ai-records summary{padding:8px 11px}}';
    document.head.appendChild(style);
  }
  function render(target, game, language){
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || GAMES.indexOf(game) < 0) return;
    var labels = language === 'ko'
      ? { easy:'쉬움', normal:'보통', hard:'어려움', veryhard:'매우 어려움', win:'승', loss:'패', draw:'무' }
      : { easy:'EASY', normal:'NORMAL', hard:'HARD', veryhard:'VERY HARD', win:'W', loss:'L', draw:'D' };
    var r = snapshot(game);
    host.innerHTML = '<table><thead><tr><th></th><th>'+labels.win+'</th><th>'+labels.loss+'</th><th>'+labels.draw+'</th></tr></thead><tbody>' +
      DIFFICULTIES.map(function(d){ var v=r[d]; return '<tr><th>'+labels[d]+'</th><td>'+v.wins+'</td><td>'+v.losses+'</td><td>'+v.draws+'</td></tr>'; }).join('') +
      '</tbody></table>';
  }
  function mount(game, target){
    if (GAMES.indexOf(game) < 0) return null;
    ensureStyle();
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    var el = document.createElement('details');
    el.className = 'xena-ai-records';
    el.dataset.game = game;
    function render(){
      var r = snapshot(game);
      el.innerHTML = '<summary>AI RECORDS · DIFFICULTY</summary><div class="xena-record-grid"><i></i><span class="head">W</span><span class="head">L</span><span class="head">D</span>' + DIFFICULTIES.map(function (d) { var v=r[d]; return '<b>'+d.toUpperCase()+'</b><span>'+v.wins+'</span><span>'+v.losses+'</span><span>'+v.draws+'</span>'; }).join('') + '</div>';
    }
    render();
    (host || document.body).appendChild(el);
    window.addEventListener('xena-records-change', function (event) { if (!event.detail || event.detail.game === game) render(); });
    return el;
  }
  window.XenaRecords = Object.freeze({ record:record, snapshot:snapshot, mount:mount, render:render });
}());
