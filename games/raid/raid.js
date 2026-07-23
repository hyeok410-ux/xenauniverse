(function () {
  "use strict";

  const copy = {
    ko: {
      intro: "XENA의 무대를 삼키려는 음향 사고 위기. 6턴 안에 지원 카드를 배치하고 누적 파워로 코어를 무너뜨리세요.",
      bossHp: "보스 HP", turns: "전투 턴", starterCards: "스타터 카드", start: "레이드 시작",
      raidLabel: "RAID TURN", mana: "마나", power: "필드 파워", bossThreat: "SYSTEM THREAT", bossName: "음향 사고 위기", bossDescription: "폭주한 피드백 루프가 XENA의 라이브 신호를 끊으려 합니다.", hp: "HP", fieldLabel: "LIVE SUPPORT LINE", fieldTitle: "라이브 지원 라인", fieldHint: "손패 카드를 선택한 뒤 빈 칸을 누르세요.", handLabel: "YOUR SIGNALS", handTitle: "손패", handHint: "비용만큼 마나를 사용합니다.", endTurn: "턴 종료", selectCard: "카드를 선택했습니다. 필드의 빈 칸을 누르세요.", placed: "카드를 배치했습니다.", manaShort: "마나가 부족합니다.", fieldFull: "필드가 가득 찼습니다.", empty: "EMPTY SIGNAL", score: "최종 점수", rewardNote: "무료 체험판: 현재 XC 보상은 준비 중입니다.", retry: "다시 플레이", backGames: "XENA GAMES로", share: "결과 공유", winKicker: "SIGNAL RESTORED", winTitle: "무대가 살아났습니다", winCopy: "피드백 코어가 무너졌습니다. XENA의 라이브가 계속됩니다.", loseKicker: "SIGNAL LOST", loseTitle: "무대가 끊겼습니다", loseCopy: "6턴 안에 위기를 끝내지 못했습니다. 다음에는 카드를 더 빠르게 연결해 보세요.", turnDamage: "턴 피해", ready: "카드를 배치하거나 턴을 종료하세요.", shareText: "CRISIS: OVERRIDE에서 음향 사고 위기를 돌파했습니다!"
    },
    en: {
      intro: "A feedback catastrophe is swallowing XENA's stage. Place support cards and collapse its core with cumulative Power within six turns.",
      bossHp: "BOSS HP", turns: "BATTLE TURNS", starterCards: "STARTER CARDS", start: "START RAID",
      raidLabel: "RAID TURN", mana: "MANA", power: "FIELD POWER", bossThreat: "SYSTEM THREAT", bossName: "Feedback Catastrophe", bossDescription: "A runaway feedback loop is cutting through XENA's live signal.", hp: "HP", fieldLabel: "LIVE SUPPORT LINE", fieldTitle: "Live Support Line", fieldHint: "Select a card, then tap an empty slot.", handLabel: "YOUR SIGNALS", handTitle: "Hand", handHint: "Spend Mana equal to the card Cost.", endTurn: "END TURN", selectCard: "Card selected. Tap an empty field slot.", placed: "Card placed.", manaShort: "Not enough Mana.", fieldFull: "The field is full.", empty: "EMPTY SIGNAL", score: "FINAL SCORE", rewardNote: "Free pilot: XC rewards are not active yet.", retry: "PLAY AGAIN", backGames: "BACK TO XENA GAMES", share: "SHARE RESULT", winKicker: "SIGNAL RESTORED", winTitle: "The Stage Survives", winCopy: "The feedback core collapsed. XENA's live signal continues.", loseKicker: "SIGNAL LOST", loseTitle: "The Stage Went Dark", loseCopy: "The crisis survived six turns. Connect your cards earlier next time.", turnDamage: "Turn damage", ready: "Place a card or end the turn.", shareText: "I broke the Feedback Catastrophe in CRISIS: OVERRIDE!"
    }
  };

  const starterCards = [
    { id: "raid-nix", sourceId: "NX-N-02", name: "NIX-09 · First Signal", cost: 1, power: 1, art: "../gacha/cards/NX-N-02.jpg", note: "Signal starter" },
    { id: "raid-echo", sourceId: "EC-N-01", name: "ECHO · Frequency Line", cost: 2, power: 2, art: "../gacha/cards/EC-N-01.jpg", note: "Memory support" },
    { id: "raid-xena", sourceId: "XA-SSR-01", name: "XENA · Stay Bright", cost: 3, power: 4, art: "../gacha/cards/XA-SSR-01.jpg", note: "Live finisher" }
  ];

  const state = { language: localStorage.getItem("xena-lang") === "en" ? "en" : "ko", turn: 1, maxTurns: 6, mana: 1, maxMana: 1, bossHp: 30, maxBossHp: 30, field: [], hand: starterCards.map((card) => ({ ...card })), phase: "intro", lastDamage: 0, overkill: 0, actions: [] };
  const $ = (selector) => document.querySelector(selector);
  const text = (key) => copy[state.language][key] || copy.ko[key] || key;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function setLanguage() {
    document.documentElement.lang = state.language;
    document.title = state.language === "en" ? "CRISIS: OVERRIDE | XENA Games" : "CRISIS: OVERRIDE | XENA 게임즈";
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = text(node.dataset.i18n); });
    $(".reward-note").textContent = state.language === "en" ? "First clear each New York day: +10 XC (server verified)." : "뉴욕 날짜 기준 하루 첫 클리어: +10 XC (서버 검증).";
    $("#language").textContent = state.language === "ko" ? "EN" : "KO";
    render();
  }

  function fieldPower() { return state.field.reduce((total, card) => total + card.power, 0); }

  function showStatus(message, alert = false) {
    const node = $("#status-message");
    node.textContent = message;
    node.classList.toggle("alert", alert);
  }

  function cardMarkup(card, mode, index) {
    const disabled = mode === "hand" && (state.phase !== "playing" || card.cost > state.mana);
    const selected = mode === "hand" && state.selectedId === card.id;
    return `<button class="card ${selected ? "selected" : ""}" type="button" data-card-id="${escapeHtml(card.id)}" ${disabled ? "disabled" : ""} aria-label="${escapeHtml(card.name)} Cost ${card.cost} Power ${card.power}">
      <span class="card-art" style="background-image:linear-gradient(180deg,transparent 40%,rgba(4,7,13,.9)),url('${card.art}')"></span>
      <span class="card-copy"><b class="card-name">${escapeHtml(card.name)}</b><span class="card-stats"><span>COST ${card.cost}</span><span>POWER ${card.power}</span></span><small class="card-note">${escapeHtml(card.note)}</small></span>
    </button>`;
  }

  function renderField() {
    const grid = $("#field-grid");
    grid.innerHTML = Array.from({ length: 5 }, (_, index) => {
      const card = state.field[index];
      const target = state.selectedId && !card ? " selected-target" : "";
      return `<div class="field-slot${target}" data-slot="${index}" role="button" tabindex="0" aria-label="${card ? "Occupied field slot" : "Empty field slot"}">${card ? cardMarkup(card, "field", index) : `<span class="empty-slot">${text("empty")}</span>`}</div>`;
    }).join("");
  }

  function renderHand() {
    $("#hand-grid").innerHTML = state.hand.length ? state.hand.map((card, index) => cardMarkup(card, "hand", index)).join("") : `<p class="status-message">${text("ready")}</p>`;
  }

  function render() {
    $("#intro-panel").hidden = state.phase !== "intro";
    $("#battle-panel").hidden = !["playing"].includes(state.phase);
    $("#result-panel").hidden = !["win", "lose"].includes(state.phase);
    if (state.phase === "intro") return;
    const ratio = Math.max(0, state.bossHp / state.maxBossHp) * 100;
    $("#turn-label").textContent = `${state.turn} / ${state.maxTurns}`;
    $("#mana-label").textContent = `${state.mana} / ${state.maxMana}`;
    $("#power-label").textContent = String(fieldPower());
    $("#boss-hp").textContent = `${state.bossHp} / ${state.maxBossHp}`;
    $("#boss-hp-bar").style.width = `${ratio}%`;
    $("#end-turn").disabled = state.phase !== "playing";
    renderField();
    renderHand();
  }

  function startRaid() {
    state.phase = "playing";
    state.turn = 1;
    state.maxTurns = 6;
    state.mana = 1;
    state.maxMana = 1;
    state.bossHp = 30;
    state.field = [];
    state.hand = starterCards.map((card) => ({ ...card }));
    state.selectedId = "";
    state.lastDamage = 0;
    state.overkill = 0;
    state.actions = [];
    $("#reward-status").textContent = "";
    showStatus(text("ready"));
    render();
  }

  function selectCard(cardId) {
    if (state.phase !== "playing") return;
    const card = state.hand.find((entry) => entry.id === cardId);
    if (!card) return;
    if (card.cost > state.mana) return showStatus(text("manaShort"), true);
    state.selectedId = state.selectedId === cardId ? "" : cardId;
    showStatus(state.selectedId ? text("selectCard") : text("ready"));
    render();
  }

  function placeCard(slotIndex) {
    if (!state.selectedId || state.phase !== "playing") return;
    if (state.field[slotIndex]) return showStatus(text("fieldFull"), true);
    const handIndex = state.hand.findIndex((entry) => entry.id === state.selectedId);
    if (handIndex < 0) return;
    const card = state.hand[handIndex];
    if (card.cost > state.mana) return showStatus(text("manaShort"), true);
    state.mana -= card.cost;
    state.field[slotIndex] = card;
    state.hand.splice(handIndex, 1);
    state.actions.push({ turn: state.turn, cardId: card.id, slot: slotIndex });
    window.XenaAudio?.sfx("card_flip_a");
    state.selectedId = "";
    showStatus(text("placed"));
    render();
  }

  function endTurn() {
    if (state.phase !== "playing") return;
    const damage = fieldPower();
    const previousBossHp = state.bossHp;
    window.XenaAudio?.sfx("raid_boss_impact");
    state.lastDamage = damage;
    state.overkill = Math.max(0, damage - previousBossHp);
    state.bossHp = Math.max(0, previousBossHp - damage);
    $("#boss-card").classList.remove("boss-hit");
    requestAnimationFrame(() => $("#boss-card").classList.add("boss-hit"));
    if (state.bossHp === 0) return finish("win");
    state.turn += 1;
    if (state.turn > state.maxTurns) return finish("lose");
    state.maxMana = state.turn;
    state.mana = state.maxMana;
    showStatus(`${text("turnDamage")}: ${damage}`);
    render();
  }

  function finish(phase) {
    state.phase = phase;
    window.XenaAudio?.sfx(phase === "win" ? "final_win" : "match_fail_a");
    const overkill = phase === "win" ? state.overkill : 0;
    const score = phase === "win" ? 100 + ((state.maxTurns - state.turn) * 25) + (overkill * 5) : Math.max(0, (30 - state.bossHp) * 3);
    $("#result-kicker").textContent = text(phase === "win" ? "winKicker" : "loseKicker");
    $("#result-title").textContent = text(phase === "win" ? "winTitle" : "loseTitle");
    $("#result-copy").textContent = text(phase === "win" ? "winCopy" : "loseCopy");
    $("#result-score").textContent = String(score);
    $("#reward-status").textContent = "";
    render();
    if (phase === "win" && window.XenaWallet && window.XenaWallet.claimRaidClear) {
      window.XenaWallet.claimRaidClear(state.actions).then((result) => {
        $("#reward-status").textContent = result.granted ? `+${result.granted} XC` : "오늘의 레이드 보상은 이미 받았습니다.";
      }).catch(() => {
        $("#reward-status").textContent = "보상 확인에 실패했습니다. 잠시 후 다시 확인해 주세요.";
      });
    }
  }

  function updateWallet(balance) { $("#wallet").textContent = `${state.language === "en" ? "XC" : "XC"} ${balance == null ? "…" : Number(balance).toLocaleString()}`; }

  $("#start-button").addEventListener("click", startRaid);
  $("#retry-button").addEventListener("click", startRaid);
  $("#end-turn").addEventListener("click", endTurn);
  $("#language").addEventListener("click", () => { state.language = state.language === "ko" ? "en" : "ko"; localStorage.setItem("xena-lang", state.language); setLanguage(); });
  $("#sound").addEventListener("click", () => { document.body.classList.toggle("sound-muted"); $("#sound").textContent = document.body.classList.contains("sound-muted") ? "MUTED" : "SOUND"; });
  $("#hand-grid").addEventListener("click", (event) => { const card = event.target.closest("[data-card-id]"); if (card) selectCard(card.dataset.cardId); });
  $("#field-grid").addEventListener("click", (event) => { const slot = event.target.closest("[data-slot]"); if (slot) placeCard(Number(slot.dataset.slot)); });
  $("#field-grid").addEventListener("keydown", (event) => {
    const slot = event.target.closest("[data-slot]");
    if (slot && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); placeCard(Number(slot.dataset.slot)); }
  });
  $("#share-button").addEventListener("click", async () => {
    const message = text("shareText");
    if (navigator.share) await navigator.share({ title: "CRISIS: OVERRIDE", text: message, url: window.location.href }).catch(() => {});
    else { await navigator.clipboard?.writeText(`${message} ${window.location.href}`).catch(() => {}); $("#share-button").textContent = state.language === "en" ? "COPIED" : "복사 완료"; }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Enter" && state.phase === "playing") endTurn(); });

  if (window.XenaWallet) window.XenaWallet.subscribe(updateWallet);
  if (window.XenaAudio) window.XenaAudio.init("raid");
  setLanguage();
})();
