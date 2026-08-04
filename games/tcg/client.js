/* XENA: SIGNAL WARFARE — standalone PvE client */
(function () {
  'use strict';

  var DIFFICULTY = {
    easy: { core: 20, reward: 50, tcgChance: .2, exactTcg: 3 },
    normal: { core: 30, reward: 100, tcgChance: .4 },
    hard: { core: 48, reward: 150, tcgChance: .92 },
    veryhard: { core: 70, reward: 200, tcgChance: 1 }
  };
  var AFFINITY = { SOUND: 'SOUL', SOUL: 'DARK', DARK: 'LIGHT', LIGHT: 'METAL', METAL: 'BUG', BUG: 'ANOMALY', ANOMALY: 'SOUND' };
  var SFX = { draw: 'assets/audio/sfx_card_draw.mp3', summon: 'assets/audio/sfx_card_summon.mp3', hit: 'assets/audio/sfx_attack_impact.mp3', shatter: 'assets/audio/sfx_card_shatter.mp3' };
  var WARFARE_META_DECK = ['PC-02','PC-08','PC-56','PC-72','PC-74','PC-29','PC-03','PC-19','PC-45','PC-32','PC-37','PC-51','PC-01','PC-10','PC-50'];
  var state = { language: 'ko', difficulty: 'normal', selected: [], game: null, handIndex: null, attacker: null, focused: null, walletOff: null };
  var $ = function (s) { return document.querySelector(s); };
  var tr = function (ko, en) { return state.language === 'ko' ? ko : en; };

  function play(path) {
    if (window.XenaAudio && window.XenaAudio.playSfx) return window.XenaAudio.playSfx(path);
    try { var a = new Audio(path); a.volume = .65; a.play().catch(function () {}); } catch (_) {}
  }
  function playVfx(target, kind, options) {
    return window.XenaVfx ? window.XenaVfx.play(target, kind, options) : Promise.resolve(false);
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
    if (level === 'veryhard') {
      /* Deterministic 54,600-match search winner; every card still comes from
         the canonical 90-card pool and obeys the normal one-copy list here. */
      var byId = {}; tcg.forEach(function (c) { byId[c.id] = c; });
      var meta = WARFARE_META_DECK.map(function (id) { return byId[id]; }).filter(Boolean);
      if (meta.length === 15) return shuffle(meta.map(function (c) { return Object.assign({}, c); }));
      var ranked = tcg.slice().sort(function (a, b) { return (b.atk + b.hp * .7 - b.cost * .55) - (a.atk + a.hp * .7 - a.cost * .55); });
      var elite = ranked.slice(0, Math.max(18, Math.ceil(ranked.length * .38)));
      var low = elite.filter(function (c) { return c.cost <= 2; });
      var mid = elite.filter(function (c) { return c.cost >= 3 && c.cost <= 4; });
      var high = elite.filter(function (c) { return c.cost >= 5; });
      function pickCost(pool) { return Object.assign({}, choose(pool.length ? pool : elite)); }
      for (i = 0; i < 5; i++) out.push(pickCost(low));
      for (i = 0; i < 6; i++) out.push(pickCost(mid));
      for (i = 0; i < 4; i++) out.push(pickCost(high));
    } else if (conf.exactTcg) {
      var picked = shuffle(tcg).slice(0, conf.exactTcg);
      picked.forEach(function (c) { out.push(Object.assign({}, c)); });
      while (out.length < 15) out.push(Object.assign({}, choose(gallery)));
    } else {
      var hardMap = {}; tcg.forEach(function (c) { hardMap[c.id] = c; });
      var hardPool = level === 'hard' && tcg.length ? WARFARE_META_DECK.map(function (id) { return hardMap[id]; }).filter(Boolean).concat(tcg.slice().sort(function (a, b) { return (b.atk + b.hp - b.cost) - (a.atk + a.hp - a.cost); }).slice(0, 24)) : tcg;
      for (i = 0; i < 15; i++) {
        var pool = Math.random() < conf.tcgChance && tcg.length ? (level === 'hard' ? hardPool : tcg) : gallery;
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
  function player(id, deck, core, advantage) { return { id: id, core: core, mana: 0, maxMana: 0, deck: deck.slice(5), hand: deck.slice(0, 5), field: Array(7).fill(null), nextBuff: null, nextDebuff: 0, advantage: advantage || null }; }
  function show(view) {
    ['lobby', 'cards-view', 'battle-view'].forEach(function (id) { $('#' + id).hidden = id !== view; });
    if (view !== 'battle-view' && window.XenaMobileImmersive) window.XenaMobileImmersive.exit();
  }
  function status(msg) { $('#lobby-status').textContent = msg || ''; }
  function esc(v) { return String(v || '').replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function collectionCardHtml(c) {
    /* Card artwork already contains its own grade, name, cost and power. */
    return '<img class="card-art collection-art" src="' + esc(c.image) + '" alt="' + esc(c.name) + '" loading="lazy">';
  }
  function battleCardHtml(c) {
    /* The artwork contains the printed power in its top-right corner.  When a
       card is buffed/debuffed, cover that printed value with the live value
       at the exact same HUD position instead of leaving two conflicting stats. */
    var changedPower = Number(c.atk) !== Number(c.baseAtk);
    var power = '';
    if (changedPower) {
      var direction = Number(c.atk) > Number(c.baseAtk) ? ' is-up' : ' is-down';
      power = '<span class="battle-power' + direction + '" aria-label="Power ' + c.atk + '">' + c.atk + '</span>';
    }
    return '<img class="card-art" src="' + esc(c.image) + '" alt="' + esc(c.name) + '">' + power + '<span class="battle-hp">HP ' + c.hp + '</span>';
  }
  function renderDeckSlots(list) {
    var slots = $('#deck-slots'); slots.innerHTML = '';
    for (var i = 0; i < 15; i++) {
      var c = list[i] || null, slot;
      if (c) {
        slot = document.createElement('button'); slot.type = 'button'; slot.className = 'deck-slot filled';
        slot.dataset.slot = i; slot.setAttribute('aria-label', tr('덱에서 ' + c.name + ' 제거', 'Remove ' + c.name + ' from deck'));
        slot.innerHTML = '<img src="' + esc(c.image) + '" alt=""><span class="deck-slot-number">' + (i + 1) + '</span>';
      } else {
        slot = document.createElement('span'); slot.className = 'deck-slot empty';
        slot.innerHTML = '<span>' + (i + 1) + '</span>';
      }
      slots.appendChild(slot);
    }
  }
  /* A legacy/local deck can contain IDs that are no longer in the current
     collection. Those invisible IDs used to consume all 15 slots and made a
     visually four-card deck report as full. Keep only available copies. */
  function sanitizeDeckSelection(ownedCards) {
    var byId = {}, used = {}, clean = [];
    (ownedCards || []).forEach(function (card) { byId[card.id] = card; });
    state.selected.forEach(function (id) {
      var card = byId[id];
      var limit = card ? Math.min(2, Math.max(1, Number(card.count) || 1)) : 0;
      if (card && (used[id] || 0) < limit && clean.length < 15) {
        used[id] = (used[id] || 0) + 1;
        clean.push(id);
      }
    });
    state.selected = clean;
  }
  function renderCollection() {
    var list = $('#card-list'), ownedCards = cards(), byId = {}; list.innerHTML = '';
    sanitizeDeckSelection(ownedCards);
    ownedCards.forEach(function (c) { byId[c.id] = c; });
    renderDeckSlots(state.selected.map(function (id) { return byId[id] || null; }));
    ownedCards.forEach(function (c) {
      var selectedCount = state.selected.filter(function (id) { return id === c.id; }).length;
      var maxCopies = Math.min(2, c.count);
      var el = document.createElement('button'); el.type = 'button'; el.className = 'collection-card' + (selectedCount ? ' selected' : '');
      el.innerHTML = collectionCardHtml(c) + '<span class="deck-copy-count">DECK ' + selectedCount + '/' + maxCopies + '</span>';
      el.onclick = function () {
        var count = state.selected.filter(function (id) { return id === c.id; }).length;
        if (count >= maxCopies) $('#deck-status').textContent = tr('이 카드는 더 장착할 수 없습니다.', 'No more copies of this card are available.');
        else if (state.selected.length >= 15) $('#deck-status').textContent = tr('덱 슬롯 15칸이 모두 찼습니다.', 'All 15 deck slots are full.');
        else { state.selected.push(c.id); $('#deck-status').textContent = ''; }
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
  function canPayMana(actor, card) {
    var mana = Number(actor && actor.mana), cost = Number(card && card.cost);
    return Number.isFinite(mana) && Number.isFinite(cost) && cost >= 0 && cost <= mana;
  }
  function spendMana(actor, card) {
    if (!canPayMana(actor, card)) return false;
    actor.mana -= Number(card.cost);
    if (actor.mana < 0) throw new Error('Mana invariant violated');
    return true;
  }
  async function startBattle() {
    if (state.game) return;
    sanitizeDeckSelection(cards());
    if (state.selected.length !== 15) { status(tr('먼저 내 카드에서 15장 덱을 완성하세요.', 'Complete your 15-card deck first.')); show('cards-view'); renderCollection(); return; }
    var start = $('#start-pve'); start.disabled = true; status(tr('전투를 준비하고 있습니다…', 'Preparing battle…'));
    if (window.XenaMobileImmersive) window.XenaMobileImmersive.enter();
    try { if (window.XenaWallet && window.XenaWallet.consumeEnergy) await window.XenaWallet.consumeEnergy('signal_warfare'); }
    catch (_) { status(tr('보석이 부족합니다. 충전을 기다려 주세요.', 'No gems available. Wait for recharge.')); start.disabled = false; if (window.XenaMobileImmersive) window.XenaMobileImmersive.exit(); return; }
    var conf = DIFFICULTY[state.difficulty], first = Math.random() < .5 ? 'player' : 'ai';
    state.game = { difficulty: state.difficulty, first: first, active: first, round: 1, player: player('player', deckForBattle(), 30), ai: player('ai', aiDeck(state.difficulty), conf.core, conf) };
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
    else {
      if (state.attacker !== null) el.classList.add('target-ready');
      el.onclick = function (e) { e.stopPropagation(); if (state.attacker !== null) attackUnit(slot); else toggleCardFocus('ai', slot); };
    }
    if (side === 'player' && state.attacker === slot) el.classList.add('attacker-selected');
    if (state.focused && state.focused.side === side && state.focused.slot === slot) el.classList.add('card-focused');
    return el;
  }
  function renderZone(node, list, side) {
    node.innerHTML = '';
    list.forEach(function (c, i) {
      var slot = document.createElement('div'); slot.className = 'slot';
      if (side === 'player' && state.handIndex !== null && !c) slot.classList.add('can-drop');
      if (c) slot.appendChild(unit(c, side, i));
      if (side === 'player' && state.handIndex !== null && !c) {
        var forecast = previewDeploy(i);
        if (forecast) {
          var preview = document.createElement('div'); preview.className = 'deploy-forecast';
          preview.innerHTML = '<span>ATK ' + signed(forecast.atk) + ' · HP ' + signed(forecast.hp) +
            (forecast.enemyAtk ? ' · ENEMY ATK ' + signed(forecast.enemyAtk) : '') + '</span>';
          slot.appendChild(preview);
        }
      }
      if (side === 'player') slot.onclick = function () { deploy(i); };
      node.appendChild(slot);
    });
  }

  function signed(value) { return (value >= 0 ? '+' : '') + value; }
  function cloneFighter(fighter) {
    return {
      field:fighter.field.map(function (c) { return c ? Object.assign({}, c) : null; }),
      nextBuff:fighter.nextBuff ? Object.assign({}, fighter.nextBuff) : null,
      nextDebuff:Number(fighter.nextDebuff) || 0
    };
  }
  function totals(fighter) {
    return fighter.field.filter(Boolean).reduce(function (sum, c) {
      sum.atk += Number(c.atk) || 0; sum.hp += Number(c.hp) || 0; return sum;
    }, { atk:0, hp:0 });
  }
  function previewDeploy(slot) {
    var g = state.game, source = g && g.player.hand[state.handIndex];
    if (!g || !source || g.player.field[slot]) return null;
    var owner = cloneFighter(g.player), enemy = cloneFighter(g.ai);
    var beforeOwner = totals(owner), beforeEnemy = totals(enemy);
    owner.field[slot] = Object.assign({}, source, { attacked:false });
    applyDeployEffect(owner, enemy, owner.field[slot]);
    var afterOwner = totals(owner), afterEnemy = totals(enemy);
    return {
      atk:afterOwner.atk - beforeOwner.atk,
      hp:afterOwner.hp - beforeOwner.hp,
      enemyAtk:afterEnemy.atk - beforeEnemy.atk,
      enemyHp:afterEnemy.hp - beforeEnemy.hp
    };
  }
  function renderBattle() {
    var g = state.game; if (!g) return;
    var p = g.player, ai = g.ai;
    $('#difficulty-label').textContent = g.difficulty.toUpperCase() + ' · ' + DIFFICULTY[g.difficulty].reward + ' XC';
    $('#phase-label').textContent = g.active === 'player' ? tr('내 턴', 'YOUR TURN') : tr('AI 턴', 'AI TURN');
    $('#turn-rule').textContent = g.round === 1 ? tr('첫 턴 공격 불가', 'FIRST TURN · NO ATTACK') : '';
    $('#affinity-rule').textContent = tr('상성 우위 공격 +1: SOUND > SOUL > DARK > LIGHT > METAL > BUG > ANOMALY > SOUND', 'Affinity advantage +1 ATK: SOUND > SOUL > DARK > LIGHT > METAL > BUG > ANOMALY > SOUND');
    $('#player-core').innerHTML = '<span>YOUR CORE · MANA ' + p.mana + '/' + p.maxMana + '</span><b>' + p.core + '</b>';
    $('#ai-core').innerHTML = '<span>AI CORE · MANA ' + ai.mana + '/' + ai.maxMana + '</span><b>' + ai.core + '</b>';
    $('#ai-core').onclick = function () { if (!ai.field.some(Boolean)) attackCore(); };
    $('#ai-core').classList.toggle('target-ready', state.attacker !== null && !ai.field.some(Boolean));
    renderZone($('#player-field'), p.field, 'player'); renderZone($('#ai-field'), ai.field, 'ai');
    var hand = $('#hand'); hand.innerHTML = '';
    p.hand.forEach(function (c, i) { var el = unit(c, 'hand', i); el.classList.toggle('selected', state.handIndex === i); el.onclick = function () { if (g.active === 'player') { state.handIndex = i; state.attacker = null; renderBattle(); } }; hand.appendChild(el); });
    $('#end-turn').disabled = g.active !== 'player';
  }
  /* PWR means attack power.  It must not silently increase HP as well; doing
     both doubled every printed buff and contradicted all 90 card texts. */
  function addPower(card, amount) { if (!card || !amount) return; card.atk = Math.max(0, card.atk + amount); }
  function drawEffectCards(owner, count) {
    if (!owner || !Array.isArray(owner.deck) || !Array.isArray(owner.hand)) return 0;
    var drawn = 0;
    while (drawn < count && owner.deck.length) { owner.hand.push(owner.deck.shift()); drawn++; }
    if (drawn && owner.id === 'player') play(SFX.draw);
    return drawn;
  }
  function showStatChange(side, slot, atkDelta, hpDelta) {
    if (!atkDelta && !hpDelta) return;
    var target = document.querySelector('.card-unit[data-side="' + side + '"][data-slot="' + slot + '"]');
    if (!target) return;
    var pop = document.createElement('span');
    pop.className = 'stat-up-pop' + (atkDelta < 0 || hpDelta < 0 ? ' is-down' : '');
    pop.textContent = (atkDelta ? 'ATK ' + signed(atkDelta) : '') + (atkDelta && hpDelta ? '  ' : '') + (hpDelta ? 'HP ' + signed(hpDelta) : '');
    target.appendChild(pop); setTimeout(function () { pop.remove(); }, 1000);
    playVfx(target, atkDelta < 0 || hpDelta < 0 ? 'debuff' : 'buff', { duration: 720, inset: '-34%' });
  }
  function applyDeployEffect(owner, enemy, card) {
    if (owner.nextDebuff) { addPower(card, -owner.nextDebuff); owner.nextDebuff = 0; }
    if (owner.nextBuff && (!owner.nextBuff.el || owner.nextBuff.el === card.element)) { addPower(card, owner.nextBuff.amt); owner.nextBuff = null; }
    var e = card.effect || {}, allies = owner.field.filter(Boolean), enemies = enemy.field.filter(Boolean), others = allies.filter(function (x) { return x !== card; });
    switch (e.kind) {
      case 'buff_self_flat': addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_element': if (others.some(function (x) { return x.element === e.el; })) addPower(card, Number(e.amt) || 0); break;
      case 'buff_self_if_person': if (others.some(function (x) { return x.person === e.person; })) addPower(card, Number(e.amt) || 0); break;
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
      case 'buff_others': if (others.length) addPower(others.slice().sort(function (a, b) { return a.atk - b.atk; })[0], Number(e.amt) || 0); break;
      case 'buff_lowest': if (allies.length) addPower(allies.slice().sort(function (a, b) { return a.atk - b.atk; })[0], Number(e.amt) || 0); break;
      case 'buff_element_count': addPower(card, new Set(allies.map(function (x) { return x.element; }).filter(Boolean)).size * (Number(e.amt) || 1)); break;
      case 'buff_next_only': owner.nextBuff = { amt:Number(e.amt) || 0, el:e.el || null }; break;
      /* PC-20: draw first, then arm a future-card buff. The card that creates
         this effect cannot be a target of its own next-card bonus. */
      case 'draw_and_buff_next':
        drawEffectCards(owner, Math.max(0, Number(e.draw) || 1));
        owner.nextBuff = { amt:Number(e.amt) || 0, el:e.el || null };
        break;
      case 'debuff_enemy_one':
        if (card.id === 'PC-21' && !enemies.length) enemy.nextDebuff = Number(e.amt) || 0;
        else if (enemies.length) addPower(enemies.slice().sort(function (a, b) { return b.atk - a.atk; })[0], -(Number(e.amt) || 0));
        break;
      case 'debuff_enemy_all':
        if (card.id === 'PC-41') enemy.nextDebuff = Number(e.amt) || 0;
        else enemies.forEach(function (x) { addPower(x, -(Number(e.amt) || 0)); });
        break;
    }
  }
  function deploy(slot) {
    var g = state.game, p = g && g.player, c = p && p.hand[state.handIndex];
    if (!g || g.active !== 'player' || !c || p.field[slot] || !canPayMana(p, c)) return;
    if (!spendMana(p, c)) return;
    p.field[slot] = Object.assign({}, c, { attacked: false }); p.hand.splice(state.handIndex, 1); state.handIndex = null;
    var beforeAtk = p.field[slot].atk, beforeHp = p.field[slot].hp;
    applyDeployEffect(p, g.ai, p.field[slot]); play(SFX.summon); renderBattle();
    playVfx(document.querySelector('.card-unit[data-side="player"][data-slot="' + slot + '"]'), 'summon', { duration: 760, inset: '-30%' });
    showStatChange('player', slot, p.field[slot].atk - beforeAtk, p.field[slot].hp - beforeHp);
  }
  function affinityTargetSlots(attacker) {
    var g = state.game; if (!g || !attacker) return [];
    return g.ai.field.map(function (target, slot) { return { target: target, slot: slot }; }).filter(function (entry) { return entry.target && AFFINITY[attacker.element] === entry.target.element; });
  }
  function showAffinityHints(attacker) {
    affinityTargetSlots(attacker).forEach(function (entry) {
      var target = document.querySelector('.card-unit[data-side="ai"][data-slot="' + entry.slot + '"]');
      if (!target) return;
      var hint = document.createElement('span'); hint.className = 'affinity-pop'; hint.textContent = '+1'; target.appendChild(hint);
      setTimeout(function () { hint.remove(); }, 900);
    });
  }
  function showDamageForecast(attacker) {
    var g = state.game;
    if (!g || !attacker) return;
    g.ai.field.forEach(function (target, slot) {
      if (!target) return;
      var node = document.querySelector('.card-unit[data-side="ai"][data-slot="' + slot + '"]');
      if (!node) return;
      var forecast = document.createElement('span');
      var amount = damage(attacker, target);
      forecast.className = 'damage-forecast' + (amount > attacker.atk ? ' affinity-damage' : '');
      forecast.textContent = tr('예상 -', 'DMG -') + amount;
      node.appendChild(forecast);
    });
    if (!g.ai.field.some(Boolean)) {
      var core = $('#ai-core'), coreForecast = document.createElement('span');
      coreForecast.className = 'damage-forecast core-forecast';
      coreForecast.textContent = tr('예상 -', 'DMG -') + attacker.atk;
      core.appendChild(coreForecast);
    }
  }
  function toggleCardFocus(side, slot) {
    var current = state.focused;
    state.focused = current && current.side === side && current.slot === slot ? null : { side:side, slot:slot };
    renderBattle();
  }
  function selectAttacker(slot) {
    var g = state.game, c = g && g.player.field[slot];
    if (!g || g.active !== 'player' || !c || c.attacked || g.round === 1) { toggleCardFocus('player', slot); return; }
    state.attacker = state.attacker === slot ? null : slot;
    state.focused = state.attacker === null ? null : { side:'player', slot:slot };
    state.handIndex = null; renderBattle();
    if (state.attacker !== null) { showAffinityHints(c); showDamageForecast(c); }
  }
  function damage(attacker, target) { return attacker.atk + (target && AFFINITY[attacker.element] === target.element ? 1 : 0); }
  async function attackUnit(slot) {
    var g = state.game, a = g && g.player.field[state.attacker], target = g && g.ai.field[slot];
    if (!a || !target) return;
    var source = state.attacker, amount = damage(a, target); state.attacker = null; a.attacked = true;
    await hit('player', source, 'ai', slot, amount, amount > a.atk);
    target.hp -= amount;
    if (target.hp <= 0) {
      play(SFX.shatter);
      playVfx(document.querySelector('.card-unit[data-side="ai"][data-slot="' + slot + '"]'), 'shatter', { duration: 720, inset: '-38%' });
      await wait(520);
      g.ai.field[slot] = null;
    }
    renderBattle();
  }
  async function attackCore() {
    var g = state.game, a = g && g.player.field[state.attacker]; if (!a || g.ai.field.some(Boolean)) return;
    var source = state.attacker; a.attacked = true; state.attacker = null;
    await hit('player', source, 'core', 'ai-core', a.atk, false); g.ai.core = Math.max(0, g.ai.core - a.atk); if (g.ai.core <= 0) finish(true); else renderBattle();
  }
  function hit(side, sourceSlot, targetSide, targetSlot, amount, affinity) {
    play(SFX.hit); var root = $('#xena-tcg-container'); root.classList.add('camera-shake');
    var source = document.querySelector('.card-unit[data-side="' + side + '"][data-slot="' + sourceSlot + '"]');
    var target = targetSide === 'core' ? $('#' + targetSlot) : document.querySelector('.card-unit[data-side="' + targetSide + '"][data-slot="' + targetSlot + '"]');
    if (source) { source.style.setProperty('--attack-x', side === 'player' ? '28px' : '-28px'); source.classList.add('dash-attack'); }
    if (target) {
      target.classList.add('impact-hit');
      playVfx(target, targetSide === 'core' ? 'core' : (affinity ? 'affinity' : 'impact'), { duration: targetSide === 'core' ? 980 : 620, inset: targetSide === 'core' ? '-45%' : '-32%' });
      var pop = document.createElement('span'); pop.className = 'damage-pop' + (targetSide === 'core' ? ' core-damage' : '') + (affinity ? ' affinity-damage' : ''); pop.textContent = (affinity ? '+1  ' : '') + '-' + amount;
      target.appendChild(pop); setTimeout(function () { pop.remove(); }, 700);
    }
    return new Promise(function (resolve) { setTimeout(function () { root.classList.remove('camera-shake'); if (source) source.classList.remove('dash-attack'); if (target) target.classList.remove('impact-hit'); resolve(); }, 420); });
  }
  function endTurn() { var g = state.game; if (!g || g.active !== 'player') return; state.handIndex = null; state.attacker = null; g.active = 'ai'; startTurn(g.ai); renderBattle(); aiTurn(); }
  async function aiTurn() {
    var g = state.game; if (!g || g.active !== 'ai') return;
    await wait(720);
    var ai = g.ai, deployGuard = 0;
    while (deployGuard++ < 7) {
      var empty = ai.field.findIndex(function (c) { return !c; });
      if (empty < 0) break;
      var playable = ai.hand.map(function (c, i) {
        if (!canPayMana(ai, c)) return null;
        var owner = cloneFighter(ai), enemy = cloneFighter(g.player), before = totals(owner), enemyBefore = totals(enemy);
        owner.field[empty] = Object.assign({}, c, { attacked:false }); applyDeployEffect(owner, enemy, owner.field[empty]);
        var after = totals(owner), enemyAfter = totals(enemy);
        var tactical = (after.atk-before.atk)*1.4 + (after.hp-before.hp)*.38 - (enemyAfter.atk-enemyBefore.atk)*1.2 - c.cost*.18;
        return { c:c, i:i, score:tactical };
      }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
      if (!playable.length) break;
      var picked = playable[0], c = ai.hand[picked.i];
      /* Final invariant at the mutation boundary: difficulty configuration,
         scoring and future bonuses can never turn an unaffordable card into a
         legal placement. */
      if (!canPayMana(ai, c) || !spendMana(ai, c)) break;
      ai.hand.splice(picked.i, 1); ai.field[empty] = Object.assign({}, c, { attacked: false });
      var beforeAtk = ai.field[empty].atk, beforeHp = ai.field[empty].hp;
      applyDeployEffect(ai, g.player, ai.field[empty]); play(SFX.summon); renderBattle();
      playVfx(document.querySelector('.card-unit[data-side="ai"][data-slot="' + empty + '"]'), 'summon', { duration: 760, inset: '-30%' });
      showStatChange('ai', empty, ai.field[empty].atk - beforeAtk, ai.field[empty].hp - beforeHp); await wait(520);
    }
    if (g.round > 1) {
      for (var i = 0; i < ai.field.length; i++) {
        var a = ai.field[i]; if (!a || a.attacked) continue; a.attacked = true;
        var targets = g.player.field.map(function (x, n) { return { x: x, n: n }; }).filter(function (v) { return v.x; }).sort(function (x, y) {
          function targetScore(v) { var dealt = damage(a, v.x); return (dealt >= v.x.hp ? 100 : 0) + (dealt > a.atk ? 18 : 0) + v.x.atk*.8 - v.x.hp*.12; }
          return targetScore(y) - targetScore(x);
        });
        if (targets.length) {
          var t = targets[0], amount = damage(a, t.x); await hit('ai', i, 'player', t.n, amount, amount > a.atk);
          t.x.hp -= amount;
          if (t.x.hp <= 0) {
            play(SFX.shatter);
            playVfx(document.querySelector('.card-unit[data-side="player"][data-slot="' + t.n + '"]'), 'shatter', { duration: 720, inset: '-38%' });
            await wait(520);
            g.player.field[t.n] = null;
          }
        } else { await hit('ai', i, 'core', 'player-core', a.atk, false); g.player.core = Math.max(0, g.player.core - a.atk); }
        if (g.player.core <= 0) { finish(false); return; }
        renderBattle(); await wait(440);
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
    if (window.XenaRecords && window.XenaRecords.record) window.XenaRecords.record('signal_warfare', g.difficulty, won ? 'win' : 'loss');
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
    state.language = lang === 'en' ? 'en' : 'ko'; document.documentElement.lang = state.language; document.documentElement.dataset.lang = state.language;
    try { localStorage.setItem('xena-language', state.language); localStorage.setItem('xena-lang', state.language); } catch (_) {}
    if (window.XenaCards && window.XenaCards.refresh) window.XenaCards.refresh();
    document.querySelectorAll('[data-language]').forEach(function (b) { b.classList.toggle('active', b.dataset.language === state.language); });
    if (!$('#cards-view').hidden) renderCollection();
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
    sanitizeDeckSelection(cards());
    document.querySelectorAll('[data-difficulty]').forEach(function (b) { b.onclick = function () { state.difficulty = b.dataset.difficulty; document.querySelectorAll('[data-difficulty]').forEach(function (x) { x.classList.toggle('selected', x === b); }); }; });
    $('#my-cards-button').onclick = function () { show('cards-view'); renderCollection(); };
    $('#deck-slots').onclick = function (event) {
      var slot = event.target.closest('button.deck-slot[data-slot]');
      if (!slot) return;
      var index = Number(slot.dataset.slot);
      if (!Number.isInteger(index) || index < 0 || index >= state.selected.length) return;
      state.selected.splice(index, 1); $('#deck-status').textContent = ''; renderCollection();
    };
    $('#cards-back').onclick = function () { show('lobby'); };
    $('#save-deck').onclick = function () { if (state.selected.length !== 15) return; localStorage.setItem('xena-signal-warfare-deck', JSON.stringify(state.selected)); $('#deck-status').textContent = tr('덱이 저장되었습니다.', 'Deck saved.'); show('lobby'); };
    $('#start-pve').onclick = startBattle; $('#end-turn').onclick = endTurn;
    $('#battle-exit').onclick = function () { state.game = null; show('lobby'); $('#start-pve').disabled = false; };
    $('#refresh-balance').onclick = wireWallet; $('#mute-local').onclick = function () { if (window.XenaAudio && window.XenaAudio.toggleMute) window.XenaAudio.toggleMute(); };
    document.querySelectorAll('[data-language]').forEach(function (b) { b.onclick = function () { setLanguage(b.dataset.language); }; });
    $('#record-button').onclick = showRecords; $('#record-close').onclick = function () { $('#record-modal').hidden = true; };
    setLanguage(localStorage.getItem('xena-language') || document.documentElement.lang || 'ko'); wireWallet();
    if (window.XenaBattleView) state.battleView = window.XenaBattleView.attach({
      viewport:'#warfare-battle-viewport', stage:'#warfare-battle-stage', target:'#battlefield', min:.42, max:1.3,
      initial:window.matchMedia('(max-width: 899px)').matches ? .82 : 1
    });
  }
  document.addEventListener('DOMContentLoaded', init);
}());
