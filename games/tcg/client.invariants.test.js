/* Run with: node client.invariants.test.js */
'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var games = path.resolve(__dirname, '..');
var shared = fs.readFileSync(path.join(games, 'shared-battle-view.js'), 'utf8');
var client = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');

new Function(shared);
new Function(client);

['index.html', path.join('..', 'signal-clash', 'index.html')].forEach(function (relative) {
  var html = fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
  Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)).forEach(function (match, index) {
    try { new Function(match[1]); }
    catch (error) { throw new Error(relative + ' inline script ' + (index + 1) + ': ' + error.message); }
  });
});

function sourceOf(name) {
  var match = client.match(new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}'));
  assert(match, 'Missing function ' + name);
  return match[0];
}

var manaApi = new Function(sourceOf('canPayMana') + '\n' + sourceOf('spendMana') +
  '; return { canPayMana: canPayMana, spendMana: spendMana };')();
var actor = { mana: 2 };
assert.strictEqual(manaApi.canPayMana(actor, { cost: 3 }), false, 'over-cost card must be rejected');
assert.strictEqual(manaApi.spendMana(actor, { cost: 3 }), false, 'over-cost spend must fail');
assert.strictEqual(actor.mana, 2, 'failed spend must not mutate mana');
assert.strictEqual(manaApi.spendMana(actor, { cost: 2 }), true, 'affordable spend must pass');
assert.strictEqual(actor.mana, 0, 'successful spend must deduct exact cost without going negative');

var difficulty = client.match(/var DIFFICULTY = \{[\s\S]*?\n  \};/)[0];
assert(!/manaBonus|statBonus/.test(difficulty), 'AI difficulty must not contain hidden mana/stat bonuses');
assert(/AI CORE[^\n]*MANA[^\n]*ai\.mana[^\n]*ai\.maxMana/.test(client), 'AI current mana must be visible');
assert(client.includes('if (!canPayMana(ai, c) || !spendMana(ai, c)) break;'), 'AI mutation boundary invariant missing');

var indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('id="deck-slots"'), '15-slot deck container missing');
assert(client.includes('state.selected.splice(index, 1)'), 'slot-to-collection removal missing');
assert(client.includes('state.selected.push(c.id)'), 'collection-to-slot equip missing');

console.log('PASS: syntax, mana invariants, AI bonuses, AI mana UI, and deck-slot structure');
