/* 2026-08-01 — deterministic XENA TCG Monte-Carlo/meta search. */
'use strict';
const fs = require('fs');
const vm = require('vm');

let seed = 0x58454e41;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function shuffle(a) { a = a.slice(); for (let i=a.length-1;i;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function loadCards() {
  const sandbox = { window:{}, localStorage:{getItem(){return null;}}, document:{documentElement:{getAttribute(){return 'en';}}} };
  sandbox.window.window=sandbox.window; sandbox.window.localStorage=sandbox.localStorage; sandbox.window.document=sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('games/gacha/cards.js','utf8'),sandbox);
  vm.runInContext(fs.readFileSync('shared/xena-cards.js','utf8'),sandbox);
  return sandbox.window.XenaCards.tcg().map(c=>JSON.parse(JSON.stringify(c)));
}
const cards=loadCards(), byId=Object.fromEntries(cards.map(c=>[c.id,c]));
let matches=0;

function zoneScore(own,opp){
  const od=own.map(()=>0), ed=opp.map(()=>0), ob=own.reduce((s,c)=>s+c.power,0), eb=opp.reduce((s,c)=>s+c.power,0);
  function apply(list,enemy,d,enemyD,base,enemyBase){
    list.forEach((c,i)=>{ const e=c.effect||{}; let targets;
      switch(e.kind){
        case'buff_element': list.forEach((x,k)=>{if(k!==i&&x.element===e.el)d[k]+=e.amt}); break;
        case'buff_self_if_element': if(list.some((x,k)=>k!==i&&x.element===e.el))d[i]+=e.amt; break;
        case'buff_person': list.forEach((x,k)=>{if(x.person===e.person)d[k]+=e.amt}); break;
        case'buff_self_if_person': if(list.some((x,k)=>k!==i&&x.person===e.person))d[i]+=e.amt; break;
        case'buff_self_if_series': if(list.some((x,k)=>k!==i&&x.series===e.series))d[i]+=e.amt; break;
        case'buff_self_if_losing': if(base<enemyBase)d[i]+=e.amt; break;
        case'buff_self_if_only': if(list.length===1)d[i]+=e.amt; break;
        case'buff_self_if_outnumbered': if(enemy.length>list.length)d[i]+=e.amt; break;
        case'buff_self_if_no_element': if(!list.some(x=>x.element===e.el))d[i]+=e.amt; break;
        case'buff_self_if_lowerother': if(list.some((x,k)=>k!==i&&x.power<c.power))d[i]+=e.amt; break;
        case'buff_self_flat': d[i]+=e.amt; break;
        case'buff_all_own': list.forEach((x,k)=>d[k]+=e.amt); break;
        case'buff_others': targets=list.map((x,k)=>({x,k})).filter(v=>v.k!==i).sort((a,b)=>a.x.power-b.x.power); if(targets[0])d[targets[0].k]+=e.amt; break;
        case'buff_next_only': { const k=list.findIndex((x,k)=>k>i&&(!e.el||x.element===e.el)); if(k>=0)d[k]+=e.amt; } break;
        case'buff_lowest': { const t=list.map((x,k)=>({x,k})).sort((a,b)=>a.x.power-b.x.power)[0]; if(t)d[t.k]+=e.amt; } break;
        case'buff_element_count': d[i]+=new Set(list.map(x=>x.element).filter(Boolean)).size*e.amt; break;
        case'debuff_enemy_one': if(enemy.length){let k=enemy.reduce((best,x,n)=>x.power>enemy[best].power?n:best,0);enemyD[k]-=e.amt;} break;
        case'debuff_enemy_all': if(c.id==='PC-41'){const k=enemy.findIndex(x=>(x._playedAt||0)>(c._playedAt||0));if(k>=0)enemyD[k]-=e.amt;}else enemy.forEach((x,k)=>enemyD[k]-=e.amt); break;
      }
    });
  }
  apply(own,opp,od,ed,ob,eb); apply(opp,own,ed,od,eb,ob);
  return {own:own.reduce((s,c,i)=>s+Math.max(0,c.power+od[i]),0),opp:opp.reduce((s,c,i)=>s+Math.max(0,c.power+ed[i]),0)};
}
function playClash(deckA,deckB){
  matches++;
  const d=[shuffle(deckA.map(id=>({...byId[id]}))),shuffle(deckB.map(id=>({...byId[id]})))];
  const hand=[d[0].splice(0,3),d[1].splice(0,3)], zones=Array.from({length:3},()=>[[],[]]); let seq=0;
  for(let turn=1;turn<=6;turn++) for(let side=0;side<2;side++){
    if(d[side].length)hand[side].push(d[side].shift()); let mana=turn;
    while(true){
      let best=null;
      hand[side].forEach((c,hi)=>{if(c.cost>mana)return; zones.forEach((z,zi)=>{if(z[side].length>=4)return;
        const before=zoneScore(z[side],z[1-side]); z[side].push({...c,_playedAt:seq+1}); const after=zoneScore(z[side],z[1-side]); z[side].pop();
        const contest=(after.own-after.opp)-(before.own-before.opp), value=contest+c.power*.04-rnd()*.08;
        if(!best||value>best.value)best={hi,zi,value,c};
      });});
      if(!best)break; hand[side].splice(best.hi,1); zones[best.zi][side].push({...best.c,_playedAt:++seq}); mana-=best.c.cost;
    }
  }
  let won=[0,0], total=[0,0]; zones.forEach(z=>{const s=zoneScore(z[0],z[1]);total[0]+=s.own;total[1]+=s.opp;if(s.own>s.opp)won[0]++;else if(s.opp>s.own)won[1]++;});
  return won[0]!==won[1]?won[0]>won[1]:(total[0]>=total[1]);
}
function randomDeck(size){
  const curve={1:2,2:3,3:3,4:2,5:1,6:1}, out=[];
  Object.keys(curve).forEach(cost=>{const pool=cards.filter(c=>c.cost===+cost);for(let i=0;i<curve[cost]&&out.length<size;i++)out.push(pick(pool).id);});
  while(out.length<size)out.push(pick(cards).id);return out.slice(0,size);
}
function mutate(deck){ const out=deck.slice(); out[Math.floor(rnd()*out.length)]=pick(cards).id; return out; }
function searchClash(){
  let population=Array.from({length:180},()=>randomDeck(12));
  for(let generation=0;generation<16;generation++){
    const scored=population.map(deck=>({deck,wins:Array.from({length:10},()=>playClash(deck,randomDeck(12))).filter(Boolean).length})).sort((a,b)=>b.wins-a.wins);
    const elite=scored.slice(0,24).map(x=>x.deck); population=elite.slice(); while(population.length<180)population.push(mutate(pick(elite)));
  }
  const finalists=population.slice(0,36).map(deck=>({deck,wins:Array.from({length:300},()=>playClash(deck,randomDeck(12))).filter(Boolean).length})).sort((a,b)=>b.wins-a.wins);
  return finalists[0];
}

function cardValue(c,mode){
  const amount=Number(c.effect&&c.effect.amt)||0, synergy=amount*(c.effect&&/^buff/.test(c.effect.kind)?1.15:.9);
  if(mode==='double')return c.power+(c.power+3)*.72+synergy*1.72-c.cost*.85;
  if(mode==='hp')return c.power*.72+(c.power+3)*1.05+synergy*.9-c.cost*.85;
  return c.power+(c.power+3)*.72+synergy-c.cost*.85;
}
function warfareDeck(mode){
  const ranked=cards.slice().sort((a,b)=>cardValue(b,mode)-cardValue(a,mode));
  const buckets=[[1,5],[2,4],[3,3],[4,2],[5,1]],out=[];
  buckets.forEach(([cost,count])=>{ranked.filter(c=>c.cost===cost).slice(0,count).forEach(c=>out.push(c.id));});
  while(out.length<15)out.push(ranked.find(c=>!out.includes(c.id)).id); return out.slice(0,15);
}
function playWarfare(deckA,deckB,mode){
  matches++; const d=[shuffle(deckA.map(id=>byId[id])),shuffle(deckB.map(id=>byId[id]))], core=[30,30], field=[[],[]], hand=[d[0].splice(0,5),d[1].splice(0,5)];
  for(let turn=1;turn<=14;turn++)for(let side=0;side<2;side++){
    if(d[side].length)hand[side].push(d[side].shift());let mana=Math.min(10,turn);
    hand[side].sort((a,b)=>cardValue(b,mode)-cardValue(a,mode));
    for(let i=0;i<hand[side].length&&field[side].length<7;){const c=hand[side][i];if(c.cost<=mana){mana-=c.cost;hand[side].splice(i,1);const bonus=(Number(c.effect&&c.effect.amt)||0);field[side].push({atk:c.power+bonus,hp:c.power+3+(mode==='double'?bonus:mode==='hp'?Math.round(bonus*1.5):0)});}else i++;}
    if(turn>1){field[side].forEach(a=>{const target=field[1-side].sort((x,y)=>x.hp-y.hp)[0];if(target)target.hp-=a.atk;else core[1-side]-=a.atk;});field[1-side]=field[1-side].filter(x=>x.hp>0);}
    if(core[1-side]<=0)return {win:side===0,turn,draw:false,margin:core[0]-core[1],boardHp:field.flat().reduce((s,x)=>s+x.hp,0),boardAtk:field.flat().reduce((s,x)=>s+x.atk,0)};
  }
  const board=value=>field[value].reduce((s,x)=>s+x.atk+x.hp,0), score=[core[0]*4+board(0),core[1]*4+board(1)];
  return {win:score[0]>score[1],turn:14,draw:score[0]===score[1],margin:score[0]-score[1],boardHp:field.flat().reduce((s,x)=>s+x.hp,0),boardAtk:field.flat().reduce((s,x)=>s+x.atk,0)};
}
function analyzeModes(){
  const modes=['double','hp','power'], result={};
  modes.forEach(mode=>{const deck=warfareDeck(mode);let firstWins=0,turns=0,draws=0,margin=0,boardHp=0,boardAtk=0;
    for(let i=0;i<5000;i++){const game=playWarfare(deck,deck,mode);if(game.win)firstWins++;turns+=game.turn;if(game.draw)draws++;margin+=game.margin;boardHp+=game.boardHp;boardAtk+=game.boardAtk;}
    result[mode]={games:5000,firstWinRate:firstWins/5000,averageTurns:turns/5000,drawRate:draws/5000,averageScoreMargin:margin/5000,averageSurvivingHp:boardHp/5000,averageSurvivingAtk:boardAtk/5000,deck};
  });return result;
}

const clash=searchClash(), modes=analyzeModes();
const result={seed:'0x58454e41',cardCount:cards.length,matches,signalClash:{wins:clash.wins,games:300,rate:clash.wins/300,deck:clash.deck},warfare:modes};
fs.writeFileSync('scripts/tcg-meta-result.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
