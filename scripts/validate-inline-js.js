/* 2026-08-01 — syntax-check inline scripts without executing browser code. */
'use strict';
const fs=require('fs');
const files=process.argv.slice(2);
let failed=false;
files.forEach(file=>{
  const html=fs.readFileSync(file,'utf8');let count=0;
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(!match[1].trim())continue;count++;
    try{new Function(match[1]);}catch(error){failed=true;console.error(`${file} inline script ${count}: ${error.message}`);}
  }
  console.log(`${file}: ${count} inline scripts parsed`);
});
if(failed)process.exitCode=1;
