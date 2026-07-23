/* ═══════════════════════════════════════════════════════════════
   xena-cards.js — XENA 생태계 공통 카드 어댑터  (2026-07-21)
   ───────────────────────────────────────────────────────────────
   기존 games/gacha/cards.js 의 배열(window.ZENA_CARD_DEFS)을
   건드리지 않고 감싸서, 파생 스탯이 붙은 객체 모델로 제공합니다.

   사용법 (games/<게임>/index.html 기준):
     <script src="../gacha/cards.js"></script>
     <script src="../../shared/xena-cards.js"></script>
     → window.XenaCards / window.XenaWallet 사용 가능

   ※ 소유권 원장은 zena_gacha_v1 단일 출처. 이 모듈은 읽기만 합니다.
      (카드 지급은 오직 가챠에서만 — 원장 이중화는 버그·치팅의 근원)
   ═══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

/* ── 등급 → Cost / Power 공식 (ZENA_TCG_전체통합_카드DB_v1.md §3-2 canonical) ──
   R=1/1, S=2/2, SR=3/4, SSR=4/6 는 대표님이 확정한 89장 갤러리카드 TCG 변환 공식.
   N은 그 문서에 없음(TCG는 R+만 사용) — 방치형은 N도 써야 하므로 R과 동급으로 둠
   (판단: 온보딩 첫 뽑기가 N이어도 방치형에 곧바로 보낼 게 있어야 함 — 대표 확인 필요). */
var GRADE_STATS = {
  N:   { cost:1, power:1 },
  R:   { cost:1, power:1 },
  S:   { cost:2, power:2 },
  SR:  { cost:3, power:4 },
  SSR: { cost:4, power:6 }
};
var DUST       = { N:1, R:3, S:10, SR:30, SSR:100 };
var GRADE_RANK = { N:0, R:1, S:2, SR:3, SSR:4 };
var GRADE_COLOR= { N:'#b9b9c6', R:'#3fe0ff', S:'#a06bff', SR:'#ff2fb0', SSR:'#e8c468' };
var GRADE_LABEL= { N:'NORMAL', R:'RARE', S:'SUPER', SR:'SUPER RARE', SSR:'SOVEREIGN' };
/* SIGNAL CLASH(TCG) 기본카드 기술 — 등급별 공용(카드 개별 기술은 추후 확장 지점).
   플레이버 텍스트이자 실제 카드에 표기되는 "기술" 한 줄. 순수 코스트/파워 대결이라는
   기존 설계를 유지하면서, 카드에 뭔가 정보가 비어보이지 않도록 등급 고유 문구를 붙인다. */
var GRADE_ABILITY = {
  N:   { en:'No special ability.',              ko:'특수 기술 없음.' },
  R:   { en:'No special ability.',               ko:'특수 기술 없음.' },
  S:   { en:'Holds the line — steady power.',    ko:'구역을 지킨다 — 안정적인 파워.' },
  SR:  { en:'Turns the tide of close zones.',    ko:'접전 구역의 흐름을 바꾼다.' },
  SSR: { en:'Commands the zone it enters.',      ko:'입장한 구역을 장악한다.' }
};
var ELEMENT_ABBR = { SOUND:'SND', SOUL:'SOL', DARK:'DRK', LIGHT:'LGT', METAL:'MTL', BUG:'BUG' };

/* ── TCG 전용(PC-01~PC-55) 개별 카드 COST/PWR/기술 오버라이드 ─────────────
   출처: 01_XENA/01_캐릭터바이블/제나카드/ZENA_TCG_전체통합_카드DB_v1.md §2
   (ZC-T1-001~ZC-T4-018, 순서 그대로 PC-01~PC-55와 1:1 대응 확인됨).
   [2026-07-24] 이전엔 이 55장도 등급별 공용 GRADE_STATS를 썼는데, 카드 아트 자체에는
   이 표의 실제 COST/PWR이 인쇄되어 있어서 "그림엔 비용2인데 게임은 비용1로 취급" 하는
   불일치가 있었다. 이제 카드별 실수치를 그대로 반영한다.
   effect.kind 는 게임에서 실제로 계산되는 간이 효과 엔진 키(TCG스크립트의 EFFECT_KIND 참고) —
   원문 키워드(DROP/LINK/PULSE/FINAL/PASSIVE)의 정확한 트리거 타이밍 대신, 최종 구역 파워
   계산 시점에 일괄 적용되는 근사치다(예: "다음에 내는 카드" 류는 "이 구역의 내 카드 전체"로 근사). */
