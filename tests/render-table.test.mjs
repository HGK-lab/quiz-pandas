import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exampleHTML, esc } from '../js/render-table.js';

const examples = JSON.parse(readFileSync(new URL('../data/examples.json', import.meta.url), 'utf8'));
const byId = (id) => examples.find((e) => e.id === id);

test('esc escapes html', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('deleted row is struck in before table', () => {
  const html = exampleHTML(byId('dropna_thresh'));
  assert.equal((html.match(/<tr class="del">/g) || []).length, 1);
});

test('changed cells marked in after table', () => {
  const html = exampleHTML(byId('fillna_dict_limit'));
  assert.equal((html.match(/class="chg"/g) || []).length, 2);
});

test('deleted column header struck, new column header marked', () => {
  assert.match(exampleHTML(byId('drop_columns')), /<th class="delc">게임시간<\/th>/);
  assert.match(exampleHTML(byId('rename_columns')), /<th class="chgc">Game시간<\/th>/);
});

test('text result rendered as pre', () => {
  assert.match(exampleHTML(byId('isnull_sum')), /<pre class="ex-text">[^<]*나이/);
});

test('two inputs both rendered', () => {
  const html = exampleHTML(byId('merge_outer'));
  assert.ok(html.includes('>df1<') && html.includes('>df2<'));
});

test('every example renders', () => {
  for (const e of examples) assert.ok(exampleHTML(e).includes('ex-code'), e.id);
});
