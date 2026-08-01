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

test('logout clears gameplay records but preserves device preferences', () => {
  const identity = source('games/shared-identity.js');
  assert.match(identity, /clearGameLocalState\(/);
  assert.match(identity, /'zena_', 'og_'/);
  assert.match(identity, /'xena-lang': true/);
  assert.match(identity, /'xena_audio_v1': true/);
  assert.match(identity, /xena:session-cleared/);
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