var TCG_STATS = {
  /* [2026-07-25] 버그 수정: element 필드가 아예 없어서 PC-* 카드는 전부 element:null 이었다 —
     "내 카드" 속성 필터에서 TCG 카드가 하나도 안 잡히고, SOUL 등 속성 조건부 효과(예: BAEK,
     NIX-09)도 "같은 속성 카드가 있는지" 판정에서 항상 false가 나와 발동 안 하던 근본 원인.
     ZENA_TCG_전체통합_카드DB_v1.md §2의 속성 컬럼 그대로 반영(ANOMALY 4장은 6속성 체계에
     없어 세계관상 가장 가까운 DARK로 편입). */
  'PC-01':{cost:4,power:7,element:'SOUND',person:'XENA', ability:{en:'DROP: Give another SOUND card here +2 PWR.',ko:'DROP: 이 구역의 다른 SOUND 카드 +2 PWR.'},           effect:{kind:'buff_element',el:'SOUND',amt:2}},
  'PC-02':{cost:1,power:2,element:'SOUL',                 ability:{en:'LINK: If another SOUL card is here, +2 PWR.',ko:'LINK: 이 구역에 다른 SOUL 카드가 있으면 +2 PWR.'},   effect:{kind:'buff_self_if_element',el:'SOUL',amt:2}},
  'PC-03':{cost:2,power:3,element:'SOUL',                 ability:{en:'LINK: If XENA is here, she gets +2 PWR.',ko:'LINK: 이 구역에 XENA가 있으면 XENA +2 PWR.'},            effect:{kind:'buff_person',person:'XENA',amt:2}},
  'PC-04':{cost:3,power:4,element:'SOUL',                 ability:{en:'LINK: If another SOUL card is here, +2 PWR.',ko:'LINK: 이 구역에 다른 SOUL 카드가 있으면 +2 PWR.'},   effect:{kind:'buff_self_if_element',el:'SOUL',amt:2}},
  'PC-05':{cost:2,power:3,element:'SOUL',                 ability:{en:'PULSE: If another SOUL card is here, +1 PWR.',ko:'PULSE: 이 구역에 다른 SOUL 카드가 있으면 +1 PWR.'}, effect:{kind:'buff_self_if_element',el:'SOUL',amt:1}},
  'PC-06':{cost:6,power:10,element:'DARK',                ability:{en:'FINAL: If you are losing here, +4 PWR.',ko:'FINAL: 이 구역에서 지고 있으면 +4 PWR.'},                effect:{kind:'buff_self_if_losing',amt:4}},
  'PC-07':{cost:5,power:8,element:'LIGHT',                ability:{en:'DROP: Give an enemy card here -2 PWR.',ko:'DROP: 이 구역의 적 카드 -2 PWR.'},                        effect:{kind:'debuff_enemy_one',amt:2}},
  'PC-08':{cost:1,power:2,element:'BUG',                  ability:{en:'DROP: If an enemy has more cards here, +2 PWR.',ko:'DROP: 적 카드 수가 더 많으면 +2 PWR.'},          effect:{kind:'buff_self_if_outnumbered',amt:2}},
  'PC-09':{cost:2,power:3,element:'BUG',                  ability:{en:'DROP: +1 PWR to each of your cards here.',ko:'DROP: 이 구역의 내 카드 전체 +1 PWR.'},                effect:{kind:'buff_all_own',amt:1}},
  'PC-10':{cost:4,power:6,element:'METAL',                ability:{en:'PULSE: If this is your only card here, +2 PWR.',ko:'PULSE: 이 구역의 유일한 내 카드면 +2 PWR.'},     effect:{kind:'buff_self_if_only',amt:2}},
  'PC-11':{cost:5,power:7,element:'METAL',                ability:{en:'DROP: Give another METAL card here +2 PWR.',ko:'DROP: 이 구역의 다른 METAL 카드 +2 PWR.'},           effect:{kind:'buff_element',el:'METAL',amt:2}},
  'PC-12':{cost:6,power:9,element:'DARK',                 ability:{en:'FINAL: If another DARK card is here, +4 PWR.',ko:'FINAL: 이 구역에 다른 DARK 카드가 있으면 +4 PWR.'},effect:{kind:'buff_self_if_element',el:'DARK',amt:4}},
  'PC-13':{cost:1,power:1,element:'SOUL',person:'XENA',   ability:{en:'LINK: If XENA is here, +2 PWR.',ko:'LINK: 이 구역에 XENA가 있으면 +2 PWR.'},                          effect:{kind:'buff_self_if_person',person:'XENA',amt:2}},
  'PC-14':{cost:6,power:11,element:'DARK',person:'XENA',  ability:{en:'FINAL: If you are losing here, +5 PWR.',ko:'FINAL: 이 구역에서 지고 있으면 +5 PWR.'},                effect:{kind:'buff_self_if_losing',amt:5}},
  'PC-15':{cost:3,power:0,element:'DARK',                 ability:{en:'DROP: If XENA is here, she gets +5 PWR.',ko:'DROP: 이 구역에 XENA가 있으면 XENA +5 PWR.'},           effect:{kind:'buff_person',person:'XENA',amt:5}},
  'PC-16':{cost:5,power:8,element:'SOUND',person:'XENA',  ability:{en:'DROP: Give each SOUL card here +1 PWR.',ko:'DROP: 이 구역의 SOUL 카드 전체 +1 PWR.'},                effect:{kind:'buff_element',el:'SOUL',amt:1}},
  'PC-17':{cost:2,power:3,element:'SOUL',                 ability:{en:'LINK: If another SOUL card is here, +1 PWR.',ko:'LINK: 이 구역에 다른 SOUL 카드가 있으면 +1 PWR.'},   effect:{kind:'buff_self_if_element',el:'SOUL',amt:1}},
  'PC-18':{cost:6,power:9,element:'LIGHT',                ability:{en:'DROP: -2 PWR to each enemy card here.',ko:'DROP: 이 구역의 적 카드 전체 -2 PWR.'},                    effect:{kind:'debuff_enemy_all',amt:2}},
  'PC-19':{cost:2,power:3,element:'LIGHT',                ability:{en:'LINK: If another LIGHT card is here, +2 PWR.',ko:'LINK: 이 구역에 다른 LIGHT 카드가 있으면 +2 PWR.'}, effect:{kind:'buff_self_if_element',el:'LIGHT',amt:2}},
  'PC-20':{cost:2,power:0,element:'SOUL',                 ability:{en:'DROP: Your next card here gets +2 PWR.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                  effect:{kind:'buff_all_own',amt:2}},
  'PC-21':{cost:3,power:0,element:'DARK',                 ability:{en:'DROP: The next enemy card here gets -3 PWR.',ko:'DROP: 이 구역의 적 카드 -3 PWR.'},                  effect:{kind:'debuff_enemy_one',amt:3}},
  'PC-22':{cost:5,power:7,element:'LIGHT',                ability:{en:'DROP: -2 PWR to one enemy card here.',ko:'DROP: 이 구역의 적 카드 -2 PWR.'},                          effect:{kind:'debuff_enemy_one',amt:2}},
  'PC-23':{cost:2,power:3,element:'SOUL',                 ability:{en:'LINK: If another SOUL card is here, +1 PWR.',ko:'LINK: 이 구역에 다른 SOUL 카드가 있으면 +1 PWR.'},   effect:{kind:'buff_self_if_element',el:'SOUL',amt:1}},
  'PC-24':{cost:1,power:1,element:'SOUL',                 ability:{en:'DROP: Your next SOUL card here gets +2 PWR.',ko:'DROP: 이 구역의 SOUL 카드 전체 +2 PWR.'},           effect:{kind:'buff_element',el:'SOUL',amt:2}},
  'PC-25':{cost:4,power:5,element:'SOUND',                ability:{en:'PULSE: +1 PWR to each of your cards here.',ko:'PULSE: 이 구역의 내 카드 전체 +1 PWR.'},              effect:{kind:'buff_all_own',amt:1}},
  'PC-26':{cost:3,power:4,element:'SOUL',                 ability:{en:'LINK: If another SOUL card is here, your SOUL cards get +1 PWR.',ko:'LINK: 다른 SOUL 카드가 있으면 SOUL 카드 전체 +1 PWR.'},effect:{kind:'buff_element',el:'SOUL',amt:1}},
  'PC-27':{cost:5,power:8,element:'SOUND',                ability:{en:'DROP: +2 PWR to each of your cards here.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                effect:{kind:'buff_all_own',amt:2}},
  'PC-28':{cost:2,power:2,element:'LIGHT',                ability:{en:'PULSE: +1 PWR to each of your cards here.',ko:'PULSE: 이 구역의 내 카드 전체 +1 PWR.'},              effect:{kind:'buff_all_own',amt:1}},
  'PC-29':{cost:2,power:4,element:'DARK',                 ability:{en:'PULSE: Cards here get +1 PWR.',ko:'PULSE: 이 구역의 내 카드 전체 +1 PWR.'},                          effect:{kind:'buff_all_own',amt:1}},
  'PC-30':{cost:4,power:6,element:'SOUND',person:'XENA',  ability:{en:'DROP: If another SOUL card is here, +2 PWR.',ko:'DROP: 이 구역에 다른 SOUL 카드가 있으면 +2 PWR.'}, effect:{kind:'buff_self_if_element',el:'SOUL',amt:2}},
  'PC-31':{cost:6,power:10,element:'DARK',                ability:{en:'DROP: -2 PWR to each enemy card here.',ko:'DROP: 이 구역의 적 카드 전체 -2 PWR.'},                    effect:{kind:'debuff_enemy_all',amt:2}},
  'PC-32':{cost:3,power:5,element:'SOUL',person:'NAYUN',  ability:{en:'DROP: Give another SOUL card here +2 PWR.',ko:'DROP: 이 구역의 다른 SOUL 카드 +2 PWR.'},             effect:{kind:'buff_element',el:'SOUL',amt:2}},
  'PC-33':{cost:2,power:0,element:'DARK',                 ability:{en:'PASSIVE: 0 PWR. Next card you play here gets +3 PWR.',ko:'PASSIVE: 파워 0. 이 구역의 내 카드 전체 +3 PWR.'},effect:{kind:'buff_all_own',amt:3}},
  'PC-34':{cost:4,power:6,element:'DARK',                 ability:{en:'DROP: -2 PWR to one enemy card here.',ko:'DROP: 이 구역의 적 카드 -2 PWR.'},                          effect:{kind:'debuff_enemy_one',amt:2}},
  'PC-35':{cost:5,power:8,element:'SOUND',                ability:{en:'DROP: +2 PWR to each of your cards here.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                effect:{kind:'buff_all_own',amt:2}},
  'PC-36':{cost:6,power:11,element:'DARK',                ability:{en:'DROP: +3 PWR to each of your cards here.',ko:'DROP: 이 구역의 내 카드 전체 +3 PWR.'},                effect:{kind:'buff_all_own',amt:3}},
  'PC-37':{cost:3,power:5,element:'SOUL',                 ability:{en:'DROP: +2 PWR to another card here.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                      effect:{kind:'buff_all_own',amt:2}},
  'PC-38':{cost:2,power:3,element:'DARK',                 ability:{en:'DROP: -1 PWR to one enemy card here.',ko:'DROP: 이 구역의 적 카드 -1 PWR.'},                          effect:{kind:'debuff_enemy_one',amt:1}},
  'PC-39':{cost:6,power:10,element:'LIGHT',                ability:{en:'DROP: -2 PWR to one enemy card here.',ko:'DROP: 이 구역의 적 카드 -2 PWR.'},                          effect:{kind:'debuff_enemy_one',amt:2}},
  'PC-40':{cost:4,power:6,element:'LIGHT',                ability:{en:'PASSIVE: +2 PWR if this is the only card here.',ko:'PASSIVE: 이 구역의 유일한 카드면 +2 PWR.'},      effect:{kind:'buff_self_if_only',amt:2}},
  'PC-41':{cost:2,power:0,element:'LIGHT',                ability:{en:'PASSIVE: Enemy cards played here get -1 PWR.',ko:'PASSIVE: 이 구역의 적 카드 전체 -1 PWR.'},         effect:{kind:'debuff_enemy_all',amt:1}},
  'PC-42':{cost:4,power:2,element:'DARK',                 ability:{en:'DROP: +4 PWR if an enemy effect targeted this location.',ko:'DROP: 조건부 +2 PWR(근사치).'},        effect:{kind:'buff_self_flat',amt:2}},
  'PC-43':{cost:6,power:10,element:'SOUND',                ability:{en:'DROP: +3 PWR to your lowest-PWR card here.',ko:'DROP: 이 구역의 내 최저파워 카드 +3 PWR.'},          effect:{kind:'buff_lowest',amt:3}},
  'PC-44':{cost:5,power:7,element:'LIGHT',                ability:{en:'LINK: If another LIGHT card is here, +2 PWR.',ko:'LINK: 이 구역에 다른 LIGHT 카드가 있으면 +2 PWR.'}, effect:{kind:'buff_self_if_element',el:'LIGHT',amt:2}},
  'PC-45':{cost:2,power:3,element:'SOUL',                 ability:{en:'LINK: If NAYUN is here, +2 PWR.',ko:'LINK: 이 구역에 NAYUN이 있으면 +2 PWR.'},                        effect:{kind:'buff_self_if_person',person:'NAYUN',amt:2}},
  'PC-46':{cost:5,power:8,element:'SOUND',                ability:{en:'LINK: If your other card here has lower PWR, +2 PWR.',ko:'LINK: 이 구역의 다른 내 카드보다 파워가 높으면 +2 PWR.'},effect:{kind:'buff_self_if_lowerother',amt:2}},
  'PC-47':{cost:4,power:4,element:'LIGHT',                ability:{en:'DROP: Your next card here gets +2 PWR.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                  effect:{kind:'buff_all_own',amt:2}},
  'PC-48':{cost:3,power:4,element:'LIGHT',                ability:{en:'DROP: -1 PWR to each enemy card here.',ko:'DROP: 이 구역의 적 카드 전체 -1 PWR.'},                    effect:{kind:'debuff_enemy_all',amt:1}},
  'PC-49':{cost:6,power:9,element:'LIGHT',                ability:{en:'DROP: -3 PWR to one enemy card here.',ko:'DROP: 이 구역의 적 카드 -3 PWR.'},                          effect:{kind:'debuff_enemy_one',amt:3}},
  'PC-50':{cost:5,power:9,element:'SOUND',                ability:{en:'PASSIVE: +3 PWR if you have no LIGHT cards here.',ko:'PASSIVE: 이 구역에 LIGHT 카드가 없으면 +3 PWR.'},effect:{kind:'buff_self_if_no_element',el:'LIGHT',amt:3}},
  'PC-51':{cost:3,power:5,element:'SOUL',person:'NAYUN',  ability:{en:'PASSIVE: +2 PWR if an enemy effect was revealed here.',ko:'PASSIVE: 조건부 +2 PWR(근사치).'},        effect:{kind:'buff_self_flat',amt:2}},
  'PC-52':{cost:2,power:3,element:'LIGHT',                ability:{en:'DROP: +2 PWR to another card here.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                      effect:{kind:'buff_all_own',amt:2}},
  'PC-53':{cost:6,power:0,element:'DARK',                 ability:{en:'DROP: +1 PWR for each different element you have here.',ko:'DROP: 이 구역의 서로 다른 속성 수만큼 +1 PWR.'},effect:{kind:'buff_element_count',amt:1}},
  'PC-54':{cost:4,power:5,element:'LIGHT',                ability:{en:'DROP: +2 PWR to your lowest-PWR card here.',ko:'DROP: 이 구역의 내 최저파워 카드 +2 PWR.'},          effect:{kind:'buff_lowest',amt:2}},
  'PC-55':{cost:5,power:9,element:'SOUND',person:'XENA',  ability:{en:'DROP: +2 PWR to another card here.',ko:'DROP: 이 구역의 내 카드 전체 +2 PWR.'},                      effect:{kind:'buff_all_own',amt:2}}
};
/* 갤러리(R+) 카드 "같은 시리즈" 링크 효과 — ZENA_TCG_전체통합_카드DB_v1.md §3-2 공식.
   등급별 고정 보너스(R+1/S+2/SR+3/SSR+4)를 "이 구역에 같은 시리즈 카드가 또 있으면" 발동. */
var SERIES_LINK_AMT = { R:1, S:2, SR:3, SSR:4 };
/* series 그룹 판정: person 이 있으면 그걸로, 없으면 트랙아트/화보 계열, 그 외는 world */
function seriesOf(id, person){
  if(person) return person;
  if(id.indexOf('GA-AN') === 0 || id === 'TA-R-01' || id === 'TA-S-01' || id === 'TA-SR-03') return 'ANSWER';
  if(id.indexOf('GA-BR') === 0 || id === 'TA-R-02' || id === 'TA-S-02' || id === 'TA-SR-01') return 'BRIGHT';
  if(id.indexOf('GA-DP') === 0 || id === 'TA-R-03' || id === 'TA-SR-02') return 'DOPAMINE';
  if(id.indexOf('WS-') === 0) return 'WORLD';
  return null;
}

/* ── ID 접두어 → 인물 / 속성 / 트랙 ────────────────────────
   ZENA_TCG_전체통합_카드DB_v1.md §3-3 (대표 확정, 2026-07-22) 기준.
   TA(트랙아트)는 번호만으론 트랙 구분이 안 돼 카드ID 그대로 매핑(TA_MAP). */
var PREFIX = {
  XA:{ person:'XENA',                 element:'SOUND' },
  XB:{ person:'XENA',                 element:'SOUND' },
  XC:{ person:'XENA',                 element:'SOUND' },
  NX:{ person:'NIX-09',               element:'SOUL'  },
  LY:{ person:'LYRA',                 element:'SOUL'  },
  NV:{ person:'NOVA',                 element:'SOUL'  },
  EC:{ person:'ECHO',                 element:'SOUL'  },
  BK:{ person:'BAEK',                 element:'DARK'  },
  NM:{ person:"NAYUN'S MOTHER",       element:'SOUL'  },
  DC:{ person:'THE DANCER',           element:'SOUL'  },
  AM:{ person:'ARCHITECT-MAN',        element:'DARK'  },
  SW:{ person:'SHADOW WATCHER',       element:'DARK'  },
  PG:{ person:'PALE-GOLD GUARDIAN',   element:'LIGHT' },
  HT:{ person:'HUNTER',               element:'METAL' },
  DG:{ person:'DRAGOON',              element:'METAL' },
  MS:{ person:'MOTHERSHIP',           element:'METAL' },
  L5:{ person:'LUCID-5',              element:'METAL' },
  L6:{ person:'LUCID-6',              element:'METAL' },
  DR:{ person:'DRONE',                element:'BUG'   },
  CL:{ person:'CLONE',                element:'BUG'   },
  MW:{ person:'MOOD WORKER',          element:'BUG'   },
  FW:{ person:'FIRST WHISTLER',       element:'SOUND' },
  WS:{ person:null,                   element:'BUG'   }   /* 세계관/시스템(메가시티·드론 등) */
};
/* 갤러리 에디션: 트랙별 화보 */
var GALLERY = {
  'GA-AN':{ person:'XENA', element:'SOUND', track:1 },
  'GA-BR':{ person:'XENA', element:'LIGHT', track:2 },
  'GA-DP':{ person:'XENA', element:'DARK',  track:3 }
};
/* 트랙아트(TA-*)는 번호가 트랙을 나타내지 않아 ID 그대로 매핑 */
var TA_MAP = {
  'TA-R-01':{ element:'SOUND', track:1 }, 'TA-S-01':{ element:'SOUND', track:1 }, 'TA-SR-03':{ element:'SOUND', track:1 },
  'TA-R-02':{ element:'LIGHT', track:2 }, 'TA-S-02':{ element:'LIGHT', track:2 }, 'TA-SR-01':{ element:'LIGHT', track:2 },
  'TA-R-03':{ element:'DARK',  track:3 }, 'TA-S-03':{ element:'DARK',  track:3 }, 'TA-SR-02':{ element:'DARK',  track:3 }
};

/* ── 이미지 경로 보정 ───────────────────────────────────────
   cards.js 의 경로는 games/gacha/ 기준입니다.
   같은 깊이(games/<게임>/)에서 쓰려면 상대경로만 앞에 붙이면 됩니다. */
var GACHA_BASE = '../gacha/';
function resolveImg(p){
  if(!p) return '';
  if(p.indexOf('../') === 0 || p.indexOf('http') === 0 || p.indexOf('/') === 0) return p;
  return GACHA_BASE + p;
}
/* [2026-07-24] TCG 전용(PC-*) 카드는 EN/KR 아트가 한 쌍으로 존재한다(카드 자체에
   기술/비용 등 정보가 그려져 있어 언어별로 그림이 다름). 현재 UI 언어에 맞는 아트를
   고른다 — 소유권은 언제나 하나(PC-01 등)뿐이고, 어느 버전을 뽑았든 상관없이 언어
   토글에 따라 같은 카드의 그림만 바뀐다. 언어를 바꿀 때는 각 게임이 XenaCards.refresh()
   를 호출해 다시 빌드해야 반영된다. */
function curLang(){
  try{ return document.documentElement.getAttribute('data-lang') === 'ko' ? 'ko' : 'en'; }catch(e){ return 'en'; }
}
function resolveCardImg(id, def3){
  if(id.indexOf('PC-') === 0 && curLang() === 'ko') return resolveImg('cards/' + id + '-kr.jpg');
  return resolveImg(def3);
}

/* ── 정규화 ─────────────────────────────────────────────── */
function normalize(def){
  var id = def[0];
  var grade = def[2];
  var base = GRADE_STATS[grade] || GRADE_STATS.N;
  var isTcg = id.indexOf('PC-') === 0;
  var tcgOverride = isTcg ? TCG_STATS[id] : null;

  var meta = TA_MAP[id] || GALLERY[id.slice(0,5)] || PREFIX[id.slice(0,2)] || { person:null, element:null };
  var track = meta.track || 0;
  var person = (tcgOverride && tcgOverride.person) || meta.person || null;
  var series = isTcg ? (tcgOverride && tcgOverride.person ? tcgOverride.person : null) : seriesOf(id, meta.person);

  var effect = null;
  if(tcgOverride && tcgOverride.effect){
    effect = tcgOverride.effect;
  } else if(!isTcg && series && SERIES_LINK_AMT[grade]){
    effect = { kind:'buff_self_if_series', series:series, amt:SERIES_LINK_AMT[grade] };
  }

  return {
    id:        id,
    name:      def[1],
    grade:     grade,
    img:       resolveCardImg(id, def[3]),
    available: def[4] === 1,

    person:    person,
    element:   (tcgOverride && tcgOverride.element) || meta.element || null,
    track:     track,
    series:    series,

    cost:      tcgOverride ? tcgOverride.cost : base.cost,
    power:     tcgOverride ? tcgOverride.power : base.power,

    ability:   (tcgOverride && tcgOverride.ability) || GRADE_ABILITY[grade] || null,
    effect:    effect,
    isTcg:     isTcg,
    dust:      DUST[grade] || 1,
    rank:      GRADE_RANK[grade] || 0,
    color:     GRADE_COLOR[grade] || '#b9b9c6',
    gradeLabel:GRADE_LABEL[grade] || grade
  };
}

var ALL = [], AVAIL = [], BY_ID = {};
function build(){
  var defs = global.ZENA_CARD_DEFS || [];
  ALL = []; AVAIL = []; BY_ID = {};
  for(var i = 0; i < defs.length; i++){
    var c = normalize(defs[i]);
    ALL.push(c);
    BY_ID[c.id] = c;
    if(c.available) AVAIL.push(c);
  }
}
build();

/* ── 소유권 원장 (zena_gacha_v1 — 읽기 전용) ────────────── */
var GACHA_KEY = 'zena_gacha_v1';
function readJSON(key, def){ try{ return JSON.parse(localStorage.getItem(key)) || def; }catch(e){ return def; } }
function writeJSON(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); return true; }catch(e){ return false; } }

function ownedMap(){
  var g = readJSON(GACHA_KEY, {});
  return g.owned || {};
}

var XenaCards = {
  GRADE_STATS: GRADE_STATS,
  GRADE_ABILITY: GRADE_ABILITY,
  ELEMENT_ABBR: ELEMENT_ABBR,
  ELEMENTS: ['SOUND','SOUL','DARK','LIGHT','METAL','BUG'],

  /** 배열 재파싱 (cards.js 를 나중에 로드한 경우) */
  refresh: build,
  /** 이미지 경로 기준 변경 — 예: 루트에서 쓰면 setBase('games/gacha/') */
  setBase: function(b){ GACHA_BASE = b; build(); },

  /** 전체 카드 (미출시 포함) */
  all:      function(){ return ALL.slice(); },
  /** 게임에 등장하는 카드만 */
  available:function(){ return AVAIL.slice(); },
  get:      function(id){ return BY_ID[id] || null; },

  /** 보유 카드 배열 (중복 수량은 count 필드로) */
  owned: function(){
    var om = ownedMap(), out = [];
    for(var id in om){
      if(!om.hasOwnProperty(id)) continue;
      var c = BY_ID[id];
      if(!c || !c.available) continue;
      var copy = {};
      for(var k in c) if(c.hasOwnProperty(k)) copy[k] = c[k];
      copy.count = om[id];
      out.push(copy);
    }
    out.sort(function(a,b){ return b.power - a.power || a.name.localeCompare(b.name); });
    return out;
  },
  ownsAny:  function(){ var om = ownedMap(); for(var k in om){ if(om[k] > 0 && BY_ID[k] && BY_ID[k].available) return true; } return false; },
  countOf:  function(id){ return ownedMap()[id] || 0; },

  /** 컬렉션 게이트용 — { unique, total, pct } */
  collection: function(){
    var om = ownedMap(), uniq = 0;
    for(var id in om){ if(om[id] > 0 && BY_ID[id] && BY_ID[id].available) uniq++; }
    var total = AVAIL.length;
    return { unique: uniq, total: total, pct: total ? uniq / total : 0 };
  },

  byElement: function(el){ return AVAIL.filter(function(c){ return c.element === el; }); },
  byPerson:  function(p){  return AVAIL.filter(function(c){ return c.person === p; }); },
  byGrade:   function(g){  return AVAIL.filter(function(c){ return c.grade === g; }); }
};

/* ── 지갑은 여기서 다루지 않는다 ─────────────────────────────
   XC는 games/shared-wallet.js 의 window.XenaWallet (서버 지갑,
   Firestore wallets/{uid}.credits) 이 유일한 출처다.
   이 파일은 카드 카탈로그/소유권(zena_gacha_v1, 아직 로컬)만 다룬다.
   같은 페이지에 games/shared-wallet.js 를 반드시 먼저/나중에 로드해서
   window.XenaWallet 을 직접 쓸 것 — 이름을 여기서 재정의하지 않는다. */

global.XenaCards = XenaCards;

})(window);
