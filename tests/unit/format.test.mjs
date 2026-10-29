import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, coinText, listFee, saleFee, netSale, margin } from '../../src/shared/format.js';
import { slugify, itemPath, pagePath } from '../../src/shared/i18n.js';
import { shardOf } from '../../src/shared/data.js';
import { segments } from '../../src/shared/events.js';

test('esc escapes HTML', () => {
  assert.equal(esc('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});
test('coins and fees', () => {
  assert.equal(coinText(123456), '12g 34s 56c');
  assert.equal(coinText(5), '5c');
  assert.equal(listFee(100), 5);
  assert.equal(saleFee(100), 10);
  assert.equal(listFee(1), 1); // minimum 1c
  assert.equal(netSale(10000), 8500);
  assert.equal(margin(8000, 10000), 500);
  assert.equal(margin(0, 10000), null);
});
test('slugs and paths', () => {
  assert.equal(slugify('Pegote de ectoplasma'), 'pegote-de-ectoplasma');
  assert.equal(slugify('Ñandú: «Ëxótico»'), 'nandu-exotico');
  assert.equal(itemPath('es', 19721, 'Pegote de ectoplasma'), '/es/item/19721-pegote-de-ectoplasma');
  assert.equal(pagePath('en', 'bazaar'), '/en/trading-post');
  assert.equal(pagePath('es', 'home'), '/es/');
});
test('shards', () => {
  assert.equal(shardOf(0), 0);
  assert.equal(shardOf(31), 0);
  assert.equal(shardOf(32), 1);
});
test('event schedule: a 2-hour cycle starting at 00:00 UTC', () => {
  const ev = { p: [], q: [[1, 15], [0, 105]] };
  const s = segments(ev, 0, 240);
  assert.deepEqual(s.filter((x) => x.start >= 0).map((x) => [x.start, x.end]), [[0, 15], [120, 135]]);
});
