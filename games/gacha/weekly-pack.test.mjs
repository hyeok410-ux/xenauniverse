import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'index.html'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function createHarness(spendImplementation, startingCredits = 6000) {
  const build = new Function('spendImplementation', 'startingCredits', `
    var uuid = 0;
    var crypto = { randomUUID:function(){ uuid += 1; return 'uuid-'+uuid; } };
    var window = { crypto:crypto, XenaWallet:{ spend:spendImplementation } };
    var wallet = { xc:startingCredits };
    var PACKS = { weekly:{ price:1500 } };
    var weeklyPurchasePending = false;
    var weeklyPurchaseRetryKey = null;
    var pulls = 0;
    var tickCooldowns = function(){};
    var toast = function(){};
    var t = function(en){ return en; };
    var doPull = function(pack){ if(pack === 'weekly') pulls += 1; };
    ${extractFunction('newPurchaseKey')}
    ${extractFunction('buyWeeklyExtra')}
    return { buyWeeklyExtra:buyWeeklyExtra, wallet:wallet, pulls:function(){return pulls;} };
  `);
  return build(spendImplementation, startingCredits);
}

test('paid WEEKLY PACK can be purchased twice with distinct idempotency keys', async () => {
  const calls = [];
  let credits = 6000;
  const harness = createHarness(async (amount, reason, key) => {
    calls.push({ amount, reason, key });
    credits -= amount;
    return { credits };
  });

  assert.deepEqual(await harness.buyWeeklyExtra(), { ok:true, result:{ credits:4500 } });
  assert.deepEqual(await harness.buyWeeklyExtra(), { ok:true, result:{ credits:3000 } });
  assert.equal(harness.pulls(), 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].reason, 'gacha_weekly_extra');
  assert.notEqual(calls[0].key, calls[1].key);
});

test('ambiguous failure retries with the same idempotency key', async () => {
  const keys = [];
  let attempt = 0;
  const harness = createHarness(async (_amount, _reason, key) => {
    keys.push(key);
    attempt += 1;
    if(attempt === 1) throw new Error('network response lost');
    return { credits:4500 };
  });

  assert.equal((await harness.buyWeeklyExtra()).ok, false);
  assert.equal((await harness.buyWeeklyExtra()).ok, true);
  assert.equal(harness.pulls(), 1);
  assert.equal(keys[0], keys[1]);
});
