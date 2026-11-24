import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, excludedFrom } from '../../scripts/fetch-wiki-events.mjs';

test('excludedFrom reads the festivals the wiki switched off', () => {
  assert.deepEqual(excludedFrom('{{Event timer|exclude=festival-lc,festival-ha,festival-db}}'), ['festival-lc', 'festival-ha', 'festival-db']);
  assert.deepEqual(excludedFrom('text {{event timer|style=x| exclude = festival-db }} more'), ['festival-db']);
  assert.deepEqual(excludedFrom('{{Event timer}}'), []);
});

test('convert maps the wiki format and keeps extra fields by segment name', () => {
  const wiki = { events: {
    t: { category: '', name: '', segments: { 1: { name: '', bg: 'transparent' } }, sequences: { partial: [], pattern: [{ r: 1, d: 15 }] } },
    'festival-ha': { category: 'Special Events', name: 'Halloween', segments: { 0: { name: '', bg: [1, 2, 3] }, 1: { name: 'Mad King Says', link: 'Your Mad King says...', chatlink: ' [&BBAEAAA=]', bg: [4, 5, 6] } }, sequences: { partial: [], pattern: [{ r: 1, d: 10 }, { r: 0, d: 110 }] } },
  } };
  const prev = { events: { 'festival-ha': { s: { 1: ['Mad King Says', '', '', [0, 0, 0], [49083, 31224], 'x'] } } } };
  const out = convert(wiki, prev);
  assert.equal(out.t, undefined);
  assert.deepEqual(out['festival-ha'], {
    c: 'Special Events', n: 'Halloween', l: '',
    s: { 0: ['', '', '', [1, 2, 3]], 1: ['Mad King Says', 'Your Mad King says...', '[&BBAEAAA=]', [4, 5, 6], [49083, 31224], 'x'] },
    p: [], q: [[1, 10], [0, 110]],
  });
});
