/* 2026-08-01 — canonical 90-card text/engine contract audit. */
'use strict';
const fs=require('fs'),vm=require('vm');
const sandbox={window:{},localStorage:{getItem(){return null}},document:{documentElement:{getAttribute(){return'en'}}}};
Object.assign(sandbox.window,{window:sandbox.window,localStorage:sandbox.localStorage,document:sandbox.document});vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('games/gacha/cards.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('shared/xena-cards.js','utf8'),sandbox);
const cards=sandbox.window.XenaCards.tcg(), clash=fs.readFileSync('games/signal-clash/index.html','utf8'), warfare=fs.readFileSync('games/tcg/client.js','utf8');
const kinds=[...new Set(cards.map(c=>c.effect&&c.effect.kind).filter(Boolean))].sort();
const failures=[];
if(cards.length!==90)failures.push(`canonical card count ${cards.length} != 90`);
kinds.forEach(kind=>{if(!clash.includes(`case '${kind}'`))failures.push(`Signal Clash missing ${kind}`);if(!warfare.includes(`case '${kind}'`))failures.push(`Signal Warfare missing ${kind}`);});
cards.forEach(c=>{
  if(!c.effect)return;
  const printed=[...String(c.ability&&c.ability.en||'').matchAll(/([+-])\s*(\d+)\s*PWR/gi)].map(m=>(m[1]==='-'?-1:1)*Number(m[2]));
  if(printed.length&&Number(c.effect.amt)!==Math.abs(printed[printed.length-1]))failures.push(`${c.id} text/effect amount mismatch`);
  if(!c.ability||!c.ability.en||!c.ability.ko)failures.push(`${c.id} missing bilingual ability`);
});
[
  ['PWR must not alter HP',!/function addPower\([^}]+card\.hp/s.test(warfare)],
  ['PC-21 next enemy handling',warfare.includes("card.id === 'PC-21'")],
  ['PC-41 next enemy handling',warfare.includes("card.id === 'PC-41'")&&clash.includes("c.id === 'PC-41'")],
  ['next-element constraint',warfare.includes('owner.nextBuff.el === card.element')],
  ['self-person excludes itself',warfare.includes("case 'buff_self_if_person': if (others.some")]
].forEach(([name,pass])=>{if(!pass)failures.push(name);});
const result={date:'2026-08-01',cards:cards.length,effectKinds:kinds.length,kinds,failures,status:failures.length?'FAIL':'PASS'};
fs.writeFileSync('scripts/tcg-effect-audit-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
