/* 2026-07-28 — Verify the canonical XENA TCG Season 1 pool and assets. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const store = new Map();
const context = {
  console,
  document: { documentElement: { getAttribute: () => "en" } },
  localStorage: {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
  },
};
context.window = context;
vm.createContext(context);

for (const relative of ["games/gacha/cards.js", "shared/xena-cards.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const expectedIds = Array.from({ length: 90 }, (_, index) => `PC-${String(index + 1).padStart(2, "0")}`);
const defs = context.ZENA_CARD_DEFS;
const tcg = context.XenaCards.tcg();
const actualIds = tcg.map((card) => card.id);

assert.strictEqual(new Set(defs.map((def) => def[0])).size, defs.length, "Duplicate card IDs exist");
assert.deepStrictEqual(Array.from(actualIds), expectedIds, "TCG pool must be exactly PC-01..PC-90");
assert.strictEqual(tcg.length, 90, "TCG collection denominator must be 90");

for (const card of tcg) {
  assert.ok(Number.isFinite(card.cost), `${card.id} has no cost`);
  assert.ok(Number.isFinite(card.power), `${card.id} has no power`);
  assert.ok(card.element, `${card.id} has no element`);
  const extension = Number(card.id.slice(3)) >= 56 ? "png" : "jpg";
  for (const suffix of ["", "-kr"]) {
    const asset = path.join(root, "games", "gacha", "cards", `${card.id}${suffix}.${extension}`);
    assert.ok(fs.existsSync(asset), `Missing ${asset}`);
  }
}

store.set("zena_gacha_v1", JSON.stringify({
  owned: Object.fromEntries(expectedIds.map((id) => [id, 1])),
}));
assert.strictEqual(context.XenaCards.owned().filter((card) => card.isTcg).length, 90, "Owned TCG pool is incomplete");

const warfare = fs.readFileSync(path.join(root, "games/tcg/client.js"), "utf8");
const clash = fs.readFileSync(path.join(root, "games/signal-clash/index.html"), "utf8");
assert.ok(warfare.includes("source && source.tcg ? source.tcg()"), "SIGNAL WARFARE is not wired to the canonical pool");
assert.ok(clash.includes("XenaCards.tcg ? XenaCards.tcg()"), "SIGNAL CLASH AI is not wired to the canonical pool");
assert.ok(clash.includes("XenaCards.owned().filter(function(c){ return c.isTcg; })"), "SIGNAL CLASH deck builder is not TCG-only");
const effectKinds = [...new Set(tcg.map((card) => card.effect && card.effect.kind).filter(Boolean))];
for (const kind of effectKinds) {
  assert.ok(warfare.includes(`case '${kind}'`), `SIGNAL WARFARE does not implement ${kind}`);
  assert.ok(clash.includes(`case '${kind}'`), `SIGNAL CLASH does not implement ${kind}`);
}

console.log(JSON.stringify({
  definitions: defs.length,
  available: context.XenaCards.available().length,
  tcgCards: tcg.length,
  ownedTcgCards: context.XenaCards.owned().filter((card) => card.isTcg).length,
  assetsChecked: tcg.length * 2,
  effectKindsChecked: effectKinds.length,
  first: actualIds[0],
  last: actualIds[actualIds.length - 1],
}, null, 2));
