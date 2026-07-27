/* XENA: SIGNAL WARFARE — standalone PvE client.  The battle scene is never
   dependent on an audio, wallet, or collection request completing. */
(function () {
  'use strict';

  var DIFFICULTY = {
    easy: { core: 20, reward: 50 },
    normal: { core: 30, reward: 100 },
    hard: { core: 40, reward: 150 }
  };
  var SFX = {
    draw: 'assets/audio/sfx_card_draw.mp3', summon: 'assets/audio/sfx_card_summon.mp3',
    hit: 'assets/audio/sfx_attack_impact.mp3', shatter: 'assets/audio/sfx_card_shatter.mp3'
  };
  var state = { difficulty: 'normal', selected: new Set(), game: null, handIndex: null, attacker: null, walletOff: null };
  var $ = function (s) { return document.querySelector(s); };

  function play(path) {
    if (window.XenaAudio && window.XenaAudio.playSfx) { window.XenaAudio.playSfx(path); return; }
    try { var a = new Audio(path); a.volume = .65; a.play().catch(function () {}); } catch (_) {}
  }
  function cards() {
    var source = window.XenaCards;
    var list = source && source.owned ? source.owned() : [];
    if (!list || !list.length) list = source && source.available ? source.available() : (source && source.all ? source.all() : []);
    list = (list || []).map(normalize).filter(function (c) { return c.id; });
    /* A fresh visitor must still be able to enter the tutorial battle. */
    if (!list.length) {
      for (var i = 1; i <= 15; i++) list.push({ id: 'tutorial-' + i, name: 'XENA SIGNAL ' + i, grade: 'R', cost: 1 + (i % 4), atk: 2 + (i % 5), hp: 5 + (i % 5), image: '../../game/assets/backgrounds/xena-hero-bg.jpg' });
    }
    return list;
  }
  function normalize(c) {
    var stat = (window.XenaCards && window.XenaCards.GRADE_STATS && window.XenaCards.GRADE_STATS[c.grade]) || {};
    var power = Number(c.power || c.atk || stat.power || 3);
    return { id: String(c.id), name: c.name || c.id || 'XENA CARD', grade: c.grade || 'N', cost: Number(c.cost || stat.cost || 1), atk: power, hp: Number(c.hp || power + 3), image: c.image || c.img || '../../game/assets/backgrounds/xena-hero-bg.jpg' };
  }
  function shuffle(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function deckForBattle() {
    var all = cards(), wanted = Array.from(state.selected), chosen = all.filter(function (c) { return wanted.indexOf(c.id) >= 0; });
    if (chosen.length < 15) { all.forEach(function (c) { if (chosen.length < 15 && chosen.indexOf(c) < 0) chosen.push(c); }); }
    while (chosen.length < 15) chosen.push(Object.assign({}, chosen[chosen.length % Math.max(1, chosen.length)] || all[0], { id: 'clone-' + chosen.length }));
    return shuffle(chosen.slice(0, 15));
  }
  function player(id, deck, core) { return { id: id, core: core, mana: 0, maxMana: 0, deck: deck.slice(5), hand: deck.slice(0, 5), field: Array(7).fill(null) }; }
  function show(view) { ['lobby', 'cards-view', 'battle-view'].forEach(function (id) { $('#' + id).hidden = id !== view; }); }
  function status(msg) { $('#lobby-status').textContent = msg || ''; }
  function cardHtml(c) {
    return '<img class="card-art" src="' + esc(c.image) + '" alt="" loading="lazy"><div class="card-meta"><span class="card-grade">' + esc(c.grade) + '</span><span class="card-hp">HP ' + c.hp + '</span><strong class="card-name">' + esc(c.name) + '</strong><div class="card-stats"><b class="card-cost">C ' + c.cost + '</b><b class="card-atk">ATK ' + c.atk + '</b></div></div>';
  }
  function esc(v) { return String(v || '').replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function renderCollection() {
    var list = $('#card-list'); list.innerHTML = '';
    cards().forEach(function (c) {
      var el = document.createElement('button'); el.type = 'button'; el.className = 'collection-card' + (state.selected.has(c.id) ? ' selected' : ''); el.innerHTML = cardHtml(c);
      el.onclick = function () { if (state.selected.has(c.id)) state.selected.delete(c.id); else if (state.selected.size < 15) state.selected.add(c.id); renderCollection(); };
      list.appendChild(el);
    });
    $('#deck-count').textContent = state.selected.size;
  }
  function startTurn(p) {
    p.maxMana = Math.min(10, p.maxMana + 1); p.mana = p.maxMana;
    p.field.forEach(function (u) { if (u) u.attacked = false; });
    if (p.deck.length) { p.hand.push(p.deck.shift()); if (p.id === 'player') play(SFX.draw); }
  }
  async function startBattle() {
    if (state.game) return;
    var start = $('#start-pve'); start.disabled = true; status('Preparing battle…');
    try {
      if (window.XenaWallet && window.XenaWallet.consumeEnergy) await window.XenaWallet.consumeEnergy('signal_warfare');
    } catch (err) { status('No energy available. Wait for a gem to recharge.'); start.disabled = false; return; }
    var deck = deckForBattle(), conf = DIFFICULTY[state.difficulty], first = Math.random() < .5 ? 'player' : 'ai';
    state.game = { difficulty: state.difficulty, first: first, active: first, round: 1, player: player('player', deck, 30), ai: player('ai', shuffle(cards().concat(cards())), conf.core) };
    /* setup → Start click → coin toss → battle.  Do not mount the battle board
       until the toss resolves, which prevents the old overlay/render deadlock. */
    await coin(first);
    startTurn(state.game[first]);
    show('battle');
    renderBattle();
    if (first === 'ai') aiTurn();
  }
  function coin(first) {
    var overlay = $('#coin-toss'), result = $('#coin-result'); overlay.hidden = false; result.textContent = '';
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (done) return; done = true; overlay.hidden = true; resolve(); }
      setTimeout(function () { result.textContent = first === 'player' ? 'YOU GO FIRST' : 'AI GOES FIRST'; setTimeout(finish, 700); }, 1400);
      /* Fail-open guard: a visual asset may fail, but a match must never freeze. */
      setTimeout(finish, 2600);
    });
  }
  function unit(c, side, slot) {
    var el = document.createElement('article'); el.className = 'card-unit'; el.dataset.side = side; el.dataset.slot = slot; el.innerHTML = cardHtml(c);
    if (side === 'player') el.onclick = function (e) { e.stopPropagation(); selectAttacker(slot); };
    else if (state.attacker !== null) { el.classList.add('target-ready'); el.onclick = function (e) { e.stopPropagation(); attackUnit(slot); }; }
    if (side === 'player' && state.attacker === slot) el.classList.add('attacker-selected');
    return el;
  }
  function renderZone(node, list, side) {
    node.innerHTML = '';
    list.forEach(function (c, i) {
      var slot = document.createElement('div'); slot.className = 'slot';
      if (side === 'player' && state.handIndex !== null && !c) slot.classList.add('can-drop');
      if (c) slot.appendChild(unit(c, side, i));
      if (side === 'player') slot.onclick = function () { deploy(i); };
      node.appendChild(slot);
    });
  }
  function renderBattle() {
    var g = state.game; if (!g) return;
    var p = g.player, ai = g.ai;
    $('#difficulty-label').textContent = g.difficulty.toUpperCase() + ' · ' + DIFFICULTY[g.difficulty].reward + ' XC';
    $('#phase-label').textContent = g.active === 'player' ? 'YOUR TURN' : 'AI TURN';
    $('#turn-rule').textContent = g.round === 1 ? 'FIRST TURN · NO ATTACK' : '';
    $('#player-core').innerHTML = '<span>YOUR CORE · MANA ' + p.mana + '/' + p.maxMana + '</span><b>' + p.core + '</b>';
    $('#ai-core').innerHTML = '<span>AI CORE</span><b>' + ai.core + '</b>';
    $('#ai-core').onclick = function () { if (!ai.field.some(Boolean)) attackCore(); };
    $('#ai-core').classList.toggle('target-ready', state.attacker !== null && !ai.field.some(Boolean));
    renderZone($('#player-field'), p.field, 'player'); renderZone($('#ai-field'), ai.field, 'ai');
    var hand = $('#hand'); hand.innerHTML = '';
    p.hand.forEach(function (c, i) { var el = unit(c, 'hand', i); el.classList.toggle('selected', state.handIndex === i); el.onclick = function () { if (g.active === 'player') { state.handIndex = i; state.attacker = null; renderBattle(); } }; hand.appendChild(el); });
    $('#end-turn').disabled = g.active !== 'player';
  }
  function deploy(slot) {
    var g = state.game, p = g && g.player, c = p && p.hand[state.handIndex];
    if (!g || g.active !== 'player' || !c || p.field[slot] || p.mana < c.cost) return;
    p.mana -= c.cost; p.field[slot] = Object.assign({}, c, { attacked: false }); p.hand.splice(state.handIndex, 1); state.handIndex = null; play(SFX.summon); renderBattle();
  }
  function selectAttacker(slot) { var g = state.game, c = g && g.player.field[slot]; if (!g || g.active !== 'player' || !c || c.attacked || g.round === 1) return; state.attacker = state.attacker === slot ? null : slot; state.handIndex = null; renderBattle(); }
  async function attackUnit(slot) { var g = state.game, a = g && g.player.field[state.attacker], target = g && g.ai.field[slot]; if (!a || !target) return; var source = state.attacker; state.attacker = null; a.attacked = true; await hit('player', source, 'ai', slot); target.hp -= a.atk; if (target.hp <= 0) { g.ai.field[slot] = null; play(SFX.shatter); } renderBattle(); }
  async function attackCore() { var g = state.game, a = g && g.player.field[state.attacker]; if (!a || g.ai.field.some(Boolean)) return; a.attacked = true; state.attacker = null; await hit('player', a, null, 'ai-core'); g.ai.core = Math.max(0, g.ai.core - a.atk); if (g.ai.core <= 0) finish(true); else renderBattle(); }
  function hit(side, source, targetSide, targetSlot) { play(SFX.hit); $('#xena-tcg-container').classList.add('camera-shake'); return new Promise(function (resolve) { setTimeout(function () { $('#xena-tcg-container').classList.remove('camera-shake'); resolve(); }, 260); }); }
  function endTurn() { var g = state.game; if (!g || g.active !== 'player') return; state.handIndex = null; state.attacker = null; g.active = 'ai'; startTurn(g.ai); renderBattle(); aiTurn(); }
  async function aiTurn() {
    var g = state.game; if (!g || g.active !== 'ai') return;
    await wait(450);
    var ai = g.ai, cardIndex = ai.hand.findIndex(function (c) { return c.cost <= ai.mana; }), empty = ai.field.findIndex(function (c) { return !c; });
    if (cardIndex >= 0 && empty >= 0) { var c = ai.hand.splice(cardIndex, 1)[0]; ai.mana -= c.cost; ai.field[empty] = Object.assign({}, c, { attacked: false }); play(SFX.summon); renderBattle(); await wait(500); }
    if (g.round > 1) {
      for (var i = 0; i < ai.field.length; i++) { var a = ai.field[i]; if (!a || a.attacked) continue; a.attacked = true; var target = g.player.field.findIndex(Boolean); await hit('ai', i, target >= 0 ? 'player' : null, target >= 0 ? target : 'player-core'); if (target >= 0) { g.player.field[target].hp -= a.atk; if (g.player.field[target].hp <= 0) { g.player.field[target] = null; play(SFX.shatter); } } else g.player.core = Math.max(0, g.player.core - a.atk); if (g.player.core <= 0) { finish(false); return; } renderBattle(); await wait(220); }
    }
    g.round++; g.active = 'player'; startTurn(g.player); renderBattle();
  }
  async function finish(won) {
    var g = state.game; if (!g) return; var msg = won ? 'VICTORY · ' + DIFFICULTY[g.difficulty].reward + ' XC' : 'DEFEAT';
    if (won && window.XenaWallet && window.XenaWallet.claimTcgMatch) { try { var r = await window.XenaWallet.claimTcgMatch(g.difficulty, 'win'); msg = 'VICTORY · ' + (r.granted || DIFFICULTY[g.difficulty].reward) + ' XC'; } catch (_) { msg += ' · reward sync pending'; } }
    var overlay = document.createElement('section'); overlay.className = 'coin-overlay'; overlay.innerHTML = '<div class="lobby-panel" style="max-width:390px;text-align:center"><h2>' + msg + '</h2><p>Battle complete.</p><button class="button button-primary">RETURN TO LOBBY</button></div>';
    overlay.querySelector('button').onclick = function () { overlay.remove(); state.game = null; show('lobby'); $('#start-pve').disabled = false; };
    $('#battle-view').appendChild(overlay);
  }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function wireWallet() {
    function paint(v) { $('#xc-display').textContent = v == null ? 'XC —' : Number(v).toLocaleString() + ' XC'; }
    if (!window.XenaWallet) return paint(null); paint(window.XenaWallet.getBalance && window.XenaWallet.getBalance());
    if (!state.walletOff && window.XenaWallet.subscribe) state.walletOff = window.XenaWallet.subscribe(paint);
  }
  function init() {
    try { JSON.parse(localStorage.getItem('xena-signal-warfare-deck') || '[]').forEach(function (id) { state.selected.add(id); }); } catch (_) {}
    $('[data-difficulty="normal"]').classList.add('selected');
    document.querySelectorAll('[data-difficulty]').forEach(function (b) { b.onclick = function () { state.difficulty = b.dataset.difficulty; document.querySelectorAll('[data-difficulty]').forEach(function (x) { x.classList.toggle('selected', x === b); }); }; });
    $('#my-cards-button').onclick = function () { show('cards-view'); renderCollection(); };
    $('#cards-back').onclick = function () { show('lobby'); };
    $('#save-deck').onclick = function () { localStorage.setItem('xena-signal-warfare-deck', JSON.stringify(Array.from(state.selected))); $('#deck-status').textContent = 'Deck saved (' + state.selected.size + '/15).'; };
    $('#start-pve').onclick = startBattle; $('#end-turn').onclick = endTurn; $('#battle-exit').onclick = function () { location.href = '../'; }; $('#refresh-balance').onclick = wireWallet;
    $('#mute-local').onclick = function () { if (window.XenaAudio && window.XenaAudio.toggleMute) window.XenaAudio.toggleMute(); };
    document.querySelectorAll('[data-language]').forEach(function (b) { b.onclick = function () { document.documentElement.lang = b.dataset.language; document.querySelectorAll('[data-language]').forEach(function (x) { x.classList.toggle('active', x === b); }); }; });
    wireWallet();
  }
  document.addEventListener('DOMContentLoaded', init);
}());
