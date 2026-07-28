/* XENA: SIGNAL WARFARE — standalone PvE client */
(function () {
  'use strict';

  var DIFFICULTY = {
    easy: { core: 20, reward: 50, tcgChance: 0, exactTcg: 2 },
    normal: { core: 30, reward: 100, tcgChance: .4 },
    hard: { core: 40, reward: 150, tcgChance: .7 },
    veryhard: { core: 50, reward: 200, tcgChance: 1 }
  };
  var AFFINITY = { SOUND: 'SOUL', SOUL: 'DARK', DARK: 'LIGHT', LIGHT: 'METAL', METAL: 'BUG', BUG: 'ANOMALY', ANOMALY: 'SOUND' };
  var SFX = { draw: 'assets/audio/sfx_card_draw.mp3', summon: 'assets/audio/sfx_card_summon.mp3', hit: 'assets/audio/sfx_attack_impact.mp3', shatter: 'assets/audio/sfx_card_shatter.mp3' };
  var state = { language: 'ko', difficulty: 'normal', selected: [], game: null, handIndex: null, attacker: null, walletOff: null };
  var $ = function (s) { return document.querySelector(s); };
  var tr = function (ko, en) { return state.language === 'ko' ? ko : en; };

  function play(path) {
    if (window.XenaAudio && window.XenaAudio.playSfx) return window.XenaAudio.playSfx(path);
    try { var a = new Audio(path); a.volume = .65; a.play().catch(function () {}); } catch (_) {}
  }
  function normalize(c) {
    var stat = (window.XenaCards && window.XenaCards.GRADE_STATS && window.XenaCards.GRADE_STATS[c.grade]) || {};
    var power = Number(c.power != null ? c.power : (c.atk != null ? c.atk : (stat.power || 3)));
    return {
      id: String(c.id || ''), name: c.name || c.id || 'XENA CARD', grade: c.grade || 'N',
      cost: Number(c.cost != null ? c.cost : (stat.cost || 1)), atk: power, baseAtk: power,
      hp: Number(c.hp || power + 3), maxHp: Number(c.hp || power + 3), count: Math.max(1, Number(c.count) || 1),
      image: c.image || c.img || '../../game/assets/backgrounds/xena-hero-bg.jpg',
      element: String(c.element || '').toUpperCase(), person: c.person || null,
      effect: c.effect || null, ability: c.ability || null, isTcg: /^PC-\d+$/i.test(String(c.id || ''))
    };
  }
  function cards() {
    var source = window.XenaCards, owned = source && source.owned ? source.owned() : [];
    var list = (owned || []).filter(function (c) { return c && c.isTcg; });
    if (!list.length) list = source && source.tcg ? source.tcg() : [];
    list = (list || []).map(normalize).filter(function (c) { return c.id; });
    if (!list.length) for (var i = 1; i <= 15; i++) list.push(normalize({ id: 'tutorial-' + i, name: 'XENA SIGNAL ' + i, grade: 'R', cost: 1 + i % 4, power: 2 + i % 5, hp: 5 + i % 5 }));
    return list;
  }
  function allCards() {
    var source = window.XenaCards, list = source && source.tcg ? source.tcg() : [];
    return (list || []).map(normalize).filter(function (c) { return c.id; });
  }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function choose(pool) { return pool[Math.floor(Math.random() * pool.length)]; }
  function aiDeck(level) {
    var all = allCards(), tcg = all.filter(function (c) { return c.isTcg; }), gallery = all.filter(function (c) { return !c.isTcg; });
    if (!tcg.length) tcg = cards().filter(function (c) { return c.isTcg; });
    if (!gallery.length) gallery = cards().filter(function (c) { return !c.isTcg; });
    if (!gallery.length) gallery = tcg;
    var conf = DIFFICULTY[level], out = [], i;
    if (conf.exactTcg) {
      var picked = shuffle(tcg).slice(0, conf.exactTcg);
      picked.forEach(function (c) { out.push(Object.assign({}, c)); });
      while (out.length < 15) out.push(Object.assign({}, choose(gallery)));
    } else if (level === 'veryhard') {
      var strong = tcg.slice().sort(function (a, b) { return (b.atk + b.hp - b.cost) - (a.atk + a.hp - a.cost); }).slice(0, Math.max(30, Math.ceil(tcg.length * .55)));
      while (out.length < 15) out.push(Object.assign({}, choose(strong.length ? strong : tcg)));
    } else {
      for (i = 0; i < 15; i++) {
        var pool = Math.random() < conf.tcgChance && tcg.length ? tcg : gallery;
        out.push(Object.assign({}, choose(pool)));
      }
    }
    return shuffle(out);
  }
  function deckForBattle() {
    var all = cards(), byId = {}, chosen = [];
    all.forEach(function (c) { byId[c.id] = c; });
    state.selected.forEach(function (id) { if (byId[id]) chosen.push(Object.assign({}, byId[id])); });
    while (chosen.length < 15 && all.length) chosen.push(Object.assign({}, all[chosen.length % all.length]));
    return shuffle(chosen.slice(0, 15));
  }
  function player(id, deck, core) { return { id: id, core: core, mana: 0, maxMana: 0, deck: deck.slice(5), hand: deck.slice(0, 5), field: Array(7).fill(null), nextBuff: 0 }; }
  function show(view) { ['lobby', 'cards-view', 'battle-view'].forEach(function (id) { $('#' + id).hidden = id !== view; }); }
  function status(msg) { $('#lobby-status').textContent = msg || ''; }
  function esc(v) { return String(v || '').replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function collectionCardHtml(c) {
    return '<img class="card-art" src="' + esc(c.image) + '" alt="" loading="lazy"><div class="card-meta"><span class="card-grade">' + esc(c.grade) + '</span><span class="card-hp">HP ' + c.hp + '</span><strong class="card-name">' + esc(c.name) + '</strong><div class="card-stats"><b class="card-cost">C ' + c.cost + '</b><b class="card-atk">ATK ' + c.atk + '</b></div></div>';
  }
  function battleCardHtml(c) {
    return '<img class="card-art" src="' + esc(c.image) + '" alt="' + esc(c.name) + '"><span class="battle-hp">HP ' + c.hp + '</span>';
  }
  function renderCollection() {
    var list = $('#card-list'); list.innerHTML = '';
    cards().forEach(function (c) {
      var selectedCount = state.selected.filter(function (id) { return id === c.id; }).length;
      var maxCopies = Math.min(2, c.count);
      var el = document.createElement('button'); el.type = 'button'; el.className = 'collection-card' + (selectedCount ? ' selected' : '');
      el.innerHTML = collectionCardHtml(c) + '<span class="deck-copy-count">DECK ' + selectedCount + '/' + maxCopies + '</span>';
      el.onclick = function () {
        var count = state.selected.filter(function (id) { return id === c.id; }).length;
        if (count < maxCopies && state.selected.length < 15) state.selected.push(c.id);
        else if (count > 0) state.selected.splice(state.selected.lastIndexOf(c.id), 1);
        renderCollection();
      };
      list.appendChild(el);
    });
    $('#deck-count').textContent = state.selected.length;
    $('#save-deck').disabled = state.selected.length !== 15;
  }
  function startTurn(p) {
    p.maxMana = Math.min(10, p.maxMana + 1); p.mana = p.maxMana;
    p.field.forEach(function (u) { if (u) u.attacked = false; });
    if (p.deck.length) { p.hand.push(p.deck.shift()); if (p.id === 'player') play(SFX.draw); }
  }
  async function startBattle() {
    if (state.game) return;
    if (state.selected.length !== 15) { status(tr('먼저 내 카드에서 15장 덱을 완성하세요.', 'Complete your 15-card deck first.')); show('cards-view'); renderCollection(); return; }
    var start = $('#start-pve'); start.disabled = true; status(tr('전투를 준비하고 있습니다…', 'Preparing battle…'));
    try { if (window.XenaWallet && window.XenaWallet.consumeEnergy) await window.XenaWallet.consumeEnergy('signal_warfare'); }
    catch (_) { status(tr('보석이 부족합니다. 충전을 기다려 주세요.', 'No gems available. Wait for recharge.')); start.disabled = false; return; }
    var conf = DIFFICULTY[state.difficulty], first = Math.random() < .5 ? 'player' : 'ai';
    state.game = { difficulty: state.difficulty, first: first, active: first, round: 1, player: player('player', deckForBattle(), 30), ai: player('ai', aiDeck(state.difficulty), conf.core) };
    await coin(first);
    startTurn(state.game[first]); show('battle-view'); renderBattle();
    if (first === 'ai') aiTurn();
  }
  function coin(first) {
    var overlay = $('#coin-toss'), result = $('#coin-result'); overlay.hidden = false; result.textContent = '';
    return new Promise(function (resolve) {
      var done = false;
      function complete() { if (done) return; done = true; overlay.hidden = true; resolve(); }
      setTimeout(function () { result.textContent = first === 'player' ? tr('선공입니다', 'YOU GO FIRST') : tr('AI가 선공입니다', 'AI GOES FIRST'); setTimeout(complete, 700); }, 1400);
      setTimeout(complete, 2600);
    });
  }
  function unit(c, side, slot) {
    var el = document.createElement('article'); el.className = 'card-unit'; el.dataset.side = side; el.dataset.slot = slot; el.innerHTML = battleCardHtml(c);
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
    $('#phase-label').textContent = g.active === 'player' ? tr('내 턴', 'YOUR TURN') : tr('AI 턴', 'AI TURN');
    $('#turn-rule').textContent = g.round === 1 ? tr('첫 턴 공격 불가', 'FIRST TURN · NO ATTACK') : '';
    $('#affinity-rule').textContent = tr('상성 우위 공격 +1: SOUND > SOUL > DARK > LIGHT > METAL > BUG > ANOMALY > SOUND', 'Affinity advantage +1 ATK: SOUND > SOUL > DARK > LIGHT > METAL > BUG > ANOMALY > SOUND');
    $('#player-core').innerHTML = '<span>YOUR CORE · MANA ' + p.mana + '/' + p.maxMana + '</span><b>' + p.core + '</b>';
    $('#ai-core').innerHTML = '<span>AI CORE</span><b>' + ai.core + '</b>';
    $('#ai-core').onclick = function () { if (!ai.field.some(Boolean)) attackCore(); };
    $('#ai-core').classList.toggle('target-ready', state.attacker !== null && !ai.field.some(Boolean));
    renderZone($('#player-field'), p.field, 'player'); renderZone($('#ai-field'), ai.field, 'ai');
    var hand = $('#hand'); hand.innerHTML = '';
    p.hand.forEach(function (c, i) { var el = unit(c, 'hand', i); el.classList.toggle('selected', state.handIndex === i); el.onclick = function () { if (g.active === 'player') { state.handIndex = i; state.attacker = null; renderBattle(); } }; hand.appendChild(el); });
    $('#end-turn').disabled = g.active !== 'player';
  }
  function addPower(card, amount) { if (!card || !amount) return; card.atk = Math.max(0, card.atk + amount); card.hp = Math.max(1, card.hp + amount); card.maxHp = Math.max(card.hp, (card.maxHp || card.hp) + amount); }
  function applyDeployEffect(owner, enemy, card) {
    if (owner.nextBuff) { addPower(card, owner.nextBuff); owner.nextBuff = 0; }
    var e = card.effect || {}, allies = owner.field.filter(Boolean), enemies = enemy.field.filter(Boolean), others = allies.filter(function (x) { return x !== card; });
    switch (e.kind) {
      case 'buff_self_flat': addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_element': if (others.some(function (x) { return x.element === e.el; })) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_person': if (allies.some(function (x) { return x.person === e.person; })) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_only': if (!others.length) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_outnumbered': if (enemies.length > allies.length) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_no_element': if (!others.some(function (x) { return x.element === e.el; })) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_lowerother': if (others.some(function (x) { return x.atk < card.atk; })) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_losing':
        if (allies.reduce(function (sum, x) { return sum + x.atk; }, 0) < enemies.reduce(function (sum, x) { return sum + x.atk; }, 0)) addPower(card, Number(e.amt) || 0);
        break;
      case 'buff_element': allies.forEach(function (x) { if (x !== card && x.element === e.el) addPower(x, Number(e.amt) || 0); }); break;
      case 'buff_person': allies.forEach(function (x) { if (x.person === e.person) addPower(x, Number(e.amt) || 0); }); break;
      case 'buff_all_own': allies.forEach(function (x) { addPower(x, Number(e.amt) || 0); }); break;
      case 'buff_others': others.forEach(function (x) { addPower(x, Number(e.amt) || 0); }); break;
      case 'buff_lowest': if (allies.length) addPower(allies.slice().sort(function (a, b) { return a.atk - b.atk; })[0], Number(e.amt) || 0); break;
      case 'buff_element_count': addPower(card, new Set(allies.map(function (x) { return x.element; }).filter(Boolean)).size * (Number(e.amt) || 1)); break;
      case 'buff_next_only': owner.nextBuff = Number(e.amt) || 0; break;
      case 'debuff_enemy_one': if (enemies.length) addPower(enemies[0], -(Number(e.amt) || 0)); break;
      case 'debuff_enemy_all': enemies.forEach(function (x) { addPower(x, -(Number(e.amt) || 0)); }); break;
    }
  }
  function deploy(slot) {
    var g = state.game, p = g && g.player, c = p && p.hand[state.handIndex];
    if (!g || g.active !== 'player' || !c || p.field[slot] || p.mana < c.cost) return;
    p.mana -= c.cost; p.field[slot] = Object.assign({}, c, { attacked: false }); p.hand.splice(state.handIndex, 1); state.handIndex = null;
    applyDeployEffect(p, g.ai, p.field[slot]); play(SFX.summon); renderBattle();
  }
  function selectAttacker(slot) { var g = state.game, c = g && g.player.field[slot]; if (!g || g.active !== 'player' || !c || c.attacked || g.round === 1) return; state.attacker = state.attacker === slot ? null : slot; state.handIndex = null; renderBattle(); }
  function damage(attacker, target) { return attacker.atk + (target && AFFINITY[attacker.element] === target.element ? 1 : 0); }
  async function attackUnit(slot) {
    var g = state.game, a = g && g.player.field[state.attacker], target = g && g.ai.field[slot];
    if (!a || !target) return;
    var source = state.attacker; state.attacker = null; a.attacked = true; await hit();
    target.hp -= damage(a, target); if (target.hp <= 0) { g.ai.field[slot] = null; play(SFX.shatter); } renderBattle();
  }
  async function attackCore() {
    var g = state.game, a = g && g.player.field[state.attacker]; if (!a || g.ai.field.some(Boolean)) return;
    a.attacked = true; state.attacker = null; await hit(); g.ai.core = Math.max(0, g.ai.core - a.atk); if (g.ai.core <= 0) finish(true); else renderBattle();
  }
  function hit() { play(SFX.hit); $('#xena-tcg-container').classList.add('camera-shake'); return new Promise(function (resolve) { setTimeout(function () { $('#xena-tcg-container').classList.remove('camera-shake'); resolve(); }, 260); }); }
  function endTurn() { var g = state.game; if (!g || g.active !== 'player') return; state.handIndex = null; state.attacker = null; g.active = 'ai'; startTurn(g.ai); renderBattle(); aiTurn(); }
  async function aiTurn() {
    var g = state.game; if (!g || g.active !== 'ai') return;
    await wait(450);
    var ai = g.ai, playable = ai.hand.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return x.c.cost <= ai.mana; }).sort(function (a, b) { return b.c.atk - a.c.atk; });
    var empty = ai.field.findIndex(function (c) { return !c; });
    if (playable.length && empty >= 0) {
      var picked = playable[0], c = ai.hand.splice(picked.i, 1)[0]; ai.mana -= c.cost; ai.field[empty] = Object.assign({}, c, { attacked: false });
      applyDeployEffect(ai, g.player, ai.field[empty]); play(SFX.summon); renderBattle(); await wait(420);
    }
    if (g.round > 1) {
      for (var i = 0; i < ai.field.length; i++) {
        var a = ai.field[i]; if (!a || a.attacked) continue; a.attacked = true;
        var targets = g.player.field.map(function (x, n) { return { x: x, n: n }; }).filter(function (v) { return v.x; }).sort(function (x, y) { return x.x.hp - y.x.hp; });
        await hit();
        if (targets.length) { var t = targets[0]; t.x.hp -= damage(a, t.x); if (t.x.hp <= 0) { g.player.field[t.n] = null; play(SFX.shatter); } }
        else g.player.core = Math.max(0, g.player.core - a.atk);
        if (g.player.core <= 0) { finish(false); return; }
        renderBattle(); await wait(180);
      }
    }
    g.round++; g.active = 'player'; startTurn(g.player); renderBattle();
  }
  async function finish(won) {
    var g = state.game; if (!g) return;
    var granted = DIFFICULTY[g.difficulty].reward;
    if (won && window.XenaWallet && window.XenaWallet.claimTcgMatch) {
      try { var r = await window.XenaWallet.claimTcgMatch(g.difficulty, 'win'); granted = Number(r.granted) || granted; } catch (_) {}
    }
    if (window.XenaRecords && window.XenaRecords.record) window.XenaRecords.record('signal_warfare', g.difficulty, won);
    var title = won ? tr('승리', 'VICTORY') : tr('패배', 'DEFEAT');
    var body = won ? tr('보상 ' + granted + ' XC', 'Reward ' + granted + ' XC') : tr('다시 도전해 보세요.', 'Try again.');
    var overlay = document.createElement('section'); overlay.className = 'coin-overlay'; overlay.innerHTML = '<div class="lobby-panel result-panel"><h2>' + title + '</h2><p>' + body + '</p><button class="button button-primary">' + tr('로비로', 'RETURN TO LOBBY') + '</button></div>';
    overlay.querySelector('button').onclick = function () { overlay.remove(); state.game = null; show('lobby'); $('#start-pve').disabled = false; };
    $('#battle-view').appendChild(overlay);
  }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function wireWallet() {
    function paint(v) { $('#xc-display').textContent = v == null ? 'XC —' : Number(v).toLocaleString() + ' XC'; }
    if (!window.XenaWallet) return paint(null); paint(window.XenaWallet.getBalance && window.XenaWallet.getBalance());
    if (!state.walletOff && window.XenaWallet.subscribe) state.walletOff = window.XenaWallet.subscribe(paint);
  }
  function setLanguage(lang) {
    state.language = lang === 'en' ? 'en' : 'ko'; document.documentElement.lang = state.language;
    document.querySelectorAll('[data-language]').forEach(function (b) { b.classList.toggle('active', b.dataset.language === state.language); });
    if (state.game) renderBattle();
  }
  function showRecords() {
    var modal = $('#record-modal'), box = $('#record-content');
    if (window.XenaRecords && window.XenaRecords.render) window.XenaRecords.render(box, 'signal_warfare', state.language);
    else box.textContent = tr('아직 저장된 전적이 없습니다.', 'No records yet.');
    modal.hidden = false;
  }
  function init() {
    try {
      var saved = JSON.parse(localStorage.getItem('xena-signal-warfare-deck') || '[]');
      if (Array.isArray(saved)) saved.slice(0, 15).forEach(function (id) { if (state.selected.filter(function (x) { return x === id; }).length < 2) state.selected.push(id); });
    } catch (_) {}
    document.querySelectorAll('[data-difficulty]').forEach(function (b) { b.onclick = function () { state.difficulty = b.dataset.difficulty; document.querySelectorAll('[data-difficulty]').forEach(function (x) { x.classList.toggle('selected', x === b); }); }; });
    $('#my-cards-button').onclick = function () { show('cards-view'); renderCollection(); };
    $('#cards-back').onclick = function () { show('lobby'); };
    $('#save-deck').onclick = function () { if (state.selected.length !== 15) return; localStorage.setItem('xena-signal-warfare-deck', JSON.stringify(state.selected)); $('#deck-status').textContent = tr('덱이 저장되었습니다.', 'Deck saved.'); show('lobby'); };
    $('#start-pve').onclick = startBattle; $('#end-turn').onclick = endTurn;
    $('#battle-exit').onclick = function () { state.game = null; show('lobby'); $('#start-pve').disabled = false; };
    $('#refresh-balance').onclick = wireWallet; $('#mute-local').onclick = function () { if (window.XenaAudio && window.XenaAudio.toggleMute) window.XenaAudio.toggleMute(); };
    document.querySelectorAll('[data-language]').forEach(function (b) { b.onclick = function () { setLanguage(b.dataset.language); }; });
    $('#record-button').onclick = showRecords; $('#record-close').onclick = function () { $('#record-modal').hidden = true; };
    setLanguage(localStorage.getItem('xena-language') || document.documentElement.lang || 'ko'); wireWallet();
  }
  document.addEventListener('DOMContentLoaded', init);
}());
