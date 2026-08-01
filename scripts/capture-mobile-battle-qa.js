/* 2026-08-01 — Chrome DevTools portrait smoke screenshots for both TCGs. */
'use strict';
const fs=require('fs');
const port=Number(process.argv[2]||9223), output=process.argv[3]||'qa-output';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function target(url){const res=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});return res.json();}
async function session(info){
  const ws=new WebSocket(info.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});ws.send(JSON.stringify({id:call,method,params}));});
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});return{ws,send};
}
async function evaluate(s,expression){return s.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});}
async function screenshot(s,name){const r=await s.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`${output}/${name}`,Buffer.from(r.data,'base64'));}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const clash=await session(await target('http://127.0.0.1:4173/games/signal-clash/'));await wait(3500);
  const clashIds=['PC-74','PC-08','PC-25','PC-09','PC-29','PC-51','PC-84','PC-56','PC-29','PC-35','PC-89','PC-72'];
  const clashCopies={};clashIds.forEach(id=>clashCopies[id]=(clashCopies[id]||0)+1);
  await evaluate(clash,`localStorage.setItem('xena_tcg_deck_v1',JSON.stringify({ids:${JSON.stringify(clashIds)},copiesMap:${JSON.stringify(clashCopies)}}));location.reload()`);await wait(3500);
  await evaluate(clash,`newGame();show('play');render();`);await wait(1200);await screenshot(clash,'signal-clash-portrait.png');clash.ws.close();
  const war=await session(await target('http://127.0.0.1:4173/games/tcg/'));await wait(3500);
  const warIds=['PC-02','PC-08','PC-56','PC-72','PC-74','PC-29','PC-03','PC-19','PC-45','PC-32','PC-37','PC-51','PC-01','PC-10','PC-50'];
  await evaluate(war,`localStorage.setItem('xena-signal-warfare-deck',JSON.stringify(${JSON.stringify(warIds)}));location.reload()`);await wait(3500);
  await evaluate(war,`document.querySelector('#start-pve').click()`);await wait(6000);await screenshot(war,'signal-warfare-portrait.png');war.ws.close();
  console.log('portrait screenshots captured');
})().catch(e=>{console.error(e);process.exitCode=1;});
