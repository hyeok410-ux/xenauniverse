(function () {
  "use strict";
  const G = window.OverrideGrid;
  const app = document.getElementById("app");
  function showFatalError() {
    if (document.querySelector(".fatal-overlay")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="fatal-overlay"><section><small>PROTOTYPE RECOVERY</small><h2>게임을 다시 불러와 주세요</h2><p>일시적인 실행 오류가 감지되었습니다. 저장된 시그널과 보유 상품은 브라우저에 유지됩니다.</p><button class="primary" data-reload-game>새로고침</button></section></div>`);
    document.querySelector("[data-reload-game]")?.addEventListener("click", () => window.location.reload());
  }
  window.addEventListener("error", (event) => { if (event.error) showFatalError(); });
  window.addEventListener("unhandledrejection", showFatalError);
  const glyph = { signal: "S", bastion: "B", vector: "V", glitch: "G", leader: "L", catalyst: "C" };
  const skillNames = {
    prismShift: { ko: ["프리즘 시프트", "인접 아군과 위치를 교환"], en: ["Prism Shift", "Swap with an adjacent ally"] },
    etherealLeap: { ko: ["이더리얼 리프", "각성 후 빈 칸으로 도약"], en: ["Ethereal Leap", "Leap to an empty L-square"] },
    cyanShift: { ko: ["시안 시프트", "인접 아군과 위치 교환"], en: ["Cyan Shift", "Swap with an adjacent ally"] },
    override: { ko: ["오버라이드", "빈 L자 칸으로 이동"], en: ["Override", "Move to an empty L-square"] },
    systemLock: { ko: ["시스템 락", "적 하나를 다음 턴 고정"], en: ["System Lock", "Lock one enemy for its next turn"] },
    publicErasure: { ko: ["공개 삭제", "인접 시그널 제거"], en: ["Public Erasure", "Erase an adjacent Signal"] },
  };
  const I18N = {
    ko: {
      store: "상점", play: "게임으로", owned: "보유 팩", locked: "잠김 팩", mode: "대전 모드", ai: ["AI 대전", "난이도를 골라 연습"], local: ["2인 대전", "같은 화면에서 교대"], online: ["온라인 대전", "초대 코드 체험판"], event: ["일일 이벤트", "하루 3단계 변칙 파편"], difficulty: "AI 난이도", victory: "승리", dailyClaimed: "오늘의 접속 보상 수령 완료", dailyReward: "접속 보상 · 시그널 크레딧 200", dailyReset: "뉴욕 자정 기준으로 갱신됩니다.", claim: "받기", claimed: "수령 완료", timePreview: "랭크별 제한시간 미리보기", rankReady: "온라인 랭크 준비 상태", rankNote: "초대 대전은 체험판이며 랭크와 재화 보상은 서버 검증 후 열립니다.", start: "시작", starterStart: "무료 스타터 확정 후 시작", buy: "구매", reset: "테스트 데이터 초기화", eventTitle: "오늘의 변칙 이벤트", complete: "완료", inProgress: "진행 중", rewardsClaimed: "보상 수령", selectUnit: "캐릭터를 선택하세요", opponentUnit: "상대 유닛을 확인 중입니다.", captured: "포획된 아군", none: "없음", firstMove: "첫 수를 선택하세요.", player: "플레이어", opponent: "AI 상대", playerOne: "플레이어 1", playerTwo: "플레이어 2", turn: "차례", move: "수", thinking: "동기화 중", cinematic: "전투 연출 실행 중", exit: "팩 선택으로", replay: "리플레이", previous: "이전", next: "다음", leave: "나가기", draw: "무승부", win: "승리", defeat: "패배", onlineLobby: "온라인 링크", onlineTitle: "온라인 초대 대전", onlineNote: "Google 로그인 후 8자리 초대 코드를 만들거나 입력해 다른 기기의 상대와 대전합니다.", quickMatch: "일반 매칭", createRoom: "초대 방 만들기", joinRoom: "초대 코드 입장", serverOffline: "서버 연결 대기", storeTitle: "오버라이드 상점", cosmetics: "코스메틱", shardStore: "변칙 파편", equip: "장착", equipped: "장착 중", purchase: "구매", checkoutReady: "결제 준비", noPower: "모든 스킨과 보드는 전투 능력치에 영향을 주지 않습니다.", paymentNotice: "결제 완료 재화 지급은 결제 웹훅과 서버 장부로 1회 검증되어야 합니다. 클라이언트만으로 지급하지 않습니다.", connection: "온라인 연결", language: "EN"
    },
    en: {
      store: "Store", play: "Play", owned: "Owned pack", locked: "Locked pack", mode: "Match mode", ai: ["AI Match", "Practice with a chosen difficulty"], local: ["Local Match", "Pass the screen between players"], online: ["Online Match", "Invite-code pilot"], event: ["Daily Event", "Three anomaly trials each day"], difficulty: "AI difficulty", victory: "Victory", dailyClaimed: "Daily login reward already claimed", dailyReward: "Daily login reward · 200 Signal Credits", dailyReset: "Resets at New York midnight.", claim: "Claim", claimed: "Claimed", timePreview: "Rank time controls", rankReady: "Online rank readiness", rankNote: "Invite matches are a pilot. Ranked rewards open after server validation is ready.", start: "Start", starterStart: "Confirm free starter and play", buy: "Buy", reset: "Reset test data", eventTitle: "Today's Anomaly Event", complete: "Complete", inProgress: "In progress", rewardsClaimed: "Reward claimed", selectUnit: "Select a character.", opponentUnit: "Viewing an opponent unit.", captured: "Captured allies", none: "None", firstMove: "Choose your first move.", player: "PLAYER", opponent: "AI OPPONENT", playerOne: "PLAYER 1", playerTwo: "PLAYER 2", turn: "turn", move: "move", thinking: "Synchronizing", cinematic: "Combat sequence in progress", exit: "Pack Select", replay: "Replay", previous: "Previous", next: "Next", leave: "Leave", draw: "Draw", win: "Victory", defeat: "Defeat", onlineLobby: "ONLINE LINK", onlineTitle: "Online Invite Match", onlineNote: "Sign in with Google, then create or enter an 8-character code to play an opponent on another device.", quickMatch: "Casual Match", createRoom: "Create Invite Room", joinRoom: "Join by Code", serverOffline: "Waiting for server connection", storeTitle: "Override Store", cosmetics: "Cosmetics", shardStore: "Anomaly Shards", equip: "Equip", equipped: "Equipped", purchase: "Purchase", checkoutReady: "Checkout Setup", noPower: "Every skin and board is purely cosmetic and never changes combat power.", paymentNotice: "Purchased currency must be granted once through a payment webhook and server ledger. The client never grants it.", connection: "Online Connection", language: "KO"
    }
  };
  const ASSET_ROOTS = {
    card: "./assets/cards/",
    portrait: "./assets/portraits/",
    skin: "./assets/skins/",
    effect: "./assets/effects/",
    board: "./assets/boards/",
    emote: "./assets/emotes/",
    ui: "./assets/ui/",
    audio: "./assets/audio/",
  };
  const CARD_ART_ROOT = ASSET_ROOTS.card;
  const PORTRAIT_ART_ROOT = ASSET_ROOTS.portrait;
  function assetSrc(root, file) {
    const keepPng = /^(unit_t2_|emote_xena_|pack_|frame_)/i.test(file || "");
    const optimized = root !== "card" && !keepPng && /\.png$/i.test(file) ? file.replace(/\.png$/i, ".webp") : file;
    return (ASSET_ROOTS[root] || CARD_ART_ROOT) + optimized;
  }
  const PACK_COVERS = {
    xena: "pack_xena_rebel_memory_v1.png",
    sovran: "pack_sovran_system_dominion_v1.png",
    crystal: "pack_stay_bright_crystal_rebellion_v1.png",
  };
  const PACK_PRICES = { xena: 2400, sovran: 2400, crystal: 5200 };
  const STARTER_PACKS = new Set(["xena", "sovran"]);
  const CARD_ART = {
    "XENA": "Track1_Card01_XENA_front_KR_v4_anomaly_layout.png",
    "XENA-OVERRIDE": "Track1_Card14_XENA_OVERRIDE_front_KR_v1.png",
    "NIX-09": "Track1_Card02_NIX09_front_KR_v2.png",
    "LYRA": "Track1_Card03_LYRA_front_KR_v1.png",
    "NOVA": "Track1_Card04_NOVA_front_KR_v1.png",
    "ECHO": "Track1_Card05_ECHO_front_KR_v1.png",
    "SOVRAN": "Track1_Card06_SOVRAN_front_KR_v1.png",
    "ARCHITECT-MAN": "Track1_Card07_ARCHITECT_MAN_front_KR_v1.png",
    "HUNTER": "Track1_Card10_HUNTER_front_KR_v1.png",
    "DRAGOON": "Track1_Card11_DRAGOON_front_KR_v1.png",
    "MOTHERSHIP": "Track1_Card12_MOTHERSHIP_front_KR_v1.png",
    "BAEK": "Track2_Card05_BAEK_front_KR_v1.png",
    "PALE-GOLD GUARDIAN": "Track1_Card07_ARCHITECT_MAN_front_KR_v1.png",
    "FIRST WHISTLER": "Track1_Card13_ERASED_CITIZEN_front_KR_v1.png",
    "JIN": "Track1_Card02_NIX09_front_KR_v2.png",
    "NAYUN'S MOTHER": "Track1_Card03_LYRA_front_KR_v1.png",
    "DANCER": "Track1_Card04_NOVA_front_KR_v1.png",
    "LUCID-5": "Track1_Card05_ECHO_front_KR_v1.png",
    "LUCID-6": "Track2_Card05_BAEK_front_KR_v1.png",
    "CLONE-01": "Track1_Card08_CLEANSE_TEAM_CLONE_front_KR_v1.png",
    "CLONE-02": "Track1_Card06_SOVRAN_front_KR_v1.png",
    "DRONE-01": "Track1_Card09_SYSTEM_DRONE_front_KR_v1.png",
    "DRONE-02": "Track1_Card11_DRAGOON_front_KR_v1.png",
    "MOOD+ WORKER": "Track1_Card12_MOTHERSHIP_front_KR_v1.png",
    "SHADOW WATCHER": "Track1_Card10_HUNTER_front_KR_v1.png",
    "PALE-GOLD GUARDIAN": "Track1_Card07_ARCHITECT_MAN_front_KR_v1.png",
  };
  const PORTRAIT_CROP = {
    "XENA": { scale: 2.75, shift: "62%" },
    "NIX-09": { scale: 2.7, shift: "56%" },
    "LYRA": { scale: 2.7, shift: "52%" },
    "NOVA": { scale: 2.7, shift: "52%" },
    "ECHO": { scale: 2.7, shift: "52%" },
    "BAEK": { scale: 2.6, shift: "45%" },
    "FIRST WHISTLER": { scale: 2.7, shift: "44%" },
    "JIN": { scale: 1.28, shift: "0%" },
    "NAYUN'S MOTHER": { scale: 1.2, shift: "0%" },
    "DANCER": { scale: 1.16, shift: "0%" },
    "LUCID-5": { scale: 1.18, shift: "0%" },
    "LUCID-6": { scale: 1.16, shift: "0%" },
    "CLONE-01": { scale: 2.65, shift: "48%" },
    "CLONE-02": { scale: 1.16, shift: "0%" },
    "DRONE-01": { scale: 2.6, shift: "47%" },
    "DRONE-02": { scale: 1.12, shift: "0%" },
    "MOOD+ WORKER": { scale: 1.18, shift: "0%" },
    "SHADOW WATCHER": { scale: 1.14, shift: "0%" },
    "PALE-GOLD GUARDIAN": { scale: 1.1, shift: "0%" },
  };
  const PORTRAIT_ART = {
    "XENA": "portrait_xena_base_v1.png",
    "BAEK": "portrait_baek_base_v1.png",
    "LYRA": "portrait_lyra_base_v1.png",
    "NIX-09": "portrait_nix09_base_v1.png",
    "ECHO": "portrait_echo_base_v1.png",
    "NOVA": "portrait_nova_base_v1.png",
    "FIRST WHISTLER": "portrait_first_whistler_base_v1.png",
    "SOVRAN": "portrait_sovran_base_v1.png",
    "ARCHITECT-MAN": "portrait_architect_man_base_v1.png",
    "CLONE-01": "portrait_clone_01_base_v1.png",
    "DRONE-01": "portrait_drone_01_base_v1.png",
    "HUNTER": "portrait_hunter_base_v1.png",
    "DRAGOON": "portrait_dragoon_base_v1.png",
    "MOTHERSHIP": "portrait_mothership_base_v1.png",
    "JIN": "jin_v1.png",
    "NAYUN'S MOTHER": "nayun_mother_v1.png",
    "DANCER": "bleeding_foot_dancer_v1.png",
    "LUCID-5": "lucid_5_v1.png",
    "LUCID-6": "lucid_6_v1.png",
    "CLONE-02": "clone_02_v1.png",
    "DRONE-02": "drone_02_v1.png",
    "MOOD+ WORKER": "mood_worker_v1.png",
    "SHADOW WATCHER": "shadow_watcher_v1.png",
    "PALE-GOLD GUARDIAN": "pale_gold_guardian_v1.png",
    "XENA ETHEREAL": "unit_t2_xena_ethereal_leader_v1.png",
    "NIX-09 CATALYST": "unit_t2_nix09_catalyst_v1.png",
    "CRYSTAL BASTION": "unit_t2_crystal_bastion_v1.png",
    "LYRA MEMORY VECTOR": "unit_t2_lyra_memory_vector_v1.png",
    "ECHO FREQUENCY VECTOR": "unit_t2_echo_frequency_vector_v1.png",
    "NOVA LAUGHING GLITCH": "unit_t2_nova_laughing_glitch_v1.png",
    "BAEK SIGNAL": "unit_t2_baek_signal_v1.png",
    "FIRST WHISTLER RETURNED": "unit_t2_first_whistler_returned_v1.png",
    "JIN CRYSTAL MARK": "unit_t2_jin_v1.png",
    "LUCID-5 RED CHAIN": "unit_t2_lucid5_v1.png",
    "LUCID-6 GLASS SHARD": "unit_t2_lucid6_v1.png",
    "NAYUN MOTHER STAY BRIGHT": "unit_t2_nayun_mother_v1.png",
  };
  const ROLE_INFO = {
    signal: ["시그널", "전진 · 회수 승급"],
    bastion: ["바스티온", "직선 전선 압박"],
    vector: ["벡터", "대각선 침투"],
    glitch: ["글리치", "L자 도약"],
    leader: ["리더", "체크메이트의 핵심"],
    catalyst: ["캐털리스트", "포획 시 리더 각성"],
  };
  const ROLE_LABEL = {
    signal: "시그널 · 폰",
    bastion: "바스티온 · 룩",
    vector: "벡터 · 비숍",
    glitch: "글리치 · 나이트",
    leader: "리더",
    catalyst: "캐털리스트 · 트리거",
  };
  const ROLE_INFO_EN = {
    signal: ["SIGNAL", "Advance · recovery promotion"],
    bastion: ["BASTION", "Straight-line pressure"],
    vector: ["VECTOR", "Diagonal infiltration"],
    glitch: ["GLITCH", "L-jump"],
    leader: ["LEADER", "The checkmate core"],
    catalyst: ["CATALYST", "Captured catalyst awakens the leader"],
  };
  const ROLE_LABEL_EN = {
    signal: "SIGNAL · PAWN", bastion: "BASTION · ROOK", vector: "VECTOR · BISHOP", glitch: "GLITCH · KNIGHT", leader: "LEADER", catalyst: "CATALYST · TRIGGER",
  };
  const TIME_RULES = {
    beginner: { label: "TRACE · SIGNAL", seconds: 600, note: "초보 10분" },
    standard: { label: "LUCID · REBEL", seconds: 480, note: "표준 8분" },
    override: { label: "OVERRIDE", seconds: 420, note: "상위 7분" },
    elite: { label: "SOVEREIGN · ANOMALY", seconds: 360, note: "최상위 6분" },
  };
  const MODES = {
    ai: { label: "AI 대전", note: "난이도를 골라 연습" },
    local: { label: "2인 대전", note: "같은 화면에서 교대" },
    online: { label: "온라인 대전", note: "서버 연결 준비 중" },
    event: { label: "일일 이벤트", note: "하루 3단계 변칙 파편" },
  };
  const DIFFICULTIES = {
    easy: { label: "쉬움", credits: 20, loss: 5, description: "기본 수 읽기" },
    normal: { label: "보통", credits: 35, loss: 7, description: "2수 탐색" },
    hard: { label: "어려움", credits: 55, loss: 10, description: "3수 탐색" },
  };
  const EVENT_REWARDS = {
    easy: { credits: 100, shards: 2 },
    normal: { credits: 180, shards: 5 },
    hard: { credits: 300, shards: 10 },
  };
  const CODEX_CARDS = [
    { id: "unit-xena", character: "XENA", name: "제나", pack: "xena", faction: "REBEL MEMORY", role: "leader", rarity: "HERO", art: CARD_ART.XENA, credit: 2400 },
    { id: "unit-baek", character: "BAEK", name: "백", pack: "xena", faction: "REBEL MEMORY", role: "bastion", rarity: "EPIC", art: CARD_ART.BAEK, credit: 1800 },
    { id: "unit-lyra", character: "LYRA", name: "라이라", pack: "xena", faction: "REBEL MEMORY", role: "vector", rarity: "LEGACY", art: CARD_ART.LYRA, credit: 1250 },
    { id: "unit-nix09", character: "NIX-09", name: "NIX-09", pack: "xena", faction: "REBEL MEMORY", role: "catalyst", rarity: "SECRET", art: CARD_ART["NIX-09"], credit: 2200 },
    { id: "unit-echo", character: "ECHO", name: "에코", pack: "xena", faction: "REBEL MEMORY", role: "vector", rarity: "LEGACY", art: CARD_ART.ECHO, credit: 1250 },
    { id: "unit-nova", character: "NOVA", name: "노바", pack: "xena", faction: "REBEL MEMORY", role: "glitch", rarity: "LEGACY", art: CARD_ART.NOVA, credit: 1450 },
    { id: "unit-first-whistler", character: "FIRST WHISTLER", name: "첫 휘파람", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "SACRIFICE", art: CARD_ART["FIRST WHISTLER"], credit: 460 },
    { id: "unit-jin", character: "JIN", name: "진", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "RARE", art: "jin_v1.png", artRoot: "portrait", credit: 680 },
    { id: "unit-nayun-mother", character: "NAYUN'S MOTHER", name: "나윤의 어머니", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "RARE", art: "nayun_mother_v1.png", artRoot: "portrait", credit: 680 },
    { id: "unit-dancer", character: "DANCER", name: "피 흘리는 발의 무희", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "RARE", art: "bleeding_foot_dancer_v1.png", artRoot: "portrait", credit: 680 },
    { id: "unit-lucid5", character: "LUCID-5", name: "루시드-5", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "UNCOMMON", art: "lucid_5_v1.png", artRoot: "portrait", credit: 520 },
    { id: "unit-lucid6", character: "LUCID-6", name: "루시드-6", pack: "xena", faction: "REBEL MEMORY", role: "signal", rarity: "UNCOMMON", art: "lucid_6_v1.png", artRoot: "portrait", credit: 520 },
    { id: "unit-sovran", character: "SOVRAN", name: "소브란", pack: "sovran", faction: "SYSTEM DOMINION", role: "leader", rarity: "BOSS", art: CARD_ART.SOVRAN, credit: 2400 },
    { id: "unit-dragoon", character: "DRAGOON", name: "세 다리 드라군", pack: "sovran", faction: "SYSTEM DOMINION", role: "bastion", rarity: "EPIC", art: CARD_ART.DRAGOON, credit: 1800 },
    { id: "unit-architect", character: "ARCHITECT-MAN", name: "설계자-남자", pack: "sovran", faction: "SYSTEM DOMINION", role: "vector", rarity: "EPIC", art: CARD_ART["ARCHITECT-MAN"], credit: 1700 },
    { id: "unit-mothership", character: "MOTHERSHIP", name: "모선", pack: "sovran", faction: "SYSTEM DOMINION", role: "catalyst", rarity: "BOSS", art: CARD_ART.MOTHERSHIP, credit: 2200 },
    { id: "unit-pale-guardian", character: "PALE-GOLD GUARDIAN", name: "창백한 금빛 수호자", pack: "sovran", faction: "SYSTEM DOMINION", role: "vector", rarity: "EPIC", art: "pale_gold_guardian_v1.png", artRoot: "portrait", credit: 1700 },
    { id: "unit-hunter", character: "HUNTER", name: "세 다리 헌터", pack: "sovran", faction: "SYSTEM DOMINION", role: "glitch", rarity: "RARE", art: CARD_ART.HUNTER, credit: 920 },
    { id: "unit-clone1", character: "CLONE-01", name: "정화팀 클론-01", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "UNCOMMON", art: CARD_ART["CLONE-01"], credit: 520 },
    { id: "unit-clone2", character: "CLONE-02", name: "정화팀 클론-02", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "UNCOMMON", art: "clone_02_v1.png", artRoot: "portrait", credit: 520 },
    { id: "unit-drone1", character: "DRONE-01", name: "시스템 드론-01", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "UNCOMMON", art: CARD_ART["DRONE-01"], credit: 520 },
    { id: "unit-drone2", character: "DRONE-02", name: "시스템 드론-02", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "UNCOMMON", art: "drone_02_v1.png", artRoot: "portrait", credit: 520 },
    { id: "unit-mood-worker", character: "MOOD+ WORKER", name: "무드 플러스 작업자", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "RARE", art: "mood_worker_v1.png", artRoot: "portrait", credit: 680 },
    { id: "unit-shadow-watcher", character: "SHADOW WATCHER", name: "그림자 감시자", pack: "sovran", faction: "SYSTEM DOMINION", role: "signal", rarity: "RARE", art: "shadow_watcher_v1.png", artRoot: "portrait", credit: 680 },
    { id: "unit-t2-xena-ethereal", character: "XENA ETHEREAL", name: "제나 이더리얼", pack: "crystal", faction: "CRYSTAL REBELLION", role: "leader", rarity: "HERO", art: "unit_t2_xena_ethereal_leader_v1.png", artRoot: "portrait", credit: 4200 },
    { id: "unit-t2-crystal-bastion", character: "CRYSTAL BASTION", name: "크리스탈 바스티온", pack: "crystal", faction: "CRYSTAL REBELLION", role: "bastion", rarity: "EPIC", art: "unit_t2_crystal_bastion_v1.png", artRoot: "portrait", credit: 2800 },
    { id: "unit-t2-lyra-vector", character: "LYRA MEMORY VECTOR", name: "라이라 메모리 벡터", pack: "crystal", faction: "CRYSTAL REBELLION", role: "vector", rarity: "LEGACY", art: "unit_t2_lyra_memory_vector_v1.png", artRoot: "portrait", credit: 2100 },
    { id: "unit-t2-nix09-catalyst", character: "NIX-09 CATALYST", name: "NIX-09 캐털리스트", pack: "crystal", faction: "CRYSTAL REBELLION", role: "catalyst", rarity: "SECRET", art: "unit_t2_nix09_catalyst_v1.png", artRoot: "portrait", credit: 3600 },
    { id: "unit-t2-echo-vector", character: "ECHO FREQUENCY VECTOR", name: "에코 주파수 벡터", pack: "crystal", faction: "CRYSTAL REBELLION", role: "vector", rarity: "LEGACY", art: "unit_t2_echo_frequency_vector_v1.png", artRoot: "portrait", credit: 2100 },
    { id: "unit-t2-nova-glitch", character: "NOVA LAUGHING GLITCH", name: "노바 라핑 글리치", pack: "crystal", faction: "CRYSTAL REBELLION", role: "glitch", rarity: "LEGACY", art: "unit_t2_nova_laughing_glitch_v1.png", artRoot: "portrait", credit: 2300 },
    { id: "unit-t2-baek-signal", character: "BAEK SIGNAL", name: "백 시그널", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "RARE", art: "unit_t2_baek_signal_v1.png", artRoot: "portrait", credit: 900 },
    { id: "unit-t2-jin", character: "JIN CRYSTAL MARK", name: "진", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "RARE", art: "unit_t2_jin_v1.png", artRoot: "portrait", credit: 900 },
    { id: "unit-t2-first-whistler-returned", character: "FIRST WHISTLER RETURNED", name: "첫 휘파람의 귀환자", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "RARE", art: "unit_t2_first_whistler_returned_v1.png", artRoot: "portrait", credit: 900 },
    { id: "unit-t2-lucid5", character: "LUCID-5 RED CHAIN", name: "루시드-5", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "UNCOMMON", art: "unit_t2_lucid5_v1.png", artRoot: "portrait", credit: 760 },
    { id: "unit-t2-lucid6", character: "LUCID-6 GLASS SHARD", name: "루시드-6", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "UNCOMMON", art: "unit_t2_lucid6_v1.png", artRoot: "portrait", credit: 760 },
    { id: "unit-t2-nayun-mother", character: "NAYUN MOTHER STAY BRIGHT", name: "나윤의 어머니", pack: "crystal", faction: "CRYSTAL REBELLION", role: "signal", rarity: "RARE", art: "unit_t2_nayun_mother_v1.png", artRoot: "portrait", credit: 900 },
  ];
  const LEGACY_CODEX_MAP = {
    "t1-001": "unit-xena", "t1-002": "unit-nix09", "t1-003": "unit-lyra", "t1-004": "unit-nova",
    "t1-005": "unit-echo", "t1-006": "unit-sovran", "t1-007": "unit-architect", "t1-008": "unit-clone1",
    "t1-009": "unit-drone1", "t1-010": "unit-hunter", "t1-011": "unit-dragoon", "t1-012": "unit-mothership",
    "t1-013": "unit-first-whistler",
  };
  const SHOP_ITEMS = [
    { id: "arena-crystal-bastion", name: "Crystal Bastion Atmosphere", kind: "arena", role: "게임 공간 스킨", tier: "EPIC", credit: 4800, artRoot: "board", art: "board_sector_nine_v1.webp", arenaStyle: "crystal-bastion", description: "좌우 패널과 전투 배경을 크리스털 반란군 분위기로 변경" },
    { id: "arena-echo-grid", name: "Echo Grid Atmosphere", kind: "arena", role: "게임 공간 스킨", tier: "LEGACY", credit: 5600, artRoot: "board", art: "board_echo_grid_v1.webp", arenaStyle: "echo-grid", description: "좌우 패널과 전투 배경을 주파수 아카이브 분위기로 변경" },
    { id: "arena-mothership", name: "Mothership Eclipse Atmosphere", kind: "arena", role: "게임 공간 스킨", tier: "BOSS", shards: 240, artRoot: "board", art: "board_mothership_sky_v1.webp", arenaStyle: "mothership", description: "좌우 패널과 전투 배경을 모선 폭격 구역 분위기로 변경" },
    { id: "cyan-xena", name: "XENA · Cyan Sovereign", kind: "skin", role: "캐릭터 스킨", tier: "SOVEREIGN", targetCharacter: "XENA", credit: 8000, artRoot: "skin", art: "skin_xena_cyan_sovereign_v1.png", description: "시안 왕관광과 기계 장갑으로 재구성된 제나 전용 스킨" },
    { id: "white-xena", name: "XENA · White Ethereal", kind: "skin", role: "캐릭터 스킨", tier: "EPIC", targetCharacter: "XENA", shards: 260, artRoot: "skin", art: "skin_xena_white_ethereal_v1.png", description: "백색 신호광과 유령 주파수를 두른 제나 전용 스킨" },
    { id: "black-xena", name: "XENA · Black Signal", kind: "skin", role: "캐릭터 스킨", tier: "EPIC", targetCharacter: "XENA", credit: 7000, artRoot: "skin", art: "skin_xena_black_signal_v1.png", description: "검은 신호 잠입 장비를 착용한 제나 전용 스킨" },
    { id: "violet-xena", name: "XENA · Violet Pulse", kind: "skin", role: "캐릭터 스킨", tier: "LEGACY", targetCharacter: "XENA", credit: 6500, artRoot: "skin", art: "skin_xena_violet_pulse_v1.png", description: "보랏빛 주파수 코어가 점등된 제나 전용 스킨" },
    { id: "override-xena", name: "XENA · Override Form", kind: "skin", role: "캐릭터 스킨", tier: "OVERRIDE", targetCharacter: "XENA", shards: 420, artRoot: "portrait", art: "xena_override_v1.png", description: "캐털리스트 링크가 끊어진 뒤 각성한 오버라이드 외형" },
    { id: "crimson-sovran", name: "SOVRAN · Crimson Sovereign", kind: "skin", role: "캐릭터 스킨", tier: "SOVEREIGN", targetCharacter: "SOVRAN", credit: 8000, artRoot: "skin", art: "skin_sovran_crimson_sovereign_v1.png", description: "크림슨 심판 회로가 활성화된 소브란 전용 스킨" },
    { id: "eclipse-sovran", name: "SOVRAN · Eclipse Judgment", kind: "skin", role: "캐릭터 스킨", tier: "BOSS", targetCharacter: "SOVRAN", shards: 300, artRoot: "skin", art: "skin_sovran_eclipse_judgment_v1.png", description: "일식의 판결장을 펼치는 소브란 전용 스킨" },
    { id: "override-sovran", name: "SOVRAN · Override Form", kind: "skin", role: "캐릭터 스킨", tier: "OVERRIDE", targetCharacter: "SOVRAN", shards: 420, artRoot: "portrait", art: "sovran_override_v1.png", description: "캐털리스트 상실 뒤 폭주한 소브란 각성 외형" },
    { id: "memory-nix09", name: "NIX-09 · Memory Awake", kind: "skin", role: "캐릭터 스킨", tier: "SECRET", targetCharacter: "NIX-09", shards: 220, artRoot: "skin", art: "skin_nix09_memory_awake_v1.png", description: "봉인된 기억 신호가 깨어난 NIX-09 스킨" },
    { id: "ghost-lyra", name: "LYRA · Ghost Protocol", kind: "skin", role: "캐릭터 스킨", tier: "LEGACY", targetCharacter: "LYRA", credit: 5200, artRoot: "skin", art: "skin_lyra_ghost_protocol_v1.png", description: "고스트 프로토콜로 재현된 라이라 전용 스킨" },
    { id: "oracle-echo", name: "ECHO · Frequency Oracle", kind: "skin", role: "캐릭터 스킨", tier: "LEGACY", targetCharacter: "ECHO", credit: 5200, artRoot: "skin", art: "skin_echo_frequency_oracle_v1.png", description: "전장의 주파수를 예측하는 에코 전용 스킨" },
    { id: "legacy-nova", name: "NOVA · Legacy Flame", kind: "skin", role: "캐릭터 스킨", tier: "LEGACY", targetCharacter: "NOVA", shards: 260, artRoot: "skin", art: "skin_nova_legacy_flame_v1.png", description: "기억의 불꽃이 타오르는 노바 전용 스킨" },
    { id: "red-architect", name: "ARCHITECT · Red Consent", kind: "skin", role: "캐릭터 스킨", tier: "EPIC", targetCharacter: "ARCHITECT-MAN", credit: 6200, artRoot: "skin", art: "skin_architect_red_consent_v1.png", description: "붉은 동의의 칼날을 든 설계자 전용 스킨" },
    { id: "scanner-hunter", name: "HUNTER · White Scanner", kind: "skin", role: "캐릭터 스킨", tier: "RARE", targetCharacter: "HUNTER", credit: 4200, artRoot: "skin", art: "skin_hunter_white_scanner_v1.png", description: "백색 감시 센서로 개조된 헌터 전용 스킨" },
    { id: "siege-dragoon", name: "DRAGOON · Siege Core", kind: "skin", role: "캐릭터 스킨", tier: "EPIC", targetCharacter: "DRAGOON", credit: 6200, artRoot: "skin", art: "skin_dragoon_siege_core_v1.png", description: "공성 코어가 개방된 드라군 전용 스킨" },
    { id: "fx-cyan-slash", name: "Cyan Blade Trail", kind: "effect", role: "공격 이펙트", tier: "EPIC", credit: 3600, effectStyle: "slash", effectColor: 0x37eef5, artRoot: "effect", art: "fx_cyan_blade_trail_v1.png", description: "이동·포획 시 시안 칼날 궤적을 적용" },
    { id: "fx-memory-ring", name: "Memory Ring", kind: "effect", role: "공격 이펙트", tier: "EPIC", credit: 3400, effectStyle: "memory", effectColor: 0xa77bff, artRoot: "effect", art: "fx_memory_ring_v1.png", description: "이동·포획 시 기억 링 파동을 적용" },
    { id: "fx-sky-verdict", name: "Sky Verdict", kind: "effect", role: "공격 이펙트", tier: "BOSS", shards: 180, effectStyle: "sky", effectColor: 0xff315f, artRoot: "effect", art: "fx_sky_verdict_v1.png", description: "붉은 하늘의 판결이 목표 지점에 낙하" },
    { id: "fx-frequency", name: "Frequency Pulse", kind: "effect", role: "공격 이펙트", tier: "RARE", credit: 3200, effectStyle: "frequency", effectColor: 0x4ce9ff, artRoot: "effect", art: "fx_frequency_pulse_v1.png", description: "전장을 스캔하는 주파수 파동을 적용" },
    { id: "fx-glitch-fracture", name: "Glitch Fracture", kind: "effect", role: "공격 이펙트", tier: "EPIC", credit: 3900, effectStyle: "glitch", effectColor: 0xff4fbd, artRoot: "effect", art: "fx_glitch_fracture_v1.png", description: "공간이 깨지는 글리치 균열 포획 효과" },
    { id: "fx-soul-recovery", name: "Soul Recovery", kind: "effect", role: "공격 이펙트", tier: "LEGACY", shards: 160, effectStyle: "recovery", effectColor: 0xb7ff3c, artRoot: "effect", art: "fx_soul_recovery_v1.png", description: "회수 승급과 이동에 영혼 신호를 소환" },
    { id: "fx-system-lock", name: "System Lock", kind: "effect", role: "공격 이펙트", tier: "BOSS", shards: 180, effectStyle: "lock", effectColor: 0xffd66b, artRoot: "effect", art: "fx_system_lock_v1.png", description: "목표를 시스템 격자에 봉쇄하는 효과" },
    { id: "fx-rainbow-override", name: "Rainbow Override", kind: "effect", role: "공격 이펙트", tier: "OVERRIDE", shards: 360, effectStyle: "override", effectColor: 0xd88cff, artRoot: "effect", art: "fx_rainbow_override_v1.png", description: "오버라이드 스펙트럼이 전장을 가르는 최상위 효과" },
    { id: "sector-nine", name: "Sector Nine Board", kind: "board", role: "전장", tier: "EPIC", credit: 12000, artRoot: "board", art: "board_sector_nine_v1.png", description: "시안·보랏빛 신호벽으로 둘러싸인 섹터 나인 전장" },
    { id: "echo-grid", name: "Echo Grid Board", kind: "board", role: "전장", tier: "EPIC", credit: 10500, artRoot: "board", art: "board_echo_grid_v1.png", description: "주파수 스캔 라인이 흐르는 에코 전장" },
    { id: "dragoon-core", name: "Dragoon Core Board", kind: "board", role: "전장", tier: "EPIC", credit: 11000, artRoot: "board", art: "board_dragoon_core_v1.png", description: "중장갑 경보등으로 점등된 드라군 코어 전장" },
    { id: "mothership-sky", name: "Mothership Sky Board", kind: "board", role: "전장", tier: "BOSS", shards: 300, artRoot: "board", art: "board_mothership_sky_v1.png", description: "상공의 보랏빛 폭격 항로가 열린 모선 전장" },
    { id: "frame-cyan-circuit", name: "Cyan Circuit Frame", kind: "frame", role: "말 테두리", tier: "RARE", credit: 2800, frameStyle: "cyan-circuit", artRoot: "ui", art: "frame_cyan_circuit_preview_v1.png", description: "아군 말에 이중 시안 회로와 신호광 테두리를 적용" },
    { id: "frame-violet-glitch", name: "Violet Glitch Frame", kind: "frame", role: "말 테두리", tier: "EPIC", credit: 4200, frameStyle: "violet-glitch", artRoot: "ui", art: "frame_violet_glitch_preview_v1.png", description: "아군 말 테두리에 보랏빛 글리치 분할광을 적용" },
    { id: "frame-gold-sovereign", name: "Sovereign Gold Frame", kind: "frame", role: "말 테두리", tier: "SOVEREIGN", shards: 160, frameStyle: "gold-sovereign", artRoot: "ui", art: "frame_gold_sovereign_preview_v1.png", description: "아군 말에 백금·금빛 왕관 회로 테두리를 적용" },
    { id: "frame-crimson-eclipse", name: "Crimson Eclipse Frame", kind: "frame", role: "말 테두리", tier: "BOSS", credit: 4800, frameStyle: "crimson-eclipse", artRoot: "ui", art: "frame_crimson_eclipse_preview_v1.png", description: "아군 말에 붉은 일식과 판결 회로 테두리를 적용" },
    { id: "emote-signal", name: "XENA Reaction Pack", kind: "emote", role: "캐릭터 이모트", tier: "EPIC", credit: 3600, artRoot: "emote", art: "emote_xena_good_game_v1.png", description: "제나의 웃음·눈물·도발·존중·압박·엄지 인사 리액션 6종" },
  ];
  const SHOP_DETAILS = {
    "cyan-xena": { role: "캐릭터 스킨", tier: "SOVEREIGN", order: 8 },
    "crimson-sovran": { role: "캐릭터 스킨", tier: "SOVEREIGN", order: 8 },
    "override-xena": { role: "캐릭터 스킨", tier: "OVERRIDE", order: 9 },
    "sector-nine": { role: "전장", tier: "EPIC", order: 1 },
    "emote-signal": { role: "이모트", tier: "RARE", order: 0 },
    "echo-grid": { role: "전장", tier: "EPIC", order: 1 },
    "legacy-nova": { role: "캐릭터 스킨", tier: "LEGACY", order: 8 },
    "dragoon-core": { role: "전장", tier: "EPIC", order: 1 },
    "mothership-sky": { role: "전장", tier: "BOSS", order: 1 },
    "fx-cyan-slash": { role: "공격 이펙트", tier: "EPIC", order: 6 },
    "fx-memory-ring": { role: "공격 이펙트", tier: "EPIC", order: 6 },
    "fx-sky-verdict": { role: "공격 이펙트", tier: "BOSS", order: 7 },
    "fx-frequency": { role: "공격 이펙트", tier: "RARE", order: 6 },
  };
  const PAYMENT_PRODUCTS = [
    { id: "AS_120", name: "Anomaly Shards 120", amount: 120, price: "₩1,500" },
    { id: "AS_650", name: "Anomaly Shards 700", amount: 700, price: "₩7,500" },
    { id: "AS_1400", name: "Anomaly Shards 1,600", amount: 1600, price: "₩15,000" },
  ];
  const EMOTES = {
    smile: { mark: "◇", ko: "좋은 수", en: "Good move", art: "emote_xena_good_move_v1.png" },
    cry: { mark: "!", ko: "아쉬워", en: "So close", art: "emote_xena_cry_v1.png" },
    tease: { mark: "X", ko: "재밌네", en: "Interesting", art: "emote_xena_tease_v1.png" },
    respect: { mark: "+", ko: "존중", en: "Respect", art: "emote_xena_respect_v1.png" },
    pressure: { mark: "//", ko: "집중해", en: "Focus", art: "emote_xena_pressure_v1.png" },
    gg: { mark: "GG", ko: "좋은 게임", en: "Good game", art: "emote_xena_good_game_v1.png" },
  };
  const FREE_EMOTES = new Set();
  const FORMATION_SLOTS = [
    { key: "bastion", role: "bastion", label: "바스티온 · 룩" },
    { key: "vector1", role: "vector", label: "벡터 A · 비숍" },
    { key: "catalyst", role: "catalyst", label: "캐털리스트 · 트리거" },
    { key: "leader", role: "leader", label: "리더" },
    { key: "vector2", role: "vector", label: "벡터 B · 비숍" },
    { key: "glitch", role: "glitch", label: "글리치 · 나이트" },
    ...Array.from({ length: 6 }, (_, index) => ({ key: `signal${index + 1}`, role: "signal", label: `시그널 ${index + 1} · 폰` })),
  ];

  function defaultLineup(packId) {
    const pack = G.PACKS[packId];
    return {
      bastion: pack.back.bastion,
      vector1: pack.back.vector1,
      catalyst: pack.back.catalyst,
      leader: pack.back.leader,
      vector2: pack.back.vector2,
      glitch: pack.back.glitch,
      ...Object.fromEntries(pack.signals.map((character, index) => [`signal${index + 1}`, character])),
    };
  }

  function normalizedLineups(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    for (const packId of Object.keys(G.PACKS)) {
      const fallback = defaultLineup(packId);
      result[packId] = {};
      const used = new Set();
      for (const slot of FORMATION_SLOTS) {
        const character = source[packId] && source[packId][slot.key];
        const unit = CODEX_CARDS.find((card) => card.character === character && card.role === slot.role);
        const candidates = [
          unit && character,
          fallback[slot.key],
          ...CODEX_CARDS.filter((card) => card.pack === packId && card.role === slot.role).map((card) => card.character),
          ...CODEX_CARDS.filter((card) => card.role === slot.role).map((card) => card.character),
        ].filter(Boolean);
        const uniqueCharacter = candidates.find((candidate) => !used.has(candidate));
        result[packId][slot.key] = uniqueCharacter || fallback[slot.key];
        used.add(result[packId][slot.key]);
      }
    }
    return result;
  }

  const storage = {
    available: true,
    get(key) {
      try { return window.localStorage.getItem(key); }
      catch (_) { this.available = false; return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); }
      catch (_) { this.available = false; }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); }
      catch (_) { this.available = false; }
    },
  };

  function safeJson(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }

  function storedArray(key) {
    const value = safeJson(storage.get(key), []);
    return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string"))] : [];
  }

  function createGuestProfile() {
    const bytes = new Uint8Array(4);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    const code = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
    return { id: `XG-${code.slice(0, 4)}-${code.slice(4)}`, nickname: `SIGNAL-${code.slice(-4)}`, createdAt: new Date().toISOString() };
  }

  let screen = "setup";
  let pendingRoomCode = "";
  let profile = safeJson(storage.get("og_profile"), null) || createGuestProfile();
  const hubNickname = storage.get("xena_nickname");
  if (hubNickname && !profile.nickname) profile.nickname = hubNickname;
  if (hubNickname) profile.nickname = hubNickname;
  let committedStarter = storage.get("og_starter");
  let chosen = committedStarter || "xena";
  let owned = storedArray("og_owned");
  if (!owned.length && committedStarter) owned = [committedStarter];
  let credits = Math.max(0, Number(storage.get("og_credits") || 0) || 0);
  let shards = Math.max(0, Number(storage.get("og_shards") || 0) || 0);
  let timeRule = storage.get("og_time_rule") || "beginner";
  let gameMode = storage.get("og_game_mode") || "ai";
  let language = storage.get("og_language") || "ko";
  let aiDifficulty = storage.get("og_ai_difficulty") || "normal";
  let eventDifficulty = "easy";
  let eventClaims = safeJson(storage.get("og_event_claims"), {}) || {};
  let gridRating = Math.max(0, Number(storage.get("og_grid_rating") || 0) || 0);
  let cosmeticOwned = storedArray("og_cosmetics");
  const storedBoard = storage.get("og_active_board") || storage.get("og_active_cosmetic") || "";
  let activeBoard = SHOP_ITEMS.some((item) => item.id === storedBoard && item.kind === "board") ? storedBoard : "";
  const storedArena = storage.get("og_active_arena") || "";
  let activeArena = SHOP_ITEMS.some((item) => item.id === storedArena && item.kind === "arena" && cosmeticOwned.includes(item.id)) ? storedArena : "";
  const storedFrame = storage.get("og_active_frame") || "";
  let activeFrame = SHOP_ITEMS.some((item) => item.id === storedFrame && item.kind === "frame") ? storedFrame : "";
  let unitLineups = normalizedLineups(safeJson(storage.get("og_unit_lineups"), {}));
  let unitSkins = safeJson(storage.get("og_unit_skins"), {}) || {};
  const legacyActiveSkin = SHOP_ITEMS.find((item) => item.id === storedBoard && item.kind === "skin" && cosmeticOwned.includes(item.id));
  if (legacyActiveSkin && !unitSkins[legacyActiveSkin.targetCharacter]) unitSkins[legacyActiveSkin.targetCharacter] = legacyActiveSkin.id;
  let unitEffects = safeJson(storage.get("og_unit_effects"), {}) || {};
  let selectedUnitSlot = null;
  let lineupPack = committedStarter || "xena";
  let dailyLogin = safeJson(storage.get("og_daily_login"), {}) || {};
  let activity = safeJson(storage.get("og_activity"), { totalMinutes: 0, games: {}, lastGame: "" }) || { totalMinutes: 0, games: {}, lastGame: "" };
  let codexOwned = [...new Set(storedArray("og_codex_owned").map((id) => LEGACY_CODEX_MAP[id] || id).filter((id) => CODEX_CARDS.some((card) => card.id === id)))];
  let showcase = null;
  let state = null;
  let selected = null;
  let selectedSkill = null;
  let legal = [];
  let playerColor = "white";
  let thinking = false;
  let result = null;
  let chestOpened = false;
  let lastVisualMove = null;
  let cinematicAction = null;
  let visualNonce = 0;
  let animating = false;
  let snapshots = [];
  let lastReplay = [];
  let replayMode = false;
  let replayIndex = 0;
  let clocks = { white: 300, black: 300 };
  let timer = null;
  let emoteFeed = [];
  let emoteNonce = 0;
  let promotionChoices = [];
  let onlineUiUnsubscribe = null;
  let onlineBinding = false;
  let onlineConnecting = false;
  let onlineRevision = -1;
  let onlineEmoteNonce = 0;
  let timerWarningKey = "";
  let activityStartedAt = 0;
  let audioEnabled = storage.get("og_audio_enabled") !== "0";
  const audioState = { unlocked: false, bgm: null, bgmKey: "", lastSfxAt: 0 };
  const BGM = {
    setup: "bgm_lobby_signal_v1.mp3",
    store: "bgm_store_override_boutique_v1.mp3",
    codex: "bgm_codex_memory_archive_v1.mp3",
    units: "bgm_loadout_memory_grid_v1.mp3",
    online: "bgm_matchmaking_link_v1.mp3",
    battle: "bgm_battle_override_grid_v1.mp3",
    critical: "bgm_battle_critical_v1.mp3",
    victory: "bgm_victory_answer_v1.mp3",
    defeat: "bgm_defeat_signal_lost_v1.mp3",
  };
  const SFX = {
    click: "ui_click_v1.mp3",
    tab: "ui_tab_v1.mp3",
    back: "ui_back_v1.mp3",
    confirm: "ui_confirm_v1.mp3",
    purchase: "ui_purchase_v1.mp3",
    equip: "ui_equip_v1.mp3",
    invalid: "ui_invalid_v1.mp3",
    reward: "ui_reward_v1.mp3",
    select: "battle_select_v1.mp3",
    moveSignal: "battle_move_signal_v1.mp3",
    moveHeavy: "battle_move_heavy_v1.mp3",
    moveGlitch: "battle_move_glitch_v1.mp3",
    captureCyan: "battle_capture_cyan_v1.mp3",
    captureCrimson: "battle_capture_crimson_v1.mp3",
    awakenXena: "battle_awaken_xena_v1.mp3",
    awakenSovran: "battle_awaken_sovran_v1.mp3",
    catalystLost: "battle_catalyst_lost_v1.mp3",
    check: "battle_check_v1.mp3",
    promotion: "battle_promotion_v1.mp3",
    timer10: "battle_timer_10s_v1.mp3",
    cyanShift: "battle_skill_cyan_shift_v1.mp3",
    override: "battle_skill_override_v1.mp3",
    systemLock: "battle_skill_system_lock_v1.mp3",
    publicErasure: "battle_skill_public_erasure_v1.mp3",
  };

  function saveAudioPreference() {
    storage.set("og_audio_enabled", audioEnabled ? "1" : "0");
  }

  function audioUrl(file) {
    return assetSrc("audio", file);
  }

  function unlockAudio() {
    audioState.unlocked = true;
    if (audioEnabled) syncBgm();
  }

  function stopAudioForBackground() {
    if (audioState.bgm) audioState.bgm.pause();
  }

  function resumeAudioAfterForeground() {
    if (document.visibilityState === "visible" && audioEnabled && audioState.unlocked) syncBgm();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopAudioForBackground();
    else resumeAudioAfterForeground();
  });
  window.addEventListener("pagehide", stopAudioForBackground);

  function playSfx(key, volume) {
    if (!audioEnabled || !audioState.unlocked || !SFX[key]) return;
    const now = Date.now();
    if (key === "click" && now - audioState.lastSfxAt < 80) return;
    audioState.lastSfxAt = now;
    const audio = new Audio(audioUrl(SFX[key]));
    audio.volume = volume ?? 0.42;
    audio.play().catch(() => {});
  }

  function playBgm(key) {
    if (!audioEnabled || !audioState.unlocked || !BGM[key] || audioState.bgmKey === key) return;
    if (audioState.bgm) {
      audioState.bgm.pause();
      audioState.bgm = null;
    }
    const audio = new Audio(audioUrl(BGM[key]));
    audio.loop = !["victory", "defeat"].includes(key);
    audio.volume = key === "battle" || key === "critical" ? 0.24 : 0.3;
    audioState.bgm = audio;
    audioState.bgmKey = key;
    audio.play().catch(() => {});
  }

  function screenBgmKey() {
    if (screen === "game") {
      if (result) return result.win || result.localGame ? "victory" : "defeat";
      if (state && Math.min(clocks.white || 999, clocks.black || 999) <= 60) return "critical";
      return "battle";
    }
    if (screen === "store" || screen === "codex" || screen === "units" || screen === "online") return screen;
    return "setup";
  }

  function syncBgm() {
    if (!audioEnabled) {
      if (audioState.bgm) audioState.bgm.pause();
      audioState.bgm = null;
      audioState.bgmKey = "";
      return;
    }
    playBgm(screenBgmKey());
  }

  function toggleAudio() {
    audioEnabled = !audioEnabled;
    saveAudioPreference();
    if (audioEnabled) unlockAudio();
    else syncBgm();
    refreshCurrentScreen();
  }

  window.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("click", (event) => {
    if (event.target && event.target.closest && event.target.closest("button")) playSfx("click", 0.22);
  }, true);

  function saveMeta() {
    storage.set("og_profile", JSON.stringify(profile));
    if (committedStarter) storage.set("og_starter", committedStarter);
    else storage.remove("og_starter");
    storage.set("og_owned", JSON.stringify(owned));
    storage.set("og_credits", String(credits));
    storage.set("og_shards", String(shards));
    storage.set("og_time_rule", timeRule);
    storage.set("og_game_mode", gameMode);
    storage.set("og_language", language);
    storage.set("og_ai_difficulty", aiDifficulty);
    storage.set("og_event_claims", JSON.stringify(eventClaims));
    storage.set("og_grid_rating", String(gridRating));
    storage.set("og_cosmetics", JSON.stringify(cosmeticOwned));
    storage.set("og_active_board", activeBoard);
    storage.set("og_active_arena", activeArena);
    storage.set("og_active_cosmetic", activeBoard);
    storage.set("og_active_frame", activeFrame);
    storage.set("og_unit_lineups", JSON.stringify(unitLineups));
    storage.set("og_unit_skins", JSON.stringify(unitSkins));
    storage.set("og_unit_effects", JSON.stringify(unitEffects));
    storage.set("og_daily_login", JSON.stringify(dailyLogin));
    storage.set("og_activity", JSON.stringify(activity));
    storage.set("og_codex_owned", JSON.stringify(codexOwned));
  }

  function activityMeta() {
    return { totalMinutes: Math.max(0, Number(activity.totalMinutes) || 0), games: activity.games || {}, lastGame: activity.lastGame || "" };
  }

  function recordActivity(gameName, startedAt) {
    const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 60000));
    activity.totalMinutes = (Number(activity.totalMinutes) || 0) + elapsed;
    activity.games[gameName] = (Number(activity.games[gameName]) || 0) + 1;
    activity.lastGame = new Date().toISOString();
    saveMeta();
    const cloud = window.XenaCloudSync;
    if (cloud && cloud.snapshot().user) cloud.save(backupCode(), { profile: { nickname: profile.nickname, createdAt: profile.createdAt }, activity: activityMeta() }).catch(() => {});
  }

  function t(key) {
    return I18N[language][key] || I18N.ko[key] || key;
  }

  function skillText(key, index) {
    return skillNames[key][language][index];
  }

  function modeText(id, index) {
    return t(id)[index];
  }

  function roleInfo(type) {
    return language === "en" ? ROLE_INFO_EN[type] : ROLE_INFO[type];
  }

  function roleLabel(type) {
    return language === "en" ? ROLE_LABEL_EN[type] : ROLE_LABEL[type];
  }

  function brandMarkup() {
    return `<div class="brand">XENA: <b>OVERRIDE GRID</b><span class="prototype-badge">WEB PROTOTYPE</span></div>`;
  }

  function wallet() {
    const creditLabel = language === "en" ? "Signal" : "시그널";
    const shardLabel = language === "en" ? "Anomaly Shards" : "변칙 파편";
    const cloudUser = window.XenaCloudSync && window.XenaCloudSync.snapshot().user;
    const saveLabel = cloudUser ? "CLOUD LINKED" : storage.available ? "DEVICE SAVE" : "TEMP SESSION";
    return `<div class="wallet"><span class="currency-pill"><img src="${assetSrc("ui", "currency_signal_credit_v1.png")}" alt="">${creditLabel} <strong>${credits.toLocaleString()}</strong></span><span class="currency-pill"><img src="${assetSrc("ui", "currency_anomaly_shard_v1.png")}" alt="">${shardLabel} <strong>${shards}</strong></span><span class="rank-pill">${rankLabel()} <strong>${gridRating} GR</strong></span><button class="wallet-store profile-button" data-open-account>${profile.nickname}<small>${saveLabel}</small></button><button class="wallet-store" data-toggle-audio>${audioEnabled ? "SOUND ON" : "SOUND OFF"}</button><button class="wallet-store" data-open-language>${t("language")}</button><button class="wallet-store" data-open-codex>도감</button><button class="wallet-store" data-open-units>${language === "en" ? "MY UNITS" : "내 유닛"}</button><button class="wallet-store" data-open-store>${t("store")}</button></div>`;
  }

  function encodeBackup(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function decodeBackup(value) {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function backupCode() {
    return encodeBackup({
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      data: { committedStarter, owned, credits, shards, timeRule, gameMode, language, aiDifficulty, eventClaims, gridRating, cosmeticOwned, activeBoard, activeArena, activeFrame, unitLineups, unitSkins, unitEffects, dailyLogin, codexOwned },
    });
  }

  function refreshCurrentScreen() {
    if (screen === "store") renderStore();
    else if (screen === "codex") renderCodex();
    else if (screen === "units") renderMyUnits();
    else if (screen === "online") renderOnlineLobby();
    else if (screen === "game") renderGame();
    else renderSetup();
  }

  function restoreBackup(value) {
    const payload = decodeBackup(value);
    if (!payload || payload.version !== 1 || !payload.data) throw new Error("UNSUPPORTED_SAVE");
    const data = payload.data;
    const restoredProfile = payload.profile || {};
    profile = {
      id: String(restoredProfile.id || profile.id).replace(/[^A-Z0-9-]/gi, "").slice(0, 24) || profile.id,
      nickname: String(restoredProfile.nickname || profile.nickname).replace(/[^A-Z0-9-]/gi, "").slice(0, 20) || profile.nickname,
      createdAt: restoredProfile.createdAt || profile.createdAt,
    };
    committedStarter = ["xena", "sovran"].includes(data.committedStarter) ? data.committedStarter : null;
    chosen = committedStarter || "xena";
    owned = Array.isArray(data.owned) ? [...new Set(data.owned.filter((id) => ["xena", "sovran"].includes(id)))] : [];
    credits = Math.max(0, Number(data.credits) || 0);
    shards = Math.max(0, Number(data.shards) || 0);
    timeRule = TIME_RULES[data.timeRule] ? data.timeRule : "beginner";
    gameMode = MODES[data.gameMode] ? data.gameMode : "ai";
    language = data.language === "en" ? "en" : "ko";
    aiDifficulty = DIFFICULTIES[data.aiDifficulty] ? data.aiDifficulty : "normal";
    eventClaims = data.eventClaims && typeof data.eventClaims === "object" ? data.eventClaims : {};
    gridRating = Math.max(0, Number(data.gridRating) || 0);
    cosmeticOwned = Array.isArray(data.cosmeticOwned) ? [...new Set(data.cosmeticOwned.filter((id) => SHOP_ITEMS.some((item) => item.id === id)))] : [];
    const restoredBoard = data.activeBoard || data.activeCosmetic || "";
    activeBoard = cosmeticOwned.includes(restoredBoard) && SHOP_ITEMS.some((item) => item.id === restoredBoard && item.kind === "board") ? restoredBoard : "";
    activeArena = cosmeticOwned.includes(data.activeArena) && SHOP_ITEMS.some((item) => item.id === data.activeArena && item.kind === "arena") ? data.activeArena : "";
    activeFrame = cosmeticOwned.includes(data.activeFrame) && SHOP_ITEMS.some((item) => item.id === data.activeFrame && item.kind === "frame") ? data.activeFrame : "";
    unitLineups = normalizedLineups(data.unitLineups);
    unitSkins = data.unitSkins && typeof data.unitSkins === "object" ? data.unitSkins : {};
    unitEffects = data.unitEffects && typeof data.unitEffects === "object" ? data.unitEffects : {};
    dailyLogin = data.dailyLogin && typeof data.dailyLogin === "object" ? data.dailyLogin : {};
    codexOwned = Array.isArray(data.codexOwned) ? [...new Set(data.codexOwned.filter((id) => CODEX_CARDS.some((card) => card.id === id)))] : [];
    saveMeta();
  }

  function escapeMarkup(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function cloudErrorLabel(code) {
    const messages = {
      LOGIN_CANCELLED: language === "en" ? "Sign-in was cancelled." : "로그인이 취소되었습니다.",
      POPUP_BLOCKED: language === "en" ? "Allow pop-ups and try again." : "팝업을 허용한 뒤 다시 시도해주세요.",
      UNAUTHORIZED_DOMAIN: language === "en" ? "This domain is not authorized yet." : "현재 도메인이 Firebase에 허용되지 않았습니다.",
      PERMISSION_DENIED: language === "en" ? "Cloud save permission was denied." : "클라우드 저장 권한이 거부되었습니다.",
      NETWORK_ERROR: language === "en" ? "Check your network connection." : "네트워크 연결을 확인해주세요.",
      CLOUD_ERROR: language === "en" ? "Cloud sync is temporarily unavailable." : "클라우드 동기화를 잠시 사용할 수 없습니다.",
    };
    return messages[code] || "";
  }

  function cloudAccountMarkup(cloud) {
    if (!cloud || !cloud.configured) {
      return `<div class="cloud-account disabled"><div><small>OPTIONAL CLOUD SAVE</small><b>${language === "en" ? "Cloud login is being prepared" : "클라우드 로그인 준비 중"}</b></div><p>${language === "en" ? "Guest play and device saves remain available without an account." : "로그인 없이도 게스트 플레이와 기기 저장을 계속 이용할 수 있습니다."}</p></div>`;
    }
    const busy = ["connecting", "signing-in", "loading", "saving"].includes(cloud.phase);
    const error = cloudErrorLabel(cloud.error);
    if (!cloud.user) {
      return `<div class="cloud-account"><div><small>OPTIONAL CLOUD SAVE</small><b>${busy ? (language === "en" ? "Connecting..." : "연결 중...") : (language === "en" ? "Continue across devices" : "다른 기기에서도 이어서 플레이")}</b></div><p>${language === "en" ? "Link a Google account to upload or restore this prototype save." : "Google 계정을 연결하면 이 체험판 저장을 업로드하거나 다른 기기에서 불러올 수 있습니다."}</p><button class="cloud-login" data-cloud-login ${busy ? "disabled" : ""}>G&nbsp; ${language === "en" ? "Sign in with Google" : "Google로 로그인"}</button>${error ? `<span class="cloud-error">${error}</span>` : ""}</div>`;
    }
    const identity = escapeMarkup(cloud.user.displayName || cloud.user.email || "Google Player");
    let syncText = language === "en" ? "Cloud save not checked" : "클라우드 저장 확인 전";
    if (cloud.remoteExists === false) syncText = language === "en" ? "No cloud save yet" : "아직 클라우드 저장 없음";
    if (cloud.remoteExists === true) {
      const date = cloud.lastSyncedAt ? new Date(cloud.lastSyncedAt) : null;
      const formatted = date && !Number.isNaN(date.getTime()) ? date.toLocaleString(language === "en" ? "en-US" : "ko-KR") : "";
      syncText = formatted ? `${language === "en" ? "Last saved" : "마지막 저장"} ${formatted}` : (language === "en" ? "Cloud save available" : "클라우드 저장 있음");
    }
    return `<div class="cloud-account connected"><div class="cloud-identity"><span class="cloud-avatar">G</span><div><small>GOOGLE CLOUD LINKED</small><b>${identity}</b><em>${syncText}</em></div></div><div class="cloud-actions"><button class="secondary" data-cloud-upload ${busy ? "disabled" : ""}>${cloud.phase === "saving" ? (language === "en" ? "Saving..." : "저장 중...") : (language === "en" ? "Upload this device" : "이 기기 저장 업로드")}</button><button class="primary" data-cloud-download ${busy ? "disabled" : ""}>${cloud.phase === "loading" ? (language === "en" ? "Loading..." : "불러오는 중...") : (language === "en" ? "Load cloud save" : "클라우드 저장 불러오기")}</button></div><button class="cloud-signout" data-cloud-signout ${busy ? "disabled" : ""}>${language === "en" ? "Sign out" : "로그아웃"}</button>${error ? `<span class="cloud-error">${error}</span>` : ""}</div>`;
  }

  function accountMarkup() {
    const localLabel = storage.available ? (language === "en" ? "Saved on this device" : "이 기기에 저장 중") : (language === "en" ? "Temporary session" : "임시 세션");
    const cloud = window.XenaCloudSync ? window.XenaCloudSync.snapshot() : null;
    return `<div class="account-overlay" data-close-account><section class="account-modal" role="dialog" aria-modal="true" aria-label="Prototype profile" data-account-panel><button class="showcase-close" data-close-account aria-label="닫기">×</button><small>WEB PROTOTYPE PROFILE</small><h2>${profile.nickname}</h2><div class="profile-id"><span>${localLabel}</span><b>${profile.id}</b></div><p>${language === "en" ? "Your current progress is saved in this browser. Keep the save code as a manual backup." : "현재 진행 기록은 이 브라우저에 저장됩니다. 아래 저장 코드는 수동 백업용으로 보관할 수 있습니다."}</p><div data-cloud-account>${cloudAccountMarkup(cloud)}</div><label>${language === "en" ? "MANUAL SAVE / RESTORE CODE" : "수동 저장·복구 코드"}<textarea data-account-code spellcheck="false"></textarea></label><div class="account-actions"><button class="secondary" data-copy-save>${language === "en" ? "Copy save code" : "저장 코드 복사"}</button><button class="primary" data-restore-save ${screen === "game" ? "disabled" : ""}>${language === "en" ? "Restore on this device" : "이 기기에 복구"}</button></div><span class="account-warning">${language === "en" ? "Prototype cloud sync is optional. Real-money payments and premium balances remain disabled." : "체험판 클라우드 동기화는 선택 사항입니다. 실제 결제와 유료 재화 연동은 비활성화 상태입니다."}</span></section></div>`;
  }

  function openAccount() {
    document.querySelector(".account-overlay")?.remove();
    document.body.insertAdjacentHTML("beforeend", accountMarkup());
    const overlay = document.querySelector(".account-overlay");
    const textarea = overlay.querySelector("[data-account-code]");
    textarea.value = backupCode();
    let unsubscribeCloud = () => {};
    const closeAccount = (refreshOnline = true) => {
      unsubscribeCloud();
      overlay.remove();
      if (refreshOnline && screen === "online") renderOnlineLobby();
    };
    overlay.querySelectorAll("[data-close-account]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || event.target.closest(".showcase-close")) closeAccount();
    }));
    overlay.querySelector("[data-copy-save]").addEventListener("click", async (event) => {
      textarea.select();
      try { await navigator.clipboard.writeText(textarea.value); }
      catch (_) { document.execCommand("copy"); }
      event.currentTarget.textContent = language === "en" ? "Copied" : "복사 완료";
    });
    const restore = overlay.querySelector("[data-restore-save]");
    if (restore) restore.addEventListener("click", () => {
      try {
        restoreBackup(textarea.value.trim());
        closeAccount(false);
        refreshCurrentScreen();
      } catch (_) {
        alert(language === "en" ? "This save code is invalid." : "저장 코드를 확인해주세요.");
      }
    });

    const cloud = window.XenaCloudSync;
    if (!cloud) return;
    const updateCloudPanel = (cloudState) => {
      const panel = overlay.querySelector("[data-cloud-account]");
      if (!panel) return;
      panel.innerHTML = cloudAccountMarkup(cloudState);
      const login = panel.querySelector("[data-cloud-login]");
      if (login) login.addEventListener("click", async () => {
        try {
          await cloud.signIn();
          const remote = await cloud.load();
          if (!remote) {
            await cloud.save(backupCode(), { profile: { nickname: profile.nickname, createdAt: profile.createdAt }, activity: activityMeta() });
            alert(language === "en" ? "This device save is now backed up to the cloud." : "이 기기의 저장 기록을 클라우드에 처음 백업했습니다.");
          } else if (screen !== "game" && confirm(language === "en" ? "A cloud save already exists. Load it on this device now?" : "기존 클라우드 저장이 있습니다. 지금 이 기기에 불러올까요?")) {
            restoreBackup(remote.saveCode);
            closeAccount(false);
            refreshCurrentScreen();
          }
        } catch (_) { /* The cloud panel shows a localized error. */ }
      });
      const upload = panel.querySelector("[data-cloud-upload]");
      if (upload) upload.addEventListener("click", async () => {
        if (cloudState.remoteExists && !confirm(language === "en" ? "Replace the cloud save with this device's progress?" : "클라우드 저장을 이 기기의 진행 기록으로 덮어쓸까요?")) return;
        try {
          await cloud.save(backupCode(), { profile: { nickname: profile.nickname, createdAt: profile.createdAt }, activity: activityMeta() });
          alert(language === "en" ? "Cloud save complete." : "클라우드 저장을 완료했습니다.");
        } catch (_) { /* The cloud panel shows a localized error. */ }
      });
      const download = panel.querySelector("[data-cloud-download]");
      if (download) download.addEventListener("click", async () => {
        if (screen === "game") return alert(language === "en" ? "Return to the lobby before loading a cloud save." : "클라우드 저장은 대전을 종료하고 로비에서 불러와주세요.");
        if (!confirm(language === "en" ? "Replace this device's progress with the cloud save?" : "이 기기의 진행 기록을 클라우드 저장으로 교체할까요?")) return;
        try {
          const remote = await cloud.load();
          if (!remote) return alert(language === "en" ? "No cloud save was found." : "불러올 클라우드 저장이 없습니다.");
          restoreBackup(remote.saveCode);
          closeAccount(false);
          refreshCurrentScreen();
        } catch (_) { /* The cloud panel shows a localized error. */ }
      });
      const signout = panel.querySelector("[data-cloud-signout]");
      if (signout) signout.addEventListener("click", async () => {
        try { await cloud.signOut(); } catch (_) { /* The cloud panel shows a localized error. */ }
      });
    };
    unsubscribeCloud = cloud.subscribe(updateCloudPanel);
    cloud.connect().catch(() => {});
  }

  function rankLabel() {
    if (gridRating >= 800) return "OVERRIDE";
    if (gridRating >= 450) return "REBEL";
    if (gridRating >= 200) return "LUCID";
    if (gridRating >= 80) return "SIGNAL";
    return "TRACE IV";
  }

  function todayKey() {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dailyEvent() {
    const key = todayKey();
    if (!eventClaims[key]) eventClaims = { [key]: { easy: false, normal: false, hard: false, bonus: false } };
    return eventClaims[key];
  }

  function hasDailyLogin() {
    return dailyLogin.date === todayKey();
  }

  function claimDailyLogin() {
    if (hasDailyLogin()) return;
    dailyLogin = { date: todayKey() };
    credits += 200;
    saveMeta();
    playSfx("reward", 0.48);
  }

  function bindStoreButton() {
    document.querySelectorAll("[data-toggle-audio]").forEach((button) => button.addEventListener("click", toggleAudio));
    document.querySelectorAll("[data-open-account]").forEach((button) => button.addEventListener("click", openAccount));
    document.querySelectorAll("[data-open-store]").forEach((button) => button.addEventListener("click", () => { playSfx("tab"); renderStore(); }));
    document.querySelectorAll("[data-open-codex]").forEach((button) => button.addEventListener("click", () => { playSfx("tab"); renderCodex(); }));
    document.querySelectorAll("[data-open-units]").forEach((button) => button.addEventListener("click", () => { playSfx("tab"); renderMyUnits(); }));
    document.querySelectorAll("[data-open-language]").forEach((languageButton) => languageButton.addEventListener("click", () => {
      playSfx("tab");
      language = language === "ko" ? "en" : "ko";
      saveMeta();
      if (screen === "store") renderStore();
      else if (screen === "codex") renderCodex();
      else if (screen === "units") renderMyUnits();
      else if (screen === "game") renderGame();
      else renderSetup();
    }));
  }

  function canControl(color) {
    const onlineReady = gameMode !== "online" || (window.OverrideGridOnline && window.OverrideGridOnline.snapshot().status === "active");
    return onlineReady && !replayMode && !thinking && !animating && (gameMode === "local" ? color === state.turn : color === playerColor);
  }

  function renderSetup() {
    screen = "setup";
    applyCosmeticTheme();
    const packPrice = (id) => PACK_PRICES[id] || 2400;
    const card = (id) => {
      const pack = G.PACKS[id];
      const isOwned = owned.includes(id);
      const isStarterAllowed = STARTER_PACKS.has(id);
      const cover = PACK_COVERS[id];
      const packLetter = id === "xena" ? "X" : id === "sovran" ? "S" : "C";
      return `<button class="pack ${id} ${chosen === id ? "selected" : ""}" data-pack="${id}">
        <small>${isOwned ? t("owned") : (!committedStarter && isStarterAllowed ? "FREE STARTER" : t("locked"))}</small><span class="pack-portrait"><img src="${cover ? assetSrc("ui", cover) : characterArtSrc(pack.back.leader)}" alt="${pack.leaderName}"><i>${packLetter}</i></span>
        <span class="pack-copy"><h2>${pack.leaderName}</h2><p>${pack.name}</p></span>
        ${isOwned ? "" : `<span class="lock">${!committedStarter && isStarterAllowed ? (language === "en" ? "First starter is free" : "첫 스타터 무료") : `${packPrice(id).toLocaleString()} ${language === "en" ? "Signal Credits" : "시그널 크레딧"}`}</span>`}
      </button>`;
    };
    const packIds = Object.keys(G.PACKS);
    const canStartSelected = owned.includes(chosen) || (!committedStarter && STARTER_PACKS.has(chosen));
    app.innerHTML = `<div class="shell"><header class="topbar">${brandMarkup()}${wallet()}</header>
      <section class="setup"><div class="demo-banner"><b>${language === "en" ? "FREE WEB PROTOTYPE" : "무료 웹 체험판"}</b><span>${language === "en" ? "AI, local and invite-code online matches are open. Payments remain disabled." : "AI·로컬·초대 코드 온라인 대전을 이용할 수 있습니다. 결제는 비활성화 상태입니다."}</span></div><h1>CHOOSE YOUR <span>FIRST SIGNAL</span></h1>
      <p class="lead">${language === "en" ? "Choose one starter pack. Every piece follows the same chess rules; each leader changes the skills and combat presentation." : "스타터 팩 하나를 선택하세요. 모든 말은 같은 체스 규칙을 따르며 리더의 기술과 전장 연출만 달라집니다."}</p>
      <div class="pack-grid">${packIds.map(card).join("")}</div>
      <div class="mode-control"><small>${t("mode")}</small><div class="mode-options">${Object.entries(MODES).map(([id]) => `<button class="mode-option ${gameMode === id ? "active" : ""}" data-mode="${id}"><b>${modeText(id, 0)}</b><span>${modeText(id, 1)}</span></button>`).join("")}</div></div>
      ${gameMode === "ai" ? `<div class="difficulty-control"><small>${t("difficulty")}</small><div class="mode-options">${Object.entries(DIFFICULTIES).map(([id, difficulty]) => `<button class="mode-option ${aiDifficulty === id ? "active" : ""}" data-difficulty="${id}"><b>${language === "en" ? ({ easy: "Easy", normal: "Normal", hard: "Hard" })[id] : difficulty.label}</b><span>${language === "en" ? ({ easy: "Basic board reading", normal: "Two-ply search", hard: "Three-ply search" })[id] : difficulty.description} · ${t("victory")} ${difficulty.credits}</span></button>`).join("")}</div></div>` : ""}
      ${gameMode === "event" ? eventMarkup() : ""}
      <div class="daily-login"><div><small>NEW YORK DAILY SIGNAL</small><b>${hasDailyLogin() ? t("dailyClaimed") : t("dailyReward")}</b><span>${t("dailyReset")}</span></div><button class="secondary" id="daily-login" ${hasDailyLogin() ? "disabled" : ""}>${hasDailyLogin() ? t("claimed") : t("claim")}</button></div>
      <div class="time-control"><small>${t("timePreview")}</small><div class="time-options">${Object.entries(TIME_RULES).map(([id, rule]) => `<button class="time-option ${timeRule === id ? "active" : ""}" data-time-rule="${id}"><b>${language === "en" ? rule.note.replace("초보", "Beginner").replace("표준", "Standard").replace("상위", "Advanced").replace("최상위", "Elite").replace("분", " min") : rule.note}</b><span>${rule.label}</span></button>`).join("")}</div></div>
      <div class="rank-status"><small>${t("rankReady")}</small><b>${rankLabel()} · ${gridRating} GR</b><span>${t("rankNote")}</span></div>
      <div class="actions"><button class="primary" id="start" ${canStartSelected ? "" : "disabled"}>${committedStarter ? `${modeText(gameMode, 0)} ${t("start")}` : t("starterStart")}</button>
      ${committedStarter && !owned.includes(chosen) ? `<button class="secondary" id="buy">${packPrice(chosen).toLocaleString()} ${language === "en" ? "Credits" : "크레딧"} ${t("buy")}</button>` : ""}
      ${new URLSearchParams(window.location.search).get("debug") === "1" ? `<button class="secondary" id="reset">${t("reset")}</button>` : ""}</div></section></div>`;
    app.querySelectorAll("[data-pack]").forEach((button) => button.addEventListener("click", () => { chosen = button.dataset.pack; renderSetup(); }));
    app.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { gameMode = button.dataset.mode; saveMeta(); renderSetup(); }));
    app.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { aiDifficulty = button.dataset.difficulty; saveMeta(); renderSetup(); }));
    app.querySelectorAll("[data-event-difficulty]").forEach((button) => button.addEventListener("click", () => { eventDifficulty = button.dataset.eventDifficulty; renderSetup(); }));
    app.querySelectorAll("[data-time-rule]").forEach((button) => button.addEventListener("click", () => { timeRule = button.dataset.timeRule; saveMeta(); renderSetup(); }));
    bindStoreButton();
    const dailyButton = document.getElementById("daily-login");
    if (dailyButton) dailyButton.addEventListener("click", () => { claimDailyLogin(); renderSetup(); });
    document.getElementById("start").addEventListener("click", startGame);
    const buy = document.getElementById("buy");
    if (buy) buy.addEventListener("click", () => {
      const price = packPrice(chosen);
      if (credits < price) return alert(`크레딧이 ${price - credits} 부족합니다.`);
      const pack = G.PACKS[chosen];
      if (!confirm(`${pack.leaderName} 팩을 ${price.toLocaleString()} 시그널 크레딧에 구매하시겠습니까?\n\n확인: 구매   취소: 돌아가기`)) return;
      credits -= price; owned.push(chosen); unitLineups = normalizedLineups(unitLineups); playSfx("purchase", 0.52); saveMeta(); renderSetup();
    });
    const reset = document.getElementById("reset");
    if (reset) reset.addEventListener("click", () => {
      ["og_starter", "og_owned", "og_credits", "og_shards", "og_event_claims", "og_grid_rating", "og_cosmetics", "og_active_cosmetic", "og_active_board", "og_active_arena", "og_active_frame", "og_unit_lineups", "og_unit_skins", "og_unit_effects", "og_daily_login", "og_codex_owned"].forEach((key) => storage.remove(key));
      committedStarter = null; chosen = "xena"; owned = []; credits = 0; shards = 0; eventClaims = {}; gridRating = 0; cosmeticOwned = []; activeBoard = ""; activeArena = ""; activeFrame = ""; unitLineups = normalizedLineups({}); unitSkins = {}; unitEffects = {}; dailyLogin = {}; codexOwned = []; showcase = null; saveMeta(); renderSetup();
    });
    syncBgm();
  }

  function eventMarkup() {
    const claimed = dailyEvent();
    const complete = claimed.easy && claimed.normal && claimed.hard;
    return `<div class="event-control"><div><small>${t("eventTitle")}</small><b>${language === "en" ? "Complete all 3 trials" : "3단계 완주"} ${complete ? t("complete") : t("inProgress")}</b></div><div class="event-options">${Object.entries(EVENT_REWARDS).map(([id, reward]) => `<button class="event-option ${eventDifficulty === id ? "active" : ""}" data-event-difficulty="${id}"><b>${language === "en" ? ({ easy: "Easy", normal: "Normal", hard: "Hard" })[id] : DIFFICULTIES[id].label}</b><span>${claimed[id] ? t("rewardsClaimed") : `${language === "en" ? "Credits" : "크레딧"} +${reward.credits} · ${language === "en" ? "Shards" : "파편"} +${reward.shards}`}</span></button>`).join("")}</div><span>${language === "en" ? "Complete all trials for +500 Credits · +3 Anomaly Shards" : "세 난이도를 모두 이기면 보너스 크레딧 +500 · 변칙 파편 +3"}</span></div>`;
  }

  function cosmeticPrice(item) {
    return item.credit ? `${language === "en" ? "Signal" : "시그널"} ${item.credit.toLocaleString()}` : `${language === "en" ? "Anomaly Shards" : "변칙 파편"} ${item.shards}`;
  }

  function shopDetails(item) {
    const legacy = SHOP_DETAILS[item.id] || {};
    return { role: item.role || legacy.role || item.kind, tier: item.tier || legacy.tier || "STANDARD", order: item.order || legacy.order || 0 };
  }

  function itemArtSrc(item) {
    if (item.character && PORTRAIT_ART[item.character]) return assetSrc("portrait", PORTRAIT_ART[item.character]);
    return assetSrc(item.artRoot || "card", item.art);
  }

  function fallbackAttr(root, fallbackArt) {
    return fallbackArt ? ` onerror="this.onerror=null;this.src='${assetSrc(root, fallbackArt)}'"` : "";
  }

  function shopArtSrc(item) {
    return itemArtSrc(item);
  }

  function applyCosmeticTheme() {
    document.body.dataset.cosmetic = activeBoard;
    document.body.dataset.arena = activeArena;
  }

  function unitForCharacter(character) {
    return CODEX_CARDS.find((card) => card.character === character);
  }

  function characterArtSrc(character) {
    const skinId = unitSkins[character];
    const skin = SHOP_ITEMS.find((item) => item.id === skinId && item.kind === "skin" && item.targetCharacter === character && cosmeticOwned.includes(item.id));
    if (skin) return itemArtSrc(skin);
    const unit = unitForCharacter(character);
    return unit ? itemArtSrc(unit) : CARD_ART_ROOT + (CARD_ART[character] || CARD_ART.XENA);
  }

  function portraitCropFor(character) {
    const skinId = unitSkins[character];
    const skin = SHOP_ITEMS.find((item) => item.id === skinId && item.kind === "skin" && item.targetCharacter === character && cosmeticOwned.includes(item.id));
    if (skin && (skin.artRoot === "portrait" || skin.artRoot === "skin")) return { scale: 1.04, shift: "0%" };
    if (PORTRAIT_ART[character]) return { scale: 1.04, shift: "0%" };
    return PORTRAIT_CROP[character] || { scale: 2.85, shift: "0%" };
  }

  function unitPortraitMarkup(character, className) {
    const crop = portraitCropFor(character);
    return `<span class="unit-portrait ${className || ""}" style="--face-scale:${crop.scale};--face-shift:${crop.shift}"><img src="${characterArtSrc(character)}" alt="${character}"></span>`;
  }

  function storeItemActive(item) {
    if (item.kind === "board") return activeBoard === item.id;
    if (item.kind === "arena") return activeArena === item.id;
    if (item.kind === "frame") return activeFrame === item.id;
    if (item.kind === "skin") return Object.values(unitSkins).includes(item.id);
    if (item.kind === "effect") return Object.values(unitEffects).some((setting) => setting && setting.id === item.id && setting.enabled !== false);
    return false;
  }

  function buyCosmetic(id) {
    const item = SHOP_ITEMS.find((entry) => entry.id === id);
    if (!item || cosmeticOwned.includes(id)) return;
    if (item.credit && credits < item.credit) return alert(`시그널 크레딧이 ${item.credit - credits} 부족합니다.`);
    if (item.shards && shards < item.shards) return alert(`변칙 파편이 ${item.shards - shards} 부족합니다.`);
    if (item.credit) credits -= item.credit;
    if (item.shards) shards -= item.shards;
    cosmeticOwned.push(id);
    playSfx("purchase", 0.52);
    saveMeta();
    renderStore();
  }

  function startCheckout(productId) {
    const checkoutUrl = window.XenaCheckoutUrls && window.XenaCheckoutUrls[productId];
    if (checkoutUrl) window.location.assign(checkoutUrl);
    else alert("결제 연결 준비 중입니다. 운영 서버에 Stripe Checkout URL과 웹훅 장부를 연결하면 이 상품이 즉시 활성화됩니다.");
  }

  function ownsCodexCard(card) {
    return codexOwned.includes(card.id) || Boolean(card.pack && owned.includes(card.pack));
  }

  function buyCodexCard(id) {
    const card = CODEX_CARDS.find((entry) => entry.id === id);
    if (!card || ownsCodexCard(card)) return;
    if (credits < card.credit) return alert(`시그널이 ${card.credit - credits} 부족합니다.`);
    credits -= card.credit;
    codexOwned.push(card.id);
    showcase = null;
    playSfx("purchase", 0.52);
    saveMeta();
    renderCodex();
  }

  function showcaseMarkup(item, source) {
    const isCodex = source === "codex";
    const ownedItem = isCodex ? ownsCodexCard(item) : cosmeticOwned.includes(item.id);
    const price = isCodex ? `시그널 ${item.credit.toLocaleString()}` : cosmeticPrice(item);
    const details = isCodex ? null : shopDetails(item);
    const description = isCodex ? `${item.faction} · ${roleLabel(item.role)} · ${item.rarity}` : `${details.role} · ${details.tier} · ${item.description}`;
    let action;
    if (isCodex) action = ownedItem ? `<button class="secondary" data-go-my-units>내 유닛에서 장착</button>` : `<button class="primary" data-modal-buy-card="${item.id}">${price}로 해금</button>`;
    else if (!ownedItem) action = `<button class="primary" data-modal-buy-cosmetic="${item.id}">${t("purchase")} · ${price}</button>`;
    else if (["board", "arena", "frame", "skin", "effect"].includes(item.kind)) action = `<button class="secondary" data-go-my-units>내 유닛에서 장착</button>`;
    else action = `<span class="showcase-owned">보유 중 · 자동 활성화</span>`;
    return `<div class="showcase-overlay" data-close-showcase><section class="showcase-modal kind-${item.kind || "unit"}" role="dialog" aria-modal="true" aria-label="${item.name}" data-showcase-panel><button class="showcase-close" data-close-showcase aria-label="닫기">×</button><div class="showcase-radiance"></div><div class="showcase-art"><img src="${itemArtSrc(item)}"${fallbackAttr(item.artRoot || "card", item.fallbackArt)} alt="${item.name}"></div><div class="showcase-copy"><small>${isCodex ? "SIGNAL ARCHIVE" : `${details.role} · ${details.tier}`}</small><h2>${item.name}</h2><p>${description}</p><b>${ownedItem ? "OWNED" : price}</b><div class="showcase-action">${action}</div></div></section></div>`;
  }

  function renderStore() {
    clearInterval(timer); screen = "store"; applyCosmeticTheme();
    const cosmeticCard = (item) => {
      const ownedItem = cosmeticOwned.includes(item.id);
      const selected = storeItemActive(item);
      const details = shopDetails(item);
      const ownedAction = item.kind === "board" || item.kind === "arena" || item.kind === "frame"
        ? `<button class="secondary" data-go-my-units>${language === "en" ? "EQUIP IN MY UNITS" : "내 유닛에서 장착"}</button>`
        : item.kind === "skin" || item.kind === "effect"
          ? `<button class="secondary" data-go-my-units>${language === "en" ? "SET IN MY UNITS" : "내 유닛에서 설정"}</button>`
          : `<button class="secondary" disabled>${language === "en" ? "ACTIVE" : "자동 활성화"}</button>`;
      return `<article class="shop-card kind-${item.kind} ${ownedItem ? "owned" : ""} ${selected ? "equipped" : ""}"><button class="shop-visual" data-preview-shop="${item.id}" aria-label="${item.name} 자세히 보기"><img class="shop-art" src="${shopArtSrc(item)}"${fallbackAttr(item.artRoot || "card", item.fallbackArt)} alt="${item.name}" loading="lazy" decoding="async"><span>VIEW</span>${ownedItem ? `<b class="owned-ribbon">${language === "en" ? "OWNED" : "보유 중"}</b>` : ""}</button><div class="shop-copy"><small>${details.role} · ${details.tier}</small><h2>${item.name}</h2><p>${item.description}</p><b>${ownedItem ? (language === "en" ? "OWNED" : "보유 중") : cosmeticPrice(item)}</b><div class="shop-card-actions">${ownedItem ? ownedAction : `<button class="primary" data-buy-cosmetic="${item.id}">${t("purchase")}</button>`}</div></div></article>`;
    };
    const paymentCard = (item) => `<article class="shop-card payment-card coming-soon"><small>ANOMALY SHARD · COMING SOON</small><h2>${item.name}</h2><p>${language === "en" ? "Secure account ledger and checkout are in preparation" : "계정 장부와 안전 결제 연동을 준비 중입니다"}</p><b>${item.price}</b><div class="shop-card-actions"><button class="primary" disabled>${language === "en" ? "PAYMENT IN PREPARATION" : "결제 준비 중"}</button></div></article>`;
    const section = (title, note, items) => `<section class="store-section"><div class="section-title"><h2>${title}</h2><span>${note}</span></div><div class="shop-grid">${items.map(cosmeticCard).join("")}</div></section>`;
    app.innerHTML = `<div class="shell store-shell"><header class="topbar">${brandMarkup()}${wallet()}</header><section class="store-page"><div class="store-heading"><div><small>COSMETIC ARMORY · WEB PROTOTYPE</small><h1>OVERRIDE <span>STORE</span></h1><p>전투 캐릭터는 도감에서 해금합니다. 상점에서는 코스메틱을 구매하고, 장착과 변경은 내 유닛에서 진행합니다.</p></div><button class="secondary" id="back-to-setup">${t("play")}</button></div><div class="store-guide"><b>도감</b><span>새 캐릭터 해금</span><b>상점</b><span>외형과 연출 구매</span><b>내 유닛</b><span>전장·공간·테두리·스킨·이펙트 장착</span></div>${section("캐릭터 스킨", "같은 캐릭터의 의상과 초상을 변경합니다.", SHOP_ITEMS.filter((item) => item.kind === "skin"))}${section("공격 이펙트", "보유 후 내 유닛에서 캐릭터별로 적용하거나 끌 수 있습니다.", SHOP_ITEMS.filter((item) => item.kind === "effect"))}${section("전장", "구매 후 내 유닛의 전장 설정에서 장착합니다.", SHOP_ITEMS.filter((item) => item.kind === "board"))}${section("게임 공간 스킨", "전투 중 좌우 패널과 배경 분위기를 변경합니다.", SHOP_ITEMS.filter((item) => item.kind === "arena"))}${section("말 테두리", "아군 말 전체에 적용할 테두리를 구매합니다.", SHOP_ITEMS.filter((item) => item.kind === "frame"))}${section("캐릭터 이모트", "제나 리액션 이미지 교체 후 판매할 소셜 표현 팩입니다.", SHOP_ITEMS.filter((item) => item.kind === "emote"))}<section class="store-section"><div class="section-title"><h2>${t("shardStore")}</h2><span>상품 미리보기 · 안전 결제는 준비 중</span></div><div class="shop-grid payment-grid">${PAYMENT_PRODUCTS.map(paymentCard).join("")}</div></section><p class="store-notice">${t("paymentNotice")}</p></section></div>`;
    if (showcase && showcase.source === "store") {
      const item = SHOP_ITEMS.find((entry) => entry.id === showcase.id);
      if (item) app.insertAdjacentHTML("beforeend", showcaseMarkup(item, "store"));
    }
    bindStoreButton();
    const effectHeader = app.querySelector(".effect-toggle")?.parentElement;
    if (effectHeader && !effectHeader.querySelector("[data-equip-all-effects]")) {
      effectHeader.insertAdjacentHTML("beforeend", `<button class="secondary effect-equip-all" data-equip-all-effects>전체 착용</button>`);
    }
    document.getElementById("back-to-setup").addEventListener("click", () => { screen = "setup"; renderSetup(); });
    app.querySelectorAll("[data-buy-cosmetic]").forEach((button) => button.addEventListener("click", () => buyCosmetic(button.dataset.buyCosmetic)));
    app.querySelectorAll("[data-go-my-units]").forEach((button) => button.addEventListener("click", () => { showcase = null; renderMyUnits(); }));
    app.querySelectorAll("[data-preview-shop]").forEach((button) => button.addEventListener("click", () => { showcase = { source: "store", id: button.dataset.previewShop }; renderStore(); }));
    app.querySelectorAll("[data-close-showcase]").forEach((element) => element.addEventListener("click", (event) => { if (event.target === element || event.target.closest("[data-close-showcase]")) { showcase = null; renderStore(); } }));
    app.querySelectorAll("[data-modal-buy-cosmetic]").forEach((button) => button.addEventListener("click", () => buyCosmetic(button.dataset.modalBuyCosmetic)));
    syncBgm();
  }

  function renderCodex() {
    clearInterval(timer); screen = "codex"; applyCosmeticTheme();
    const unlocked = CODEX_CARDS.filter(ownsCodexCard).length;
    const entry = (card) => {
      const isOwned = ownsCodexCard(card);
      return `<button class="codex-entry ${isOwned ? "owned" : "locked"}" data-preview-codex="${card.id}"><span class="codex-art"><img src="${itemArtSrc(card)}" alt="${card.name}" loading="lazy" decoding="async"></span><span class="codex-meta"><small>${card.faction} · ${card.rarity}</small><b>${card.name}</b><em>${roleLabel(card.role)}</em><span>${isOwned ? "보유 중" : `시그널 ${card.credit.toLocaleString()}`}</span></span></button>`;
    };
    const factionGroup = (packId, title) => `<section class="codex-faction"><div class="section-title"><h2>${title}</h2><span>${owned.includes(packId) ? "팩 보유 · 12명 자동 해금" : "미보유 캐릭터는 개별 해금 가능"}</span></div><div class="codex-grid">${CODEX_CARDS.filter((card) => card.pack === packId).map(entry).join("")}</div></section>`;
    app.innerHTML = `<div class="shell codex-shell"><header class="topbar">${brandMarkup()}${wallet()}</header><section class="codex-page"><div class="store-heading"><div><small>ALL CHARACTER ARCHIVE · WEB PROTOTYPE</small><h1>UNIT <span>CODEX</span></h1><p>현재 게임의 모든 캐릭터를 확인하고 해금하는 곳입니다. 보유 캐릭터는 컬러, 미보유 캐릭터는 무채색으로 표시됩니다.</p></div><div class="header-actions"><button class="primary" data-open-units>내 유닛</button><button class="secondary" id="back-to-setup">${t("play")}</button></div></div><div class="codex-progress"><span>전체 캐릭터 컬렉션</span><b>${unlocked} / ${CODEX_CARDS.length} 보유</b></div>${factionGroup("xena", "XENA · REBEL MEMORY")}${factionGroup("sovran", "SOVRAN · SYSTEM DOMINION")}${factionGroup("crystal", "STAY BRIGHT · CRYSTAL REBELLION")}</section></div>`;
    if (showcase && showcase.source === "codex") {
      const card = CODEX_CARDS.find((entry) => entry.id === showcase.id);
      if (card) app.insertAdjacentHTML("beforeend", showcaseMarkup(card, "codex"));
    }
    bindStoreButton();
    document.getElementById("back-to-setup").addEventListener("click", () => { showcase = null; screen = "setup"; renderSetup(); });
    app.querySelectorAll("[data-preview-codex]").forEach((button) => button.addEventListener("click", () => { showcase = { source: "codex", id: button.dataset.previewCodex }; renderCodex(); }));
    app.querySelectorAll("[data-close-showcase]").forEach((element) => element.addEventListener("click", (event) => { if (event.target === element || event.target.closest("[data-close-showcase]")) { showcase = null; renderCodex(); } }));
    app.querySelectorAll("[data-modal-buy-card]").forEach((button) => button.addEventListener("click", () => buyCodexCard(button.dataset.modalBuyCard)));
    app.querySelectorAll("[data-go-my-units]").forEach((button) => button.addEventListener("click", () => { showcase = null; renderMyUnits(); }));
    syncBgm();
  }

  function renderMyUnits() {
    clearInterval(timer); screen = "units"; showcase = null; applyCosmeticTheme();
    if (!committedStarter && !owned.length) {
      app.innerHTML = `<div class="shell units-shell"><header class="topbar">${brandMarkup()}${wallet()}</header><section class="units-page"><div class="store-heading"><div><small>MY GRID · LOADOUT</small><h1>내 <span>유닛</span></h1><p>보유 캐릭터를 같은 직업 슬롯에 장착하고, 캐릭터별 스킨과 공격 이펙트를 설정합니다.</p></div><div class="header-actions"><button class="secondary" data-open-codex>도감</button><button class="secondary" data-open-store>상점</button><button class="secondary" id="back-to-setup">${t("play")}</button></div></div><section class="loadout-empty"><small>STARTER REQUIRED</small><h2>스타터 팩을 먼저 확정해 주세요</h2><p>첫 대전을 시작하면 선택한 진영의 12명이 자동으로 해금됩니다. 이후 이곳에서 같은 직업의 보유 캐릭터를 교체하고 스킨과 공격 이펙트를 설정할 수 있습니다.</p><button class="primary" id="choose-starter">스타터 선택으로 이동</button></section></section></div>`;
      bindStoreButton();
      app.querySelectorAll("#back-to-setup, #choose-starter").forEach((button) => button.addEventListener("click", () => { screen = "setup"; renderSetup(); }));
      syncBgm();
      return;
    }
    const availablePacks = owned.length ? owned : [chosen];
    if (!availablePacks.includes(lineupPack)) lineupPack = availablePacks[0];
    if (!selectedUnitSlot) selectedUnitSlot = "leader";
    const slot = FORMATION_SLOTS.find((entry) => entry.key === selectedUnitSlot) || FORMATION_SLOTS[3];
    const selectedCharacter = unitLineups[lineupPack][slot.key];
    const selectedUnit = unitForCharacter(selectedCharacter);
    const deployedElsewhere = new Set(Object.entries(unitLineups[lineupPack]).filter(([key]) => key !== slot.key).map(([, character]) => character));
    const candidates = CODEX_CARDS.filter((card) => card.role === slot.role && ownsCodexCard(card) && !deployedElsewhere.has(card.character));
    const skinItems = SHOP_ITEMS.filter((item) => item.kind === "skin" && item.targetCharacter === selectedCharacter);
    const effectItems = SHOP_ITEMS.filter((item) => item.kind === "effect");
    const boardItems = SHOP_ITEMS.filter((item) => item.kind === "board");
    const arenaItems = SHOP_ITEMS.filter((item) => item.kind === "arena");
    const frameItems = SHOP_ITEMS.filter((item) => item.kind === "frame");
    const effectSetting = unitEffects[selectedCharacter] || { id: "", enabled: false };
    const slotCard = (entry) => {
      const character = unitLineups[lineupPack][entry.key];
      const unit = unitForCharacter(character);
      return `<button class="formation-slot ${entry.key === slot.key ? "selected" : ""}" data-unit-slot="${entry.key}">${unitPortraitMarkup(character)}<span><small>${entry.label}</small><b>${unit ? unit.name : character}</b></span></button>`;
    };
    const choiceCard = (unit) => `<button class="unit-choice ${unit.character === selectedCharacter ? "selected" : ""}" data-equip-character="${unit.character}">${unitPortraitMarkup(unit.character)}<span><b>${unit.name}</b><small>${unit.faction}</small></span></button>`;
    const skinChoice = (item) => `<button class="appearance-choice ${unitSkins[selectedCharacter] === item.id ? "selected" : ""} ${cosmeticOwned.includes(item.id) ? "" : "locked"}" ${cosmeticOwned.includes(item.id) ? `data-apply-skin="${item.id}"` : "disabled"}><img src="${itemArtSrc(item)}" alt="${item.name}" loading="lazy" decoding="async"><span><b>${item.name}</b><small>${cosmeticOwned.includes(item.id) ? "보유" : "상점에서 구매"}</small></span></button>`;
    const effectChoice = (item) => `<button class="appearance-choice ${effectSetting.id === item.id ? "selected" : ""} ${cosmeticOwned.includes(item.id) ? "" : "locked"}" ${cosmeticOwned.includes(item.id) ? `data-apply-effect="${item.id}"` : "disabled"}><img src="${itemArtSrc(item)}" alt="${item.name}" loading="lazy" decoding="async"><span><b>${item.name}</b><small>${cosmeticOwned.includes(item.id) ? "보유" : "상점에서 구매"}</small></span></button>`;
    const boardChoice = (item) => `<button class="global-cosmetic-choice ${activeBoard === item.id ? "selected" : ""} ${cosmeticOwned.includes(item.id) ? "" : "locked"}" ${cosmeticOwned.includes(item.id) ? `data-apply-board="${item.id}"` : "disabled"}><img src="${itemArtSrc(item)}" alt="${item.name}" loading="lazy" decoding="async"><span><b>${item.name}</b><small>${cosmeticOwned.includes(item.id) ? "보유" : "상점에서 구매"}</small></span></button>`;
    const frameChoice = (item) => `<button class="global-cosmetic-choice frame-choice ${activeFrame === item.id ? "selected" : ""} ${cosmeticOwned.includes(item.id) ? "" : "locked"}" ${cosmeticOwned.includes(item.id) ? `data-apply-frame="${item.id}"` : "disabled"}><span class="frame-sample frame-${item.frameStyle}"><img src="${itemArtSrc(item)}" alt=""></span><span><b>${item.name}</b><small>${cosmeticOwned.includes(item.id) ? "보유" : "상점에서 구매"}</small></span></button>`;
    app.innerHTML = `<div class="shell units-shell"><header class="topbar">${brandMarkup()}${wallet()}</header><section class="units-page"><div class="store-heading"><div><small>MY GRID · LOADOUT</small><h1>내 <span>유닛</span></h1><p>보유 캐릭터를 편성하고, 전장·말 테두리·스킨·공격 이펙트를 장착합니다.</p></div><div class="header-actions"><button class="secondary" data-open-codex>도감</button><button class="secondary" data-open-store>상점</button><button class="secondary" id="back-to-setup">${t("play")}</button></div></div><div class="loadout-pack-tabs">${availablePacks.map((packId) => `<button class="${lineupPack === packId ? "active" : ""}" data-lineup-pack="${packId}">${G.PACKS[packId].leaderName} · ${G.PACKS[packId].name}</button>`).join("")}</div><section class="global-loadout"><div class="global-loadout-block"><div class="section-title"><h2>전장 장착</h2><span>상점에서 구매한 전장을 여기서 변경</span></div><div class="global-cosmetic-grid"><button class="global-cosmetic-choice ${activeBoard ? "" : "selected"}" data-apply-board=""><span class="default-cosmetic">GRID</span><span><b>기본 전장</b><small>보유</small></span></button>${boardItems.map(boardChoice).join("")}</div></div><div class="global-loadout-block"><div class="section-title"><h2>아군 말 테두리</h2><span>능력치 변화 없는 계정 공용 외형</span></div><div class="global-cosmetic-grid"><button class="global-cosmetic-choice ${activeFrame ? "" : "selected"}" data-apply-frame=""><span class="default-cosmetic">BASE</span><span><b>기본 진영 테두리</b><small>보유</small></span></button>${frameItems.map(frameChoice).join("")}</div></div></section><div class="units-layout"><section><div class="section-title"><h2>12 UNIT FORMATION</h2><span>리더 캐릭터를 바꾸면 해당 리더의 기술도 함께 변경</span></div><div class="formation-grid">${FORMATION_SLOTS.map(slotCard).join("")}</div></section><aside class="unit-config"><div class="selected-unit-hero">${unitPortraitMarkup(selectedCharacter, "hero-portrait")}<div><small>${slot.label}</small><h2>${selectedUnit ? selectedUnit.name : selectedCharacter}</h2><span>${selectedUnit ? selectedUnit.faction : ""}</span></div></div><div class="config-block"><div class="section-title"><h3>캐릭터 교체</h3><span>같은 직업 중 현재 편성되지 않은 보유 캐릭터만 표시</span></div><div class="unit-choice-grid">${candidates.map(choiceCard).join("")}</div></div><div class="config-block"><div class="section-title"><h3>스킨</h3><span>상점에서 구매한 전용 외형</span></div><div class="appearance-grid"><button class="appearance-choice ${unitSkins[selectedCharacter] ? "" : "selected"}" data-apply-skin=""><span><b>기본 외형</b><small>보유</small></span></button>${skinItems.map(skinChoice).join("")}</div></div><div class="config-block"><div class="section-title"><h3>공격 이펙트</h3><label class="effect-toggle"><input type="checkbox" data-toggle-effect ${effectSetting.id && effectSetting.enabled !== false ? "checked" : ""} ${effectSetting.id ? "" : "disabled"}><span>효과 ${effectSetting.enabled !== false && effectSetting.id ? "ON" : "OFF"}</span></label></div><div class="appearance-grid"><button class="appearance-choice ${effectSetting.id ? "" : "selected"}" data-apply-effect=""><span><b>캐릭터 기본 효과</b><small>기본</small></span></button>${effectItems.map(effectChoice).join("")}</div></div></aside></div></section></div>`;
    const globalLoadout = app.querySelector(".global-loadout");
    if (globalLoadout) globalLoadout.insertAdjacentHTML("beforeend", `<div class="global-loadout-block"><div class="section-title"><h2>게임 공간 스킨</h2><span>좌우 패널과 전투 배경을 함께 변경</span></div><div class="global-cosmetic-grid">${arenaItems.map((item) => `<button class="global-cosmetic-choice ${activeArena === item.id ? "selected" : ""} ${cosmeticOwned.includes(item.id) ? "" : "locked"}" ${cosmeticOwned.includes(item.id) ? `data-apply-arena="${item.id}"` : "disabled"}><img src="${itemArtSrc(item)}" alt="${item.name}"><span><b>${item.name}</b><small>${cosmeticOwned.includes(item.id) ? "보유" : "상점에서 구매"}</small></span></button>`).join("")}</div></div>`);
    bindStoreButton();
    document.getElementById("back-to-setup").addEventListener("click", () => { screen = "setup"; renderSetup(); });
    app.querySelectorAll("[data-lineup-pack]").forEach((button) => button.addEventListener("click", () => { lineupPack = button.dataset.lineupPack; selectedUnitSlot = "leader"; renderMyUnits(); }));
    app.querySelectorAll("[data-unit-slot]").forEach((button) => button.addEventListener("click", () => { selectedUnitSlot = button.dataset.unitSlot; renderMyUnits(); }));
    app.querySelectorAll("[data-equip-character]").forEach((button) => button.addEventListener("click", () => {
      const character = button.dataset.equipCharacter;
      const unit = unitForCharacter(character);
      const duplicate = Object.entries(unitLineups[lineupPack]).some(([key, deployed]) => key !== slot.key && deployed === character);
      if (!unit || unit.role !== slot.role || !ownsCodexCard(unit) || duplicate) return;
      unitLineups[lineupPack][slot.key] = character;
      playSfx("equip", 0.48);
      saveMeta();
      renderMyUnits();
    }));
    app.querySelectorAll("[data-apply-skin]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.applySkin; if (id) unitSkins[selectedCharacter] = id; else delete unitSkins[selectedCharacter]; playSfx("equip", 0.48); saveMeta(); renderMyUnits(); }));
    app.querySelectorAll("[data-apply-effect]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.applyEffect; if (id) unitEffects[selectedCharacter] = { id, enabled: true }; else delete unitEffects[selectedCharacter]; playSfx("equip", 0.48); saveMeta(); renderMyUnits(); }));
    app.querySelectorAll("[data-apply-board]").forEach((button) => button.addEventListener("click", () => { activeBoard = button.dataset.applyBoard; playSfx("equip", 0.48); saveMeta(); renderMyUnits(); }));
    app.querySelectorAll("[data-apply-arena]").forEach((button) => button.addEventListener("click", () => { activeArena = button.dataset.applyArena; playSfx("equip", 0.48); saveMeta(); applyCosmeticTheme(); renderMyUnits(); }));
    app.querySelectorAll("[data-apply-frame]").forEach((button) => button.addEventListener("click", () => { activeFrame = button.dataset.applyFrame; playSfx("equip", 0.48); saveMeta(); renderMyUnits(); }));
    const allEffects = app.querySelector("[data-equip-all-effects]");
    if (allEffects) allEffects.addEventListener("click", () => {
      const available = effectItems.filter((item) => cosmeticOwned.includes(item.id));
      if (!available.length) return;
      const characters = [...new Set(Object.values(unitLineups[lineupPack]))];
      characters.forEach((character, index) => { unitEffects[character] = { id: available[index % available.length].id, enabled: true }; });
      playSfx("equip", 0.5); saveMeta(); renderMyUnits();
    });
    const toggle = app.querySelector("[data-toggle-effect]");
    if (toggle) toggle.addEventListener("change", () => { if (unitEffects[selectedCharacter]) unitEffects[selectedCharacter].enabled = toggle.checked; saveMeta(); renderMyUnits(); });
    syncBgm();
  }

  function onlineErrorText(code) {
    const messages = {
      LOGIN_REQUIRED: language === "en" ? "Google sign-in is required." : "Google 로그인이 필요합니다.",
      ROOM_NOT_FOUND: language === "en" ? "Invite room not found." : "초대 방을 찾을 수 없습니다.",
      ROOM_FULL: language === "en" ? "This room already has two players." : "이미 두 명이 입장한 방입니다.",
      ROOM_FINISHED: language === "en" ? "This match has already ended." : "이미 종료된 대전입니다.",
      PERMISSION_DENIED: language === "en" ? "Room permission denied. Publish the latest Firestore rules." : "방 접근 권한이 거부되었습니다. 최신 Firestore 규칙을 게시해주세요.",
      NETWORK_ERROR: language === "en" ? "Check your network connection." : "네트워크 연결을 확인해주세요.",
      CLOUD_NOT_CONFIGURED: language === "en" ? "Firebase is not configured." : "Firebase 설정이 연결되지 않았습니다.",
      REVISION_CONFLICT: language === "en" ? "The room changed. Reloading the latest turn." : "방 상태가 변경되어 최신 수를 다시 불러옵니다.",
      NOT_YOUR_TURN: language === "en" ? "Wait for your opponent's move." : "상대의 수를 기다려주세요.",
      ONLINE_ERROR: language === "en" ? "Online pilot is temporarily unavailable." : "온라인 체험판을 잠시 사용할 수 없습니다.",
    };
    return messages[code] || code || (language === "en" ? "Ready" : "준비 완료");
  }

  function ensureOnlineConnection() {
    const client = window.OverrideGridOnline;
    if (!client) return;
    if (!onlineUiUnsubscribe && !onlineBinding) {
      onlineBinding = true;
      onlineUiUnsubscribe = client.subscribe(handleOnlineSnapshot);
      onlineBinding = false;
    }
    const current = client.snapshot();
    if (!onlineConnecting && current.status === "offline") {
      onlineConnecting = true;
      client.connect().catch(() => {}).finally(() => {
        onlineConnecting = false;
        if (screen === "online") renderOnlineLobby();
      });
    }
  }

  function handleOnlineSnapshot(online) {
    if (screen === "online" && online.room && (online.room.status === "active" || online.room.status === "finished") && online.color) {
      startOnlineGame(online);
      return;
    }
    if (screen === "game" && gameMode === "online") {
      syncOnlineGame(online);
      return;
    }
    if (screen === "online" && !onlineBinding) renderOnlineLobby();
  }

  function onlineInitialState() {
    const enemy = chosen === "xena" ? "sovran" : "xena";
    const initial = G.createInitialState({ whitePack: chosen, blackPack: enemy });
    applyLineupToState(initial, "white", chosen);
    return initial;
  }

  function renderOnlineLobby() {
    clearInterval(timer); screen = "online"; applyCosmeticTheme();
    const client = window.OverrideGridOnline;
    const online = client ? client.snapshot() : { status: "offline", lastError: "ONLINE_ERROR" };
    const cloud = window.XenaCloudSync;
    const cloudState = cloud ? cloud.snapshot() : null;
    const cloudUser = cloudState && cloudState.user;
    const connected = Boolean(cloudUser && ["connected", "waiting", "active", "finished"].includes(online.status));
    const loginBusy = Boolean(cloudState && ["connecting", "signing-in"].includes(cloudState.phase));
    const statusText = online.status === "waiting" ? "WAITING FOR OPPONENT" : online.status === "active" ? "MATCH LINKED" : connected ? "CONNECTED" : online.status === "connecting" ? "CONNECTING" : online.status === "auth-required" ? "LOGIN REQUIRED" : t("serverOffline");
    const statusDetail = !cloudUser && cloudState && cloudState.error ? cloudErrorLabel(cloudState.error) : onlineErrorText(online.lastError);
    let controls = "";
    if (!cloudUser) {
      controls = `<div class="online-login-callout"><b>${loginBusy ? (language === "en" ? "Preparing secure login" : "보안 로그인을 준비하고 있습니다") : (language === "en" ? "Google sign-in is required" : "Google 로그인이 필요합니다")}</b><span>${language === "en" ? "Your account identifies your seat and reconnects the match on another device." : "계정으로 내 좌석을 구분하고 새로고침 후에도 대전에 재접속합니다."}</span><button class="primary" data-online-signin ${loginBusy || !cloudState?.configured ? "disabled" : ""}>G&nbsp; ${loginBusy ? (language === "en" ? "PREPARING..." : "준비 중...") : (language === "en" ? "SIGN IN AND PLAY" : "로그인하고 대전하기")}</button></div>`;
    } else if (online.room && online.room.status === "waiting") {
      controls = `<div class="online-room-card"><small>INVITE CODE</small><button class="online-room-code" data-copy-room>${online.roomCode}</button><p>${language === "en" ? "Select the code to copy an invite link. The match starts when the opponent joins." : "코드를 누르면 초대 링크가 복사됩니다. 상대가 입장하면 대전이 시작됩니다."}</p><button class="secondary" data-leave-room>${language === "en" ? "Cancel waiting" : "대기 취소"}</button></div>`;
    } else {
      controls = `<div class="online-actions"><button class="primary" data-create-room>${t("createRoom")}</button><div class="online-join"><input data-room-code value="${pendingRoomCode}" maxlength="8" inputmode="text" autocomplete="off" placeholder="8-DIGIT CODE" aria-label="Invite code"><button class="secondary" data-join-room>${t("joinRoom")}</button></div><button class="secondary" disabled>${t("quickMatch")} · ${language === "en" ? "NEXT PHASE" : "다음 단계"}</button></div>`;
    }
    app.innerHTML = `<div class="shell"><header class="topbar">${brandMarkup()}${wallet()}</header><section class="online-page"><div class="online-heading"><small>${t("onlineLobby")} · FIRESTORE PILOT</small><h1>${t("onlineTitle")}</h1><p>${t("onlineNote")}</p></div><div class="online-status ${online.status}"><span>${t("connection")}</span><b>${statusText}</b><small>${statusDetail}</small></div>${controls}<div class="online-contract"><div><b>01</b><span>${language === "en" ? "Google identity seats" : "Google 계정 좌석 확인"}</span></div><div><b>02</b><span>${language === "en" ? "Turn revision synchronization" : "수순 번호 동기화"}</span></div><div><b>03</b><span>${language === "en" ? "No ranked rewards in pilot" : "체험판 랭크 보상 없음"}</span></div></div><button class="secondary" id="back-to-setup">${t("play")}</button></section></div>`;
    bindStoreButton();
    ensureOnlineConnection();
    const login = app.querySelector("[data-online-signin]");
    if (login) login.addEventListener("click", async () => {
      login.disabled = true;
      try {
        await cloud.signIn();
        await client.connect();
      } catch (_) { /* The online status panel shows the localized error. */ }
      renderOnlineLobby();
    });
    const create = app.querySelector("[data-create-room]");
    if (create) create.addEventListener("click", async () => {
      create.disabled = true;
      try {
        const initial = onlineInitialState();
        await client.createRoom({ pack: chosen, timeRule, gameState: initial, clocks: { white: TIME_RULES[timeRule].seconds, black: TIME_RULES[timeRule].seconds } });
      } catch (_) { renderOnlineLobby(); }
    });
    const codeInput = app.querySelector("[data-room-code]");
    if (codeInput) codeInput.addEventListener("input", () => { codeInput.value = client.normalizeCode(codeInput.value); });
    const join = app.querySelector("[data-join-room]");
    if (join) join.addEventListener("click", async () => {
      const code = client.normalizeCode(codeInput.value);
      if (code.length !== 8) return alert(language === "en" ? "Enter the 8-character invite code." : "8자리 초대 코드를 입력해주세요.");
      join.disabled = true;
      try {
        await client.joinRoom(code);
        pendingRoomCode = "";
      } catch (_) { renderOnlineLobby(); }
    });
    const copyRoom = app.querySelector("[data-copy-room]");
    if (copyRoom) copyRoom.addEventListener("click", async () => {
      const invite = new URL(window.location.href);
      invite.search = "";
      invite.hash = "";
      invite.searchParams.set("room", online.roomCode);
      try { await navigator.clipboard.writeText(invite.href); }
      catch (_) { /* The visible code can still be selected manually. */ }
      copyRoom.textContent = language === "en" ? "LINK COPIED" : "링크 복사 완료";
    });
    const leaveRoom = app.querySelector("[data-leave-room]");
    if (leaveRoom) leaveRoom.addEventListener("click", () => client.leave());
    document.getElementById("back-to-setup").addEventListener("click", () => { if (online.room) client.leave(); screen = "setup"; renderSetup(); });
    syncBgm();
  }

  function startOnlineGame(online) {
    let remoteState;
    try { remoteState = JSON.parse(online.room.stateJson); }
    catch (_) { return alert(language === "en" ? "The room state is invalid." : "온라인 방 상태를 읽을 수 없습니다."); }
    screen = "game"; gameMode = "online"; playerColor = online.color; result = null; chestOpened = false; selected = null; selectedSkill = null; thinking = false; promotionChoices = []; timerWarningKey = ""; activityStartedAt = Date.now();
    replayMode = false; replayIndex = 0; lastVisualMove = null; cinematicAction = null; animating = false;
    state = remoteState;
    onlineRevision = Number(online.room.revision || 0);
    if (TIME_RULES[online.room.timeRule]) timeRule = online.room.timeRule;
    clocks = online.room.clocks || { white: TIME_RULES[timeRule].seconds, black: TIME_RULES[timeRule].seconds };
    snapshots = [cloneState(state)];
    clearInterval(timer);
    if (window.OverrideGridScene) window.OverrideGridScene.reset();
    renderGame();
    if (online.room.status === "finished") {
      if (online.room.finishReason === "resignation") {
        const won = online.room.winnerColor === playerColor;
        finish(online.room.winnerColor, won ? (language === "en" ? "Your opponent resigned." : "상대가 기권했습니다.") : (language === "en" ? "You resigned from the match." : "대전에서 기권했습니다."));
        return;
      }
      const status = G.getGameStatus(state);
      if (status.over) finish(status.result, status.reason);
    }
  }

  function syncOnlineGame(online) {
    if (!online.room) return;
    const cloudUser = window.XenaCloudSync && window.XenaCloudSync.snapshot().user;
    if (online.room.emote && online.room.emote.nonce > onlineEmoteNonce && (!cloudUser || online.room.emote.uid !== cloudUser.uid)) {
      onlineEmoteNonce = online.room.emote.nonce;
      const color = online.room.emote.uid === online.room.whiteUid ? "white" : "black";
      const legacyEmotes = { signal: "smile", override: "tease" };
      const emoteId = legacyEmotes[online.room.emote.id] || online.room.emote.id;
      if (EMOTES[emoteId]) {
        const entry = { id: emoteId, color, nonce: ++emoteNonce };
        emoteFeed = [entry];
        setTimeout(() => { if (emoteFeed[0] && emoteFeed[0].nonce === entry.nonce) { emoteFeed = []; if (screen === "game") renderGame(); } }, 1900);
      }
    }
    const revision = Number(online.room.revision || 0);
    if (revision <= onlineRevision) return;
    let remoteState;
    try { remoteState = JSON.parse(online.room.stateJson); } catch (_) { return; }
    onlineRevision = revision;
    clocks = online.room.clocks || clocks;
    const remoteAction = online.room.lastAction;
    const isRemoteActor = cloudUser && online.room.lastActorUid && online.room.lastActorUid !== cloudUser.uid;
    const applyRemote = () => {
      state = remoteState;
      recordSnapshot();
      animating = false;
      cinematicAction = null;
      thinking = false;
      if (online.room.status === "finished" && online.room.finishReason === "resignation") {
        const won = online.room.winnerColor === playerColor;
        finish(online.room.winnerColor, won ? (language === "en" ? "Your opponent resigned." : "상대가 기권했습니다.") : (language === "en" ? "You resigned from the match." : "대전에서 기권했습니다."));
        return;
      }
      const status = G.getGameStatus(state);
      if (online.room.status === "finished" && status.over) finish(status.result, status.reason);
      else renderGame();
    };
    if (isRemoteActor && remoteAction && (remoteAction.capture || remoteAction.skill)) {
      animating = true;
      cinematicAction = remoteAction;
      playActionSfx(remoteAction);
      if (window.OverrideGridScene) window.OverrideGridScene.playAction(remoteAction);
      renderGame();
      setTimeout(applyRemote, remoteAction.skill ? 760 : 620);
    } else {
      applyRemote();
    }
  }

  function startGame() {
    if (!committedStarter && !STARTER_PACKS.has(chosen)) return;
    if (!committedStarter) {
      committedStarter = chosen;
      owned = [chosen];
      saveMeta();
    }
    if (gameMode === "online") return renderOnlineLobby();
    screen = "game"; result = null; chestOpened = false; selected = null; selectedSkill = null; thinking = false; promotionChoices = []; timerWarningKey = ""; activityStartedAt = Date.now();
    replayMode = false; replayIndex = 0; lastVisualMove = null; cinematicAction = null; animating = false;
    const enemy = chosen === "xena" ? "sovran" : "xena";
    state = G.createInitialState({ whitePack: chosen, blackPack: enemy });
    applyLineupToState(state, "white", chosen);
    if (gameMode === "local" && owned.includes(enemy)) applyLineupToState(state, "black", enemy);
    const awakenPreview = new URLSearchParams(window.location.search).get("awaken");
    if (awakenPreview === "white" || awakenPreview === "black") state.awakened[awakenPreview] = true;
    snapshots = [cloneState(state)];
    if (window.OverrideGridScene) window.OverrideGridScene.reset();
    clocks = { white: TIME_RULES[timeRule].seconds, black: TIME_RULES[timeRule].seconds };
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    renderGame();
    if (new URLSearchParams(window.location.search).get("fx") === "1") {
      setTimeout(() => window.OverrideGridScene && window.OverrideGridScene.playAction({ from: 3, to: 21, color: "white", character: "XENA", capture: true, nonce: 999999 }), 80);
    }
  }

  function applyLineupToState(targetState, color, packId) {
    const lineup = unitLineups[packId] || defaultLineup(packId);
    const backKeys = color === "white"
      ? ["bastion", "vector1", "catalyst", "leader", "vector2", "glitch"]
      : ["glitch", "vector2", "leader", "catalyst", "vector1", "bastion"];
    const signalKeys = color === "white"
      ? ["signal1", "signal2", "signal3", "signal4", "signal5", "signal6"]
      : ["signal6", "signal5", "signal4", "signal3", "signal2", "signal1"];
    const backRow = color === "white" ? 0 : 5;
    const signalRow = color === "white" ? 1 : 4;
    backKeys.forEach((key, col) => {
      const piece = targetState.board[G.indexOf(backRow, col)];
      const unit = unitForCharacter(lineup[key]);
      if (piece && unit && unit.role === piece.type && ownsCodexCard(unit)) piece.character = unit.character;
    });
    signalKeys.forEach((key, col) => {
      const piece = targetState.board[G.indexOf(signalRow, col)];
      const unit = unitForCharacter(lineup[key]);
      if (piece && unit && unit.role === "signal" && ownsCodexCard(unit)) piece.character = unit.character;
    });
  }

  function tick() {
    if (!state || result || replayMode) return;
    clocks[state.turn] -= 1;
    const warningKey = `${state.ply}:${state.turn}`;
    if (clocks[state.turn] <= 10 && timerWarningKey !== warningKey) {
      timerWarningKey = warningKey;
      playSfx("timer10", 0.45);
    }
    if (clocks[state.turn] <= 0) finish(G.other(state.turn), "시간 종료");
    else renderGame();
  }

  function formatTime(value) {
    const safe = Math.max(0, value);
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function pieceMarkup(piece, index) {
    if (!piece) return "";
    const awake = piece.type === "leader" && state.awakened[piece.color] ? "awakened" : "";
    const locked = state.locked && state.locked.pieceId === piece.id ? "locked" : "";
    const arriving = lastVisualMove && lastVisualMove.to === index ? "arrive" : "";
    const art = artFor(piece);
    const crop = awake ? { scale: 1.14, shift: "0%" } : portraitCropFor(piece.character);
    const frameItem = piece.color === playerColor ? SHOP_ITEMS.find((item) => item.id === activeFrame && item.kind === "frame") : null;
    const frameClass = frameItem ? `frame-${frameItem.frameStyle}` : "";
    return `<span class="piece portrait-piece role-${piece.type} ${piece.color} ${awake} ${locked} ${arriving} ${frameClass}" style="--face-scale:${crop.scale};--face-shift:${crop.shift}"><span class="rank-tag">${roleLabel(piece.type)}</span><span class="portrait-shell"><img src="${art}" alt="${piece.character}"><span class="portrait-shine"></span><span class="role-badge">${piece.type === "leader" ? piece.character[0] : glyph[piece.type]}</span></span><span class="piece-label">${piece.character}</span></span>`;
  }

  function boardMarkup() {
    let html = "";
    const flipped = gameMode === "online" && playerColor === "black";
    const rows = flipped ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
    const columns = flipped ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    for (const row of rows) for (const col of columns) {
      const index = G.indexOf(row, col);
      const piece = state.board[index];
      const targets = legal.filter((move) => move.to === index && (!selectedSkill || move.skill === selectedSkill));
      const classes = ["square", (row + col) % 2 ? "light" : "dark"];
      if (selected === index) classes.push("selected");
      if (targets.length) classes.push(piece && piece.color !== state.turn ? "capture" : "legal");
      html += `<button class="${classes.join(" ")}" data-square="${index}"><span class="coord">${String.fromCharCode(65 + col)}${row + 1}</span>${pieceMarkup(piece, index)}</button>`;
    }
    return html;
  }

  function capturedMarkup(color) {
    return state.captured[color].map((p) => `<span class="chip">${glyph[p.type]} ${p.character}</span>`).join("") || `<span class="chip">${t("none")}</span>`;
  }

  function artFor(piece) {
    if (piece.type === "leader" && state && state.awakened[piece.color]) {
      return assetSrc("portrait", String(piece.character).startsWith("XENA") ? "xena_override_v1.png" : "sovran_override_v1.png");
    }
    const configured = characterArtSrc(piece.character);
    if (configured) return configured;
    const portrait = PORTRAIT_ART[piece.character];
    return portrait ? assetSrc("portrait", portrait) : CARD_ART_ROOT + (CARD_ART[piece.character] || CARD_ART[piece.color === "white" ? "XENA" : "SOVRAN"]);
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function recordSnapshot() {
    snapshots.push(cloneState(state));
  }

  function focusCard(color) {
    const focusIndex = selected !== null ? selected : lastVisualMove && lastVisualMove.to;
    const piece = Number.isInteger(focusIndex) ? state.board[focusIndex] : null;
    if (piece && color && piece.color !== color) return `<div class="focus-card empty-focus"><small>SELECTED UNIT</small><span>${t("opponentUnit")}</span></div>`;
    if (!piece) return `<div class="focus-card empty-focus"><small>SELECTED UNIT</small><span>${t("selectUnit")}</span></div>`;
    const role = roleInfo(piece.type);
    const awakened = piece.type === "leader" && state.awakened[piece.color];
    return `<div class="focus-card ${piece.color} ${awakened ? "awakened" : ""}"><img src="${artFor(piece)}" alt="${piece.character}"><div><small>${role[0]}</small><b>${piece.character}</b><span>${awakened ? "OVERRIDE ACTIVE" : role[1]}</span></div></div>`;
  }

  function skillButtons(color) {
    const pack = G.leaderSkillPack(state, color);
    const names = pack === "xena" ? ["cyanShift", "override"] : pack === "crystal" ? ["prismShift", "etherealLeap"] : ["systemLock", "publicErasure"];
    return names.map((key, index) => {
      const enabled = canControl(color) && (index === 0 ? state.skills[color].base : state.awakened[color] && state.skills[color].awakened);
      return `<button class="skill-button" data-skill="${key}" ${enabled ? "" : "disabled"}><b>${skillText(key, 0)}</b><span>${skillText(key, 1)}</span></button>`;
    }).join("");
  }

  function emoteMarkup() {
    return `<div class="emote-float-layer">${emoteFeed.map((emote) => `<div class="emote-float ${emote.color}" data-emote-nonce="${emote.nonce}"><img src="${assetSrc("emote", EMOTES[emote.id].art)}"${fallbackAttr("emote", EMOTES[emote.id].fallbackArt)} alt=""><span>${EMOTES[emote.id][language]}</span></div>`).join("")}</div>`;
  }

  function emoteBar() {
    const hasPack = cosmeticOwned.includes("emote-signal");
    return `<div class="emote-bar" aria-label="Emotes">${Object.entries(EMOTES).map(([id, emote]) => {
      const available = FREE_EMOTES.has(id) || hasPack;
      return `<button class="emote-button ${available ? "" : "locked"}" data-emote="${id}" title="${available ? emote[language] : (language === "en" ? "Unlock XENA Reaction Pack" : "제나 리액션 팩에서 해금")}" ${available ? "" : "disabled"}><img src="${assetSrc("emote", emote.art)}"${fallbackAttr("emote", emote.fallbackArt)} alt=""><span>${available ? emote[language] : (language === "en" ? "Locked" : "잠김")}</span></button>`;
    }).join("")}</div>`;
  }

  function cinematicEffectMarkup() {
    if (!cinematicAction || !cinematicAction.effectImage) return "";
    const target = Number.isInteger(cinematicAction.to) ? cinematicAction.to : cinematicAction.from;
    const row = Math.floor(target / 6);
    const col = target % 6;
    return `<div class="asset-vfx" style="--vfx-left:${((col + .5) * 100 / 6).toFixed(3)}%;--vfx-top:${((row + .5) * 100 / 6).toFixed(3)}%"><img src="${cinematicAction.effectImage}" alt=""></div>`;
  }

  function sendEmote(id) {
    if (!EMOTES[id] || result || replayMode) return;
    const color = gameMode === "local" ? state.turn : playerColor;
    const entry = { id, color, nonce: ++emoteNonce };
    emoteFeed = [entry];
    playSfx("confirm", 0.36);
    if (gameMode === "online" && window.OverrideGridOnline) window.OverrideGridOnline.send({ type: "game.emote", emoteId: id });
    renderGame();
    setTimeout(() => {
      if (emoteFeed[0] && emoteFeed[0].nonce === entry.nonce) {
        emoteFeed = [];
        if (screen === "game") renderGame();
      }
    }, 1900);
  }

  function panel(color, enemy) {
    const pack = G.PACKS[state.packs[color]];
    const leader = state.board.find((piece) => piece && piece.color === color && piece.type === "leader");
    const leaderName = leader ? leader.character : pack.leaderName;
    const localSide = gameMode === "local";
    const opponentLabel = gameMode === "online" ? (language === "en" ? "ONLINE OPPONENT" : "온라인 상대") : t("opponent");
    const sideLabel = localSide ? (color === "white" ? t("playerOne") : t("playerTwo")) : (enemy ? opponentLabel : t("player"));
    const timerLabel = gameMode === "online" ? (state.turn === color ? (language === "en" ? "TURN" : "차례") : (language === "en" ? "WAIT" : "대기")) : formatTime(clocks[color]);
    if (localSide) enemy = false;
    return `<aside class="side-panel ${enemy ? "enemy-panel" : ""}"><div class="combatant ${enemy ? "enemy" : ""}"><small>${sideLabel}</small><h2>${leaderName}</h2>
      <div class="timer ${state.turn === color ? "active" : ""}">${timerLabel}</div><div class="awakening ${state.awakened[color] ? "on" : ""}">${state.awakened[color] ? "OVERRIDE ACTIVE" : "CATALYST LINKED"}</div></div>
      <div class="skill-list">${skillButtons(color)}</div>${enemy ? "" : focusCard()}<div><small>${t("captured")}</small><div class="captured">${capturedMarkup(color)}</div></div>
      ${enemy ? "" : `<div class="log">${state.log.slice(-12).reverse().map((entry) => `${entry.ply + 1}. ${entry.move.skill ? skillText(entry.move.skill, 0) : (language === "en" ? "Move" : "말 이동")}`).join("<br>") || t("firstMove")}</div>`}</aside>`;
  }

  function currentRecoveries() {
    if (!state || result || replayMode || thinking || animating) return [];
    const humanTurn = gameMode === "local" || state.turn === playerColor;
    return humanTurn ? G.pendingRecoveries(state, state.turn) : [];
  }

  function promotionMarkup() {
    if (!promotionChoices.length) return "";
    return `<div class="choice-overlay"><section class="choice-modal"><small>SIGNAL RECOVERY</small><h2>${language === "en" ? "Choose a recovered unit" : "회수할 전사 선택"}</h2><p>${language === "en" ? "The Signal reached the final rank. Restore one captured unit." : "시그널이 마지막 랭크에 도달했습니다. 포획된 아군 하나로 즉시 승급합니다."}</p><div class="choice-grid">${promotionChoices.map((move, index) => {
      const piece = state.captured[state.turn].find((item) => item.id === move.promoteId);
      return piece ? `<button data-promotion-index="${index}"><img src="${artFor(piece)}" alt="${piece.character}"><span><b>${piece.character}</b><small>${roleLabel(piece.type)}</small></span></button>` : "";
    }).join("")}</div></section></div>`;
  }

  function recoveryMarkup() {
    const options = currentRecoveries();
    if (!options.length || promotionChoices.length) return "";
    return `<div class="choice-overlay"><section class="choice-modal"><small>FINAL RANK LINK</small><h2>${language === "en" ? "Recovery is ready" : "회수 승급 준비 완료"}</h2><p>${language === "en" ? "A waiting Signal can now restore one captured unit." : "마지막 랭크에서 대기 중인 시그널이 포획된 아군을 회수할 수 있습니다."}</p><div class="choice-grid">${options.map((option, index) => {
      const piece = state.captured[state.turn].find((item) => item.id === option.capturedId);
      return piece ? `<button data-recovery-index="${index}"><img src="${artFor(piece)}" alt="${piece.character}"><span><b>${piece.character}</b><small>${roleLabel(piece.type)}</small></span></button>` : "";
    }).join("")}</div></section></div>`;
  }

  function renderGame() {
    if (screen !== "game") return;
    applyCosmeticTheme();
    const status = G.getGameStatus(state);
    const turnLeader = state.board.find((piece) => piece && piece.color === state.turn && piece.type === "leader");
    const turnPack = turnLeader ? turnLeader.character : G.PACKS[state.packs[state.turn]].leaderName;
    app.innerHTML = `<div class="shell"><header class="topbar">${brandMarkup()}${wallet()}</header>
      <div class="game-layout">${panel("white", gameMode !== "local" && playerColor !== "white")}<section class="arena"><div class="status-strip"><strong>${animating ? t("cinematic") : thinking ? t("thinking") : `${turnPack} ${t("turn")}${status.check ? " · CHECK" : ""}`}</strong><span>${state.ply + 1} ${t("move")}</span></div>
      <div class="board-wrap"><div class="scene3d" id="scene3d"></div><div class="board three-board">${boardMarkup()}</div>${cinematicEffectMarkup()}${emoteMarkup()}</div>${replayMode ? "" : emoteBar()}<div class="arena-actions"><span>${replayMode ? `${t("replay")} ${replayIndex + 1}/${lastReplay.length}` : `${TIME_RULES[timeRule].label} · ${TIME_RULES[timeRule].note}`}</span>${replayMode ? `<div class="replay-actions"><button class="secondary" id="replay-prev" ${replayIndex === 0 ? "disabled" : ""}>${t("previous")}</button><button class="secondary" id="replay-next" ${replayIndex >= lastReplay.length - 1 ? "disabled" : ""}>${t("next")}</button><button class="secondary" id="replay-exit">${t("leave")}</button></div>` : `<button class="secondary" id="exit">${t("exit")}</button>`}</div></section>${panel("black", gameMode !== "local" && playerColor !== "black")}</div>
      ${result ? resultMarkup() : ""}${promotionMarkup()}${recoveryMarkup()}</div>`;
    if (result) {
      const resultActions = app.querySelector(".result-box .actions");
      if (resultActions && !resultActions.querySelector("#return-lobby")) resultActions.insertAdjacentHTML("beforeend", `<button class="secondary" id="return-lobby">로비로</button>`);
    }
    app.querySelectorAll("[data-square]").forEach((button) => button.addEventListener("click", () => clickSquare(Number(button.dataset.square))));
    app.querySelectorAll("[data-skill]").forEach((button) => button.addEventListener("click", () => selectSkill(button.dataset.skill)));
    app.querySelectorAll("[data-emote]").forEach((button) => button.addEventListener("click", () => sendEmote(button.dataset.emote)));
    app.querySelectorAll("[data-promotion-index]").forEach((button) => button.addEventListener("click", () => {
      const move = promotionChoices[Number(button.dataset.promotionIndex)];
      promotionChoices = [];
      if (move) performMove(move);
    }));
    const recoveries = currentRecoveries();
    app.querySelectorAll("[data-recovery-index]").forEach((button) => button.addEventListener("click", () => {
      const recovery = recoveries[Number(button.dataset.recoveryIndex)];
      if (!recovery) return;
      const before = state;
      state = G.applyRecovery(state, recovery);
      playSfx("promotion", 0.56);
      recordSnapshot();
      if (gameMode === "online") publishOnlineState({ kind: "recovery", capturedId: recovery.capturedId }, before);
      else renderGame();
    }));
    const exit = document.getElementById("exit"); if (exit) exit.addEventListener("click", exitGame);
    bindStoreButton();
    const replayPrev = document.getElementById("replay-prev"); if (replayPrev) replayPrev.addEventListener("click", () => stepReplay(-1));
    const replayNext = document.getElementById("replay-next"); if (replayNext) replayNext.addEventListener("click", () => stepReplay(1));
    const replayExit = document.getElementById("replay-exit"); if (replayExit) replayExit.addEventListener("click", exitGame);
    const again = document.getElementById("again"); if (again) again.addEventListener("click", result && result.online ? exitGame : startGame);
    const returnLobby = document.getElementById("return-lobby"); if (returnLobby) returnLobby.addEventListener("click", exitGame);
    const replay = document.getElementById("replay"); if (replay) replay.addEventListener("click", startReplay);
    bindRewardChest();
    if (result && result.celebrate) launchFireworks();
    if (window.OverrideGridScene) {
      window.OverrideGridScene.mount(document.getElementById("scene3d"));
      window.OverrideGridScene.sync(state, { selected, legal, action: lastVisualMove, flipped: gameMode === "online" && playerColor === "black" });
    }
    syncBgm();
  }

  function selectSkill(skill) {
    if (!canControl(state.turn) || currentRecoveries().length || promotionChoices.length) return;
    const leader = state.board.findIndex((p) => p && p.color === state.turn && p.type === "leader");
    selected = leader; selectedSkill = skill;
    legal = G.generateLegalMoves(state).filter((move) => move.skill === skill);
    playSfx("select", 0.36);
    renderGame();
  }

  function clickSquare(index) {
    if (thinking || animating || result || replayMode || currentRecoveries().length || promotionChoices.length || !canControl(state.turn)) return;
    const matching = legal.filter((move) => move.to === index && (!selectedSkill || move.skill === selectedSkill));
    if (matching.length) {
      let move = matching[0];
      if (matching.length > 1) {
        promotionChoices = matching;
        renderGame();
        return;
      }
      performMove(move); return;
    }
    const piece = state.board[index];
    if (piece && piece.color === state.turn) {
      selected = index; selectedSkill = null;
      legal = G.generateLegalMoves(state).filter((move) => move.from === index && move.kind === "move");
      playSfx("select", 0.32);
    } else { selected = null; selectedSkill = null; legal = []; }
    renderGame();
  }

  function afterMove() {
    const status = G.getGameStatus(state);
    if (status.over) return finish(status.result, status.reason);
    if (status.check) playSfx("check", 0.48);
    renderGame();
    if ((gameMode === "ai" || gameMode === "event") && state.turn === "black") aiTurn();
  }

  function aiTurn() {
    thinking = true; renderGame();
    setTimeout(() => {
      const recoveries = G.pendingRecoveries(state, "black");
      if (recoveries.length) { state = G.applyRecovery(state, recoveries[0]); recordSnapshot(); }
      const difficulty = gameMode === "event" ? eventDifficulty : aiDifficulty;
      const move = G.chooseAIMove(state, { difficulty });
      thinking = false;
      if (move) performMove(move);
      else afterMove();
    }, 750);
  }

  function finish(winner, reason) {
    clearInterval(timer);
    const draw = winner === "draw";
    const localGame = gameMode === "local";
    const win = winner === playerColor;
    let creditReward = 0;
    let shardReward = 0;
    let eventBonus = 0;

    const rewardEligible = gameMode === "ai" || gameMode === "event";
    if (rewardEligible) {
      const difficulty = gameMode === "event" ? eventDifficulty : aiDifficulty;
      creditReward = draw ? 10 : win ? DIFFICULTIES[difficulty].credits : DIFFICULTIES[difficulty].loss;
      if (gameMode === "event" && win) {
        const claims = dailyEvent();
        if (!claims[difficulty]) {
          claims[difficulty] = true;
          creditReward += EVENT_REWARDS[difficulty].credits;
          shardReward = EVENT_REWARDS[difficulty].shards;
          if (claims.easy && claims.normal && claims.hard && !claims.bonus) {
            claims.bonus = true;
            creditReward += 500;
            eventBonus = 3;
          }
        }
      }
      credits += creditReward;
      shards += shardReward + eventBonus;
      saveMeta();
    }
    lastReplay = snapshots.map(cloneState);
    const reasonText = draw ? ({ threefold: language === "en" ? "Draw: the same position repeated four times." : "무승부: 같은 포지션이 네 번 반복되었습니다.", "forty-move": language === "en" ? "Draw: 80 quiet moves passed without a capture or Signal move." : "무승부: 포획이나 시그널 이동 없이 80번의 조용한 수가 진행되었습니다.", stalemate: language === "en" ? "Draw: the player to move has no legal move, but is not in check." : "무승부: 둘 차례에 합법적인 수가 없지만 체크 상태는 아닙니다." }[reason] || (language === "en" ? "Draw by the board rules." : "보드 규칙에 따른 무승부입니다.")) : reason;
    const title = draw ? t("draw") : localGame ? `${winner === "white" ? t("playerOne") : t("playerTwo")} ${t("win")}` : win ? t("win") : t("defeat");
    const celebrate = win || (localGame && !draw);
    result = { title, reason: reasonText, reward: creditReward, shards: shardReward, bonus: eventBonus, localGame, online: gameMode === "online", win, celebrate };
    chestOpened = false;
    renderGame();
  }

  function makeVisualAction(move, before) {
    const mover = Number.isInteger(move.from) ? before.board[move.from] : null;
    const target = Number.isInteger(move.to) ? before.board[move.to] : null;
    const targetLeader = target ? before.board.find((piece) => piece && piece.color === target.color && piece.type === "leader") : null;
    const effectSetting = mover && unitEffects[mover.character];
    const effectItem = effectSetting && effectSetting.enabled !== false && cosmeticOwned.includes(effectSetting.id)
      ? SHOP_ITEMS.find((item) => item.id === effectSetting.id && item.kind === "effect")
      : null;
    return {
      ...move,
      color: before.turn,
      character: mover && mover.character,
      pieceType: mover && mover.type,
      targetCharacter: target && target.character,
      targetType: target && target.type,
      targetColor: target && target.color,
      targetLeader: targetLeader && targetLeader.character,
      effectStyle: effectItem && effectItem.effectStyle,
      effectColor: effectItem && effectItem.effectColor,
      effectImage: effectItem && itemArtSrc(effectItem),
      capture: Boolean((move.kind === "move" && target && target.color !== before.turn) || move.skill === "publicErasure"),
      nonce: ++visualNonce,
    };
  }

  function playActionSfx(action) {
    if (!action) return;
    if (action.skill && SFX[action.skill]) {
      playSfx(action.skill, 0.58);
      return;
    }
    if (action.targetType === "catalyst") {
      playSfx("catalystLost", 0.56);
      playSfx(action.targetLeader && String(action.targetLeader).startsWith("SOVRAN") ? "awakenSovran" : "awakenXena", 0.42);
      return;
    }
    if (action.promoteId) {
      playSfx("promotion", 0.56);
      return;
    }
    if (action.capture) {
      playSfx(action.color === "white" ? "captureCyan" : "captureCrimson", 0.56);
      return;
    }
    if (action.pieceType === "signal") playSfx("moveSignal", 0.35);
    else if (action.pieceType === "glitch") playSfx("moveGlitch", 0.38);
    else playSfx("moveHeavy", 0.36);
  }

  function performMove(move) {
    const before = state;
    const action = makeVisualAction(move, before);
    selected = null; selectedSkill = null; legal = []; promotionChoices = [];
    const cinematic = Boolean(action.capture || action.skill);
    if (!cinematic) {
      playActionSfx(action);
      state = G.applyMove(state, move);
      recordSnapshot();
      recordVisualMove(action);
      if (gameMode === "online") publishOnlineState(action, before);
      else afterMove();
      return;
    }
    animating = true;
    cinematicAction = action;
    playActionSfx(action);
    if (window.OverrideGridScene) window.OverrideGridScene.playAction(action);
    renderGame();
    setTimeout(() => {
      state = G.applyMove(state, move);
      recordSnapshot();
      recordVisualMove(action);
      animating = false;
      cinematicAction = null;
      if (gameMode === "online") publishOnlineState(action, before);
      else afterMove();
    }, action.skill ? 760 : 620);
  }

  async function publishOnlineState(action, before) {
    const client = window.OverrideGridOnline;
    if (!client) return;
    const expectedRevision = onlineRevision;
    const status = G.getGameStatus(state);
    thinking = true;
    renderGame();
    try {
      await client.submit({
        expectedRevision,
        gameState: cloneState(state),
        clocks: { ...clocks },
        action,
        finished: status.over,
        winnerColor: status.over ? status.result : null,
        finishReason: status.over ? status.reason : "",
      });
      onlineRevision = Math.max(onlineRevision, expectedRevision + 1);
      thinking = false;
      afterMove();
    } catch (_) {
      state = cloneState(before);
      thinking = false;
      selected = null; selectedSkill = null; legal = [];
      alert(language === "en" ? "The move was not synchronized. The previous position was restored." : "수가 동기화되지 않아 이전 상태로 복구했습니다.");
      renderGame();
    }
  }

  function recordVisualMove(action) {
    lastVisualMove = action;
    const nonce = action.nonce;
    setTimeout(() => {
      if (lastVisualMove && lastVisualMove.nonce === nonce) lastVisualMove = null;
    }, 900);
  }

  function resultMarkup() {
    const shardTotal = result.shards + result.bonus;
    const chest = shardTotal >= 10 ? "chest_signal_override_v1.png" : shardTotal >= 5 ? "chest_signal_epic_v1.png" : result.reward >= 50 ? "chest_signal_rare_v1.png" : "chest_signal_common_v1.png";
    let rewards = "";
    if (!result.localGame && !result.online) {
      const opened = chestOpened ? " is-open" : "";
      const rewardList = `<div class="reward-list${chestOpened ? " reveal" : ""}" id="reward-list">`
        + `<div class="reward"><img src="${assetSrc("ui", "currency_signal_credit_v1.png")}" alt="">${language === "en" ? "Signal Credits" : "시그널 크레딧"} +${result.reward}</div>`
        + `${result.shards || result.bonus ? `<div class="reward shard-reward"><img src="${assetSrc("ui", "currency_anomaly_shard_v1.png")}" alt="">${language === "en" ? "Anomaly Shards" : "변칙 파편"} +${shardTotal}${result.bonus ? (language === "en" ? " (completion bonus)" : " (완주 보너스 포함)") : ""}</div>` : ""}`
        + `</div>`;
      const hint = chestOpened ? "" : `<div class="chest-hint" id="chest-hint">${language === "en" ? "TAP TO OPEN" : "탭하여 열기"}</div>`;
      rewards = `<div class="reward-visual${opened}" id="chest-open" role="button" tabindex="0" aria-label="${language === "en" ? "Open reward chest" : "보상 상자 열기"}">`
        + `<span class="chest-glow"></span><span class="chest-sparks" id="chest-sparks"></span>`
        + `<img src="${assetSrc("ui", chest)}" alt="${language === "en" ? "Reward chest" : "보상 상자"}"></div>`
        + hint + rewardList;
    }
    const fireworks = result.celebrate ? `<canvas class="fireworks" id="fireworks"></canvas>` : "";
    const onlineNotice = result.online ? `<span class="account-warning">${language === "en" ? "Online pilot matches do not grant ranked rewards or currency." : "온라인 체험판은 랭크 점수와 재화를 지급하지 않습니다."}</span>` : "";
    return `<div class="result-overlay${result.celebrate ? " win" : ""}">${fireworks}<div class="result-box"><h2>${result.title}</h2><p>${result.reason}</p>${onlineNotice}${rewards}<div class="actions"><button class="secondary" id="replay">${t("replay")}</button><button class="primary" id="again">${result.online ? (language === "en" ? "Return to Lobby" : "로비로") : (language === "en" ? "Play Again" : "다시 대전")}</button></div></div></div>`;
  }

  function bindRewardChest() {
    const chestEl = document.getElementById("chest-open");
    if (!chestEl || chestOpened) return;
    const open = () => {
      if (chestOpened) return;
      chestOpened = true;
      playSfx("reward", 0.6);
      chestEl.classList.add("is-open");
      const hint = document.getElementById("chest-hint");
      if (hint) hint.remove();
      const sparks = document.getElementById("chest-sparks");
      if (sparks) {
        for (let i = 0; i < 14; i++) {
          const s = document.createElement("i");
          const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
          const dist = 34 + Math.random() * 26;
          s.style.setProperty("--sx", `${Math.cos(ang) * dist}px`);
          s.style.setProperty("--sy", `${Math.sin(ang) * dist - 10}px`);
          s.style.animationDelay = `${Math.random() * 90}ms`;
          sparks.appendChild(s);
        }
      }
      const list = document.getElementById("reward-list");
      if (list) list.classList.add("reveal");
    };
    chestEl.addEventListener("click", open);
    chestEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  }

  function launchFireworks() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.getElementById("fireworks");
    if (!canvas || !canvas.getContext) return;
    if (canvas.dataset.running === "1") return;
    canvas.dataset.running = "1";
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    const colors = ["#32e6ef", "#a06bff", "#ff2fb0", "#ffd66b", "#ffffff"];
    let particles = [];
    let bursts = 0;
    const maxBursts = 7;
    function burst() {
      if (bursts >= maxBursts) return;
      bursts++;
      const cx = canvas.offsetWidth * (0.2 + Math.random() * 0.6);
      const cy = canvas.offsetHeight * (0.15 + Math.random() * 0.4);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const count = 34 + Math.floor(Math.random() * 18);
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count;
        const speed = 1.6 + Math.random() * 3.4;
        particles.push({ x: cx, y: cy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1, color });
      }
      if (bursts < maxBursts) setTimeout(burst, 260 + Math.random() * 320);
    }
    function frame() {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.vx *= 0.985; p.life -= 0.016;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      particles = particles.filter((p) => p.life > 0);
      if (particles.length || bursts < maxBursts) requestAnimationFrame(frame);
      else { window.removeEventListener("resize", resize); canvas.dataset.running = "0"; }
    }
    burst();
    frame();
  }

  function startReplay() {
    if (!lastReplay.length) return;
    clearInterval(timer);
    replayMode = true; replayIndex = 0; result = null; selected = null; selectedSkill = null; legal = [];
    state = cloneState(lastReplay[replayIndex]);
    renderGame();
  }

  function stepReplay(direction) {
    replayIndex = Math.max(0, Math.min(lastReplay.length - 1, replayIndex + direction));
    state = cloneState(lastReplay[replayIndex]); selected = null; selectedSkill = null; legal = [];
    renderGame();
  }

  function exitGame() {
    const online = gameMode === "online" && window.OverrideGridOnline ? window.OverrideGridOnline.snapshot() : null;
    if (online && online.room && online.room.status === "active" && !result) {
      const confirmed = confirm(language === "en" ? "Resign and leave this online match?" : "온라인 대전에서 기권하고 나갈까요?");
      if (!confirmed) return;
      thinking = true;
      renderGame();
      window.OverrideGridOnline.resign().then((submitted) => {
        if (!submitted) {
          thinking = false;
          alert(language === "en" ? "The resignation could not be synchronized." : "기권을 동기화하지 못했습니다.");
          renderGame();
        }
      });
      return;
    }
    if (activityStartedAt) { recordActivity(gameMode === "online" ? "override-grid-online" : gameMode === "event" ? "override-grid-event" : "override-grid-ai", activityStartedAt); activityStartedAt = 0; }
    clearInterval(timer);
    replayMode = false;
    promotionChoices = [];
    screen = "setup";
    state = null;
    result = null;
    if (online) window.OverrideGridOnline.leave();
    renderSetup();
  }

  const launchParams = new URLSearchParams(window.location.search);
  pendingRoomCode = window.OverrideGridOnline?.normalizeCode(launchParams.get("room") || "") || "";
  if (pendingRoomCode) gameMode = "online";
  saveMeta();
  if (launchParams.get("screen") === "store") renderStore();
  else if (launchParams.get("screen") === "codex") renderCodex();
  else if (launchParams.get("screen") === "units") renderMyUnits();
  else if (pendingRoomCode) renderOnlineLobby();
  else if (launchParams.get("demo") === "1") startGame();
  else renderSetup();
  if (window.XenaCloudSync?.snapshot().configured) window.XenaCloudSync.connect().catch(() => {});
  if (launchParams.get("account") === "1") setTimeout(openAccount, 0);
})();
