const ASSETS = {
  lobbyArt: ['assets/images/XENA_SignalWarfare_Cover_v1.webp', 'assets/images/BG_Track01_Chase.webp', 'assets/images/BG_Track02_Purity.webp', 'assets/images/BG_Track04_Sovereign.webp'],
  battleArt: ['assets/images/XENA_Battlefield_TheNode_TopView_01.webp', 'assets/images/XENA_Battlefield_TheNode_TopView_02.webp'],
  lobbyBgm: ['assets/audio/bgm_main_theme_01.mp3', 'assets/audio/bgm_main_theme_02.mp3'],
  battleBgm: ['assets/audio/bgm_battle_01.mp3', 'assets/audio/bgm_battle_02.mp3'],
  victorySfx: ['assets/audio/bgm_victory_01.mp3', 'assets/audio/bgm_victory_02.mp3'],
  drawSfx: 'assets/audio/sfx_card_draw.mp3',
  summonSfx: 'assets/audio/sfx_card_summon.mp3',
  attackSfx: 'assets/audio/sfx_attack_impact.mp3',
  shatterSfx: 'assets/audio/sfx_card_shatter.mp3',
};
const pickAsset = (assets) => Array.isArray(assets) ? assets[Math.floor(Math.random() * assets.length)] : assets;
const DIFFICULTIES = {
  easy: { label: 'EASY', core: 20, reward: 20, pool: (card) => ['N', 'R'].includes(card.grade) },
  normal: { label: 'NORMAL', core: 30, reward: 50, pool: () => true },
  hard: { label: 'HARD', core: 40, reward: 100, pool: (card) => ['SR', 'SSR', 'BOSS'].includes(card.grade) },
};

