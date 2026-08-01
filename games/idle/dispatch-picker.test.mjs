import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const idleHtml = readFileSync(resolve(here, 'index.html'), 'utf8');
const cardsSource = readFileSync(resolve(here, '../../shared/xena-cards.js'), 'utf8');

function extractFunction(source, name) {
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

test('SEND CARDS picker renders every canonical element before opening the modal', () => {
  const elementsMatch = cardsSource.match(/ELEMENTS:\s*\[([^\]]+)\]/);
  assert.ok(elementsMatch, 'canonical XenaCards.ELEMENTS must exist');
  const elements = [...elementsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const labelsMatch = idleHtml.match(/var ELEMENT_LABEL = (\{[\s\S]*?\});/);
  assert.ok(labelsMatch, 'LIVE TOUR element labels must exist');

  const runPickerFilter = new Function(`
    var window = { XenaCards: { ELEMENTS: ${JSON.stringify(elements)} } };
    var XenaCards = window.XenaCards;
    var pickElemFilter = 'ALL';
    var rendered = '';
    var $ = function(){ return { set innerHTML(value){ rendered = value; } }; };
    var t = function(en){ return en; };
    var ELEMENT_LABEL = ${labelsMatch[1]};
    ${extractFunction(idleHtml, 'elementLabel')}
    ${extractFunction(idleHtml, 'renderPickElemFilter')}
    renderPickElemFilter();
    return rendered;
  `);

  const rendered = runPickerFilter();
  for (const element of elements) assert.match(rendered, new RegExp(`data-el="${element}"`));
  assert.match(idleHtml, /data-send[^\n]+openPicker|openPicker\(el\.getAttribute\('data-send'\)\)/);
  assert.match(idleHtml, /\$\('modal-pick'\)\.classList\.add\('on'\)/);
});
