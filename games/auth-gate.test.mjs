import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pages = [
  'games/index.html', 'game/index.html',
  'games/gacha/index.html', 'games/idle/index.html', 'games/memory/index.html',
  'games/merge/index.html', 'games/neon-rush/index.html', 'games/raid/index.html',
  'games/shisen/index.html', 'games/signal/index.html', 'games/signal-clash/index.html',
  'games/stageguard/index.html', 'games/tcg/index.html', 'games/world-cup/index.html'
];

function source(relative) { return readFileSync(resolve(root, relative), 'utf8'); }

test('XENA Games hub and every playable game load the mandatory auth gate', () => {
  for (const page of pages) {
    const html = source(page);
    assert.match(html, /shared-auth-gate\.js/, `${page} is missing the Google sign-in gate`);
    assert.match(html, /shared-identity\.js/, `${page} is missing the identity provider`);
  }
});

test('logout hides gameplay records without destroying the account snapshot', () => {
  const identity = source('games/shared-identity.js');
  assert.match(identity, /clearGameLocalState\(/);
  assert.match(identity, /snapshotAccountLocalState\(/);
  assert.match(identity, /restoreAccountLocalState\(/);
  assert.match(identity, /ACCOUNT_CACHE_PREFIX/);
  assert.match(identity, /'zena_', 'og_'/);
  assert.match(identity, /'xena-lang': true/);
  assert.match(identity, /'xena_audio_v1': true/);
  assert.match(identity, /xena:session-cleared/);
});

test('login gate chooses Korean in Korea and English elsewhere', () => {
  const gate = source('games/shared-auth-gate.js');
  assert.match(gate, /api\.country\.is/);
  assert.match(gate, /code === 'KR' \? 'ko' : 'en'/);
});

test('gacha inventory is synchronized to the signed-in account', () => {
  const identity = source('games/shared-identity.js');
  const gacha = source('games/gacha/index.html');
  const functions = source('functions/index.js');
  assert.match(identity, /getGachaInventory/);
  assert.match(identity, /saveGachaInventory/);
  assert.match(gacha, /XenaGachaInventory\.save/);
  assert.match(functions, /exports\.getGachaInventory/);
  assert.match(functions, /exports\.saveGachaInventory/);
});

test('guest energy cannot bypass account authentication', () => {
  const wallet = source('games/shared-wallet.js');
  assert.match(wallet, /function isSignedIn\(/);
  assert.match(wallet, /if \(!isSignedIn\(\)\) return Promise\.reject\(new Error\('AUTH_REQUIRED'\)\)/);
  assert.doesNotMatch(wallet, /consumeGuestEnergy/);
});

test('gate blocks interaction until signed in and reloads away from stale in-memory state after logout', () => {
  const gate = source('games/shared-auth-gate.js');
  assert.match(gate, /identity && identity\.signedIn/);
  assert.match(gate, /eventShouldBeBlocked/);
  assert.match(gate, /document\.body\.inert/);
  assert.match(gate, /xena:session-cleared/);
  assert.match(gate, /window\.location\.replace\('\/games\/'\)/);
});