const client = {
  userId: new URLSearchParams(location.search).get('userId') || 'demo-user',
  selectedDifficulty: 'normal', selectedCardIds: new Set(), deck: [], balance: null, game: null, selectedHand: null, selectedAttacker: null, effectLock: false, drawAnimationPending: false, summonSlot: null,

  init() {
    this.selectedCardIds = new Set(JSON.parse(localStorage.getItem('xena-deck') || '[]'));
    document.querySelector('#start-pve').addEventListener('click', () => this.startBattle());
    document.querySelector('#my-cards-button').addEventListener('click', () => this.showCards());
    document.querySelector('#cards-back').addEventListener('click', () => this.show('lobby'));
    document.querySelector('#save-deck').addEventListener('click', () => this.saveDeck());
    document.querySelector('#refresh-balance').addEventListener('click', () => this.wireWallet());
    document.querySelector('#end-turn').addEventListener('click', () => this.endTurn());
    document.querySelector('#battle-exit').addEventListener('click', () => this.show('lobby'));
    document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
      this.selectedDifficulty = button.dataset.difficulty;
      document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
    }));
    this.wireWallet();
    this.applyAsset('lobby');
  },

  wireWallet() {
    const paint = (value) => { this.balance = value; document.querySelector('#xc-display').textContent = value == null ? 'SIGN IN REQUIRED' : `${value} XC`; };
    if (!window.XenaWallet) { paint(null); return; }
    paint(window.XenaWallet.getBalance());
    if (!this.walletUnsubscribe) this.walletUnsubscribe = window.XenaWallet.subscribe(paint);
  },

  normalizeCard(card) {
    const stats = (window.XenaCards && XenaCards.GRADE_STATS && XenaCards.GRADE_STATS[card.grade]) || { cost: card.cost || 1, power: card.power || 1 };
    const atk = Number(card.atk ?? card.power ?? stats.power ?? 1);
    return { ...card, cost: Number(card.cost ?? stats.cost), atk, hp: Number(card.hp ?? (atk + 3)), count: Number(card.count || 1) };
  },
  getOwnedCards() { return window.XenaCards ? XenaCards.owned().map((card) => this.normalizeCard(card)) : []; },
  getCardCatalog() { return window.XenaCards ? (XenaCards.available ? XenaCards.available() : XenaCards.all()).map((card) => this.normalizeCard(card)) : []; },

  show(screen) {
    ['lobby', 'cards-view', 'battle-view'].forEach((id) => { document.querySelector(`#${id}`).hidden = id !== (screen === 'lobby' ? 'lobby' : `${screen}-view`); });
    this.applyAsset(screen);
  },
  applyAsset(screen) {
    const app = document.querySelector('#app');
    app.classList.toggle('battle-art', screen === 'battle');
    app.classList.toggle('lobby-art', screen !== 'battle');
    const art = pickAsset(screen === 'battle' ? ASSETS.battleArt : ASSETS.lobbyArt);
    app.style.backgroundImage = `linear-gradient(145deg, rgba(5,5,8,.72), rgba(7,15,35,.9)), url("${art}")`;
    document.querySelector('#bgm').src = pickAsset(screen === 'battle' ? ASSETS.battleBgm : ASSETS.lobbyBgm);
    document.querySelector('#bgm-status').textContent = screen === 'battle' ? 'BGM: BATTLE' : '';
    document.querySelector('#bgm').play().catch(() => {});
  },

  showCards() {
    this.show('cards');
    const list = document.querySelector('#card-list');
    list.replaceChildren(...this.getOwnedCards().map((card) => {
      const item = document.createElement('button'); item.className = `collection-card ${this.selectedCardIds.has(card.id) ? 'selected' : ''}`;
      item.innerHTML = `<small>${card.grade} · ${card.element}</small><strong>${card.name}</strong><span>COST ${card.cost} · ATK ${card.atk} / HP ${card.hp}</span>`;
      item.addEventListener('click', () => this.toggleCard(card.id, item)); return item;
    }));
    this.updateDeckCount();
  },
  toggleCard(id, element) {
    if (this.selectedCardIds.has(id)) this.selectedCardIds.delete(id);
    else if (this.selectedCardIds.size < 15) this.selectedCardIds.add(id);
    else return;
    element.classList.toggle('selected', this.selectedCardIds.has(id)); this.updateDeckCount();
  },
  updateDeckCount() { document.querySelector('#deck-count').textContent = this.selectedCardIds.size; },
  saveDeck() {
    if (this.selectedCardIds.size !== 15) return (document.querySelector('#deck-status').textContent = '정확히 15장을 선택해야 합니다.');
    localStorage.setItem('xena-deck', JSON.stringify([...this.selectedCardIds]));
    document.querySelector('#deck-status').textContent = '덱을 저장했습니다.';
  },

  startBattle() {
    if (window.XenaWallet && window.XenaWallet.consumeEnergy && !this._energyGranted) {
      window.XenaWallet.consumeEnergy('signal_clash').then(() => { this._energyGranted = true; this.startBattle(); this._energyGranted = false; }).catch(() => { document.querySelector('#lobby-status').textContent = 'No energy. Recharges every 10 minutes.'; });
      return;
    }
    if (this.selectedCardIds.size !== 15) { document.querySelector('#lobby-status').textContent = '먼저 MY CARDS에서 15장 덱을 저장하세요.'; return; }
    const config = DIFFICULTIES[this.selectedDifficulty];
    const owned = this.getOwnedCards();
    const catalog = this.getCardCatalog();
    const selected = owned.filter((card) => this.selectedCardIds.has(card.id));
    const aiPool = catalog.filter(config.pool);
    this.deck = [...selected];
    this.game = { matchId: `PVE_${Date.now()}`, difficulty: this.selectedDifficulty, phase: 'ACTION', active: 'player', selectedHand: null,
      player: this.makePlayer('player', selected, 30), ai: this.makePlayer('ai', aiPool, config.core) };
    this.selectedAttacker = null;
    this.startTurn(this.game.player);
    this.show('battle'); this.renderBattle();
  },
  makePlayer(id, deck, core) {
    const cards = [...deck]; for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return { id, core, memory: 0, maxMemory: 0, hand: cards.splice(0, 5), deck: cards, field: Array(7).fill(null) };
  },
  startTurn(player) {
    player.maxMemory = Math.min(10, player.maxMemory + 1);
    player.memory = player.maxMemory;
    player.field.forEach((unit) => { if (unit) unit.hasAttacked = false; });
    if (player.deck.length) { player.hand.push(player.deck.shift()); if (player.id === 'player') { this.drawAnimationPending = true; this.playSfx(ASSETS.drawSfx); } }
    this.game.phase = 'ACTION';
  },
  endTurn() {
    if (!this.game || this.game.active !== 'player') return;
    this.game.phase = 'CLEANUP';
    this.game.active = 'ai';
    this.aiTurn();
  },
  aiTurn() {
    const game = this.game; const ai = game.ai;
    this.startTurn(ai);
    while (ai.hand.length && ai.field.some((slot) => !slot)) { const idx = ai.hand.findIndex((card) => card.cost <= ai.memory); if (idx < 0) break; const slot = ai.field.findIndex((item) => !item); const card = ai.hand.splice(idx, 1)[0]; ai.memory -= card.cost; ai.field[slot] = { ...card, hasAttacked: true }; }
    ai.field.forEach((attacker) => {
      if (!attacker) return;
      const targetSlot = game.player.field.findIndex(Boolean);
      if (targetSlot >= 0) {
        const target = game.player.field[targetSlot]; target.hp -= attacker.atk;
        if (target.hp <= 0) game.player.field[targetSlot] = null;
      } else game.player.core = Math.max(0, game.player.core - attacker.atk);
    });
    if (game.player.core <= 0) return this.finishBattle(false);
    game.active = 'player'; this.startTurn(game.player); this.renderBattle();
  },
  deploy(slot) {
    const game = this.game; if (!game || this.effectLock || game.active !== 'player' || game.phase !== 'ACTION' || this.selectedHand === null) return;
    const player = game.player; const card = player.hand[this.selectedHand]; if (!card || player.field[slot] || player.memory < card.cost) return;
    player.memory -= card.cost; player.field[slot] = { ...card, hasAttacked: false }; player.hand.splice(this.selectedHand, 1); this.selectedHand = null; this.summonSlot = slot; this.playSfx(ASSETS.summonSfx); this.renderBattle(); this.triggerRipple(slot);
  },
  selectAttacker(slot) {
    const game = this.game; const attacker = game?.player.field[slot];
    if (!attacker || game.active !== 'player' || game.phase !== 'ACTION' || attacker.hasAttacked) return;
    this.selectedAttacker = this.selectedAttacker === slot ? null : slot;
    this.renderBattle();
  },
  attackUnit(targetSlot) {
    const game = this.game; const attacker = game?.player.field[this.selectedAttacker]; const target = game?.ai.field[targetSlot];
    if (!attacker || !target || this.effectLock || game.active !== 'player' || game.phase !== 'ACTION' || attacker.hasAttacked) return;
    const attackerSlot = this.selectedAttacker;
    attacker.hasAttacked = true;
    this.selectedAttacker = null;
    this.runAttackAnimation(attackerSlot, targetSlot, false, () => {
      target.hp -= attacker.atk;
      this.showDamage(targetSlot, attacker.atk, false);
      if (target.hp <= 0) this.destroyUnit(targetSlot, false);
      else { this.effectLock = false; this.renderBattle(); }
    });
  },
  attackCore() {
    const game = this.game; const attacker = game?.player.field[this.selectedAttacker];
    if (!attacker || this.effectLock || game.active !== 'player' || game.phase !== 'ACTION' || attacker.hasAttacked || game.ai.field.some(Boolean)) return;
    const attackerSlot = this.selectedAttacker; attacker.hasAttacked = true; this.selectedAttacker = null;
    this.runAttackAnimation(attackerSlot, null, true, () => {
      game.ai.core = Math.max(0, game.ai.core - attacker.atk); this.showDamage('ai-core', attacker.atk, true);
      if (game.ai.core <= 0) this.finishBattle(true); else { this.effectLock = false; this.renderBattle(); }
    });
  },
  runAttackAnimation(attackerSlot, targetSlot, coreTarget, onHit) {
    this.effectLock = true;
    const attackerEl = document.querySelector(`[data-field="player"][data-slot="${attackerSlot}"]`);
    const targetEl = coreTarget ? document.querySelector('#ai-core') : document.querySelector(`[data-field="ai"][data-slot="${targetSlot}"]`);
    if (!attackerEl || !targetEl) { this.effectLock = false; onHit(); return; }
    const distance = targetEl.getBoundingClientRect().left - attackerEl.getBoundingClientRect().left;
    attackerEl.style.setProperty('--attack-x', `${distance}px`); attackerEl.classList.add('dash-attack');
    setTimeout(() => { this.playSfx(ASSETS.attackSfx); this.shakeCamera(); onHit(); }, 330);
  },
  destroyUnit(slot, isPlayerUnit) {
    const selector = isPlayerUnit ? `[data-field="player"][data-slot="${slot}"]` : `[data-field="ai"][data-slot="${slot}"]`;
    const element = document.querySelector(selector); if (element) { element.classList.add('death-shatter'); this.playSfx(ASSETS.shatterSfx); }
    setTimeout(() => { if (isPlayerUnit) this.game.player.field[slot] = null; else this.game.ai.field[slot] = null; this.effectLock = false; this.renderBattle(); }, 480);
  },
  showDamage(target, amount, coreTarget) {
    const element = coreTarget ? document.querySelector(`#${target}`) : document.querySelector(`[data-field="ai"][data-slot="${target}"]`);
    const container = document.querySelector('#xena-tcg-container'); if (!element || !container) return;
    const rect = element.getBoundingClientRect(); const base = container.getBoundingClientRect(); const pop = document.createElement('span');
    pop.className = 'damage-pop'; pop.textContent = `-${amount}`; pop.style.left = `${rect.left - base.left + rect.width / 2}px`; pop.style.top = `${rect.top - base.top + rect.height * .28}px`; container.append(pop); setTimeout(() => pop.remove(), 700);
  },
  shakeCamera() { const container = document.querySelector('#xena-tcg-container'); container.classList.remove('camera-shake'); void container.offsetWidth; container.classList.add('camera-shake'); setTimeout(() => container.classList.remove('camera-shake'), 360); },
  triggerRipple(slot) { const element = document.querySelector(`[data-field="player"][data-slot="${slot}"]`)?.parentElement; if (!element) return; const ripple = document.createElement('span'); ripple.className = 'ripple-ring'; element.append(ripple); setTimeout(() => ripple.remove(), 650); },
  renderBattle() {
    const game = this.game; if (!game) return; const p = game.player; const ai = game.ai;
    document.querySelector('#difficulty-label').textContent = `AI: ${DIFFICULTIES[game.difficulty].label}`; document.querySelector('#phase-label').textContent = game.active === 'player' ? 'YOUR TURN · ACTIONS FREE' : 'AI TURN';
    document.querySelector('#player-core').textContent = `YOUR CORE: ${p.core} | MANA ${p.memory}/${p.maxMemory}`; document.querySelector('#ai-core').textContent = `AI CORE: ${ai.core}`; document.querySelector('#end-turn').disabled = game.active !== 'player';
    const aiCore = document.querySelector('#ai-core'); aiCore.classList.toggle('target-ready', this.selectedAttacker !== null && !ai.field.some(Boolean)); aiCore.onclick = () => this.attackCore();
    this.renderZone('#player-field', p.field, true); this.renderZone('#ai-field', ai.field, false);
    const hand = document.querySelector('#hand'); hand.replaceChildren(...p.hand.map((card, i) => { const el = this.cardElement(card); el.classList.toggle('selected', this.selectedHand === i); if (this.drawAnimationPending && i === p.hand.length - 1) el.classList.add('draw-in'); el.addEventListener('click', () => { this.selectedHand = i; this.renderBattle(); }); return el; })); this.drawAnimationPending = false;
  },
  renderZone(selector, field, own) { const zone = document.querySelector(selector); zone.replaceChildren(...field.map((card, i) => { const slot = document.createElement('div'); slot.className = 'slot'; if (own && this.selectedHand !== null && !card) slot.classList.add('can-drop'); if (card) { const el = this.cardElement(card); el.dataset.field = own ? 'player' : 'ai'; el.dataset.slot = i; if (own && this.summonSlot === i) el.classList.add('summon-in'); if (own && !card.hasAttacked) { el.classList.toggle('attacker-selected', this.selectedAttacker === i); el.addEventListener('click', (event) => { event.stopPropagation(); this.selectAttacker(i); }); } if (!own && this.selectedAttacker !== null) { el.classList.add('target-ready'); el.addEventListener('click', (event) => { event.stopPropagation(); this.attackUnit(i); }); } slot.append(el); } if (own) slot.addEventListener('click', () => this.deploy(i)); return slot; })); this.summonSlot = null; },
  cardElement(card) { const el = document.createElement('article'); el.className = 'card-unit'; el.innerHTML = `<small>${card.grade} · ${card.element}</small><strong>${card.name}</strong><span>COST ${card.cost}</span><footer>${card.atk} ATK / ${card.hp} HP</footer>`; return el; },
  /* Firebase Functions is the only authoritative match reward ledger. */
  async finishBattle(won) {
    if (!this.game) return;
    const match = this.game;
    if (won) this.playSfx(ASSETS.victorySfx);
    let rewardText = won ? 'Reward pending' : 'Loss recorded';
    try {
      if (!window.XenaWallet || !window.XenaWallet.claimTcgMatch) throw new Error('Wallet is not ready.');
      const result = await window.XenaWallet.claimTcgMatch(match.difficulty, won ? 'win' : 'loss');
      rewardText = `${result.granted || 0} XC credited`;
    } catch (error) {
      rewardText = `Reward sync failed: ${error.message}`;
    }
    const board = document.querySelector('#battle-view');
    const result = document.createElement('section');
    result.className = 'match-result-overlay';
    result.innerHTML = `<div class="match-result-card"><h2>${won ? 'VICTORY' : 'DEFEAT'}</h2><p>${rewardText}</p><button type="button">RETURN TO LOBBY</button></div>`;
    Object.assign(result.style, { position:'absolute', inset:'0', zIndex:'50', display:'grid', placeItems:'center', background:'rgba(5,5,12,.35)', backdropFilter:'blur(2px)' });
    const card = result.firstElementChild;
    Object.assign(card.style, { textAlign:'center', padding:'28px 36px', border:'1px solid rgba(63,224,255,.8)', borderRadius:'18px', background:'rgba(7,10,24,.92)', boxShadow:'0 0 44px rgba(63,224,255,.3)' });
    result.querySelector('button').onclick = () => { result.remove(); this.game = null; this.show('lobby'); this.wireWallet(); };
    board.append(result);
  },
  playSfx(src) { const audio = new Audio(pickAsset(src)); audio.volume = .78; audio.play().catch(() => {}); },
};
client.init();
