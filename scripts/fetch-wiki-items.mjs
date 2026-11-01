// One-off extraction (run by the "Wiki items" GitHub workflow, split into shards): the "Acquisition" section of every
// item page in the archived copy of the Guild Wars 2 Wiki (the live wiki now requires signing in).
// Only facts are kept: who sells it (vendor, area, zone, cost, notes), what contains it, where it is gathered,
// and what drops or rewards it. Wiki content: GNU FDL 1.2, credited on the site.
// Env: SHARD (0-based), SHARDS (total), LIMIT (optional, for a test run). Output: .cache/wiki-items-<SHARD>.json
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const SITE = process.env.SITE || 'https://codex-mercator.mindcuriosolab.workers.dev';
const BASE = 'https://web.archive.org/web/2025id_/https://wiki.guildwars2.com/wiki/';
const SHARD = Number(process.env.SHARD || 0);
const SHARDS = Number(process.env.SHARDS || 1);
const LIMIT = Number(process.env.LIMIT || 0);
const CONC = Number(process.env.CONC || 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'BazaarLedger-data (fansite; one-off extraction)' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
      if (r.status === 429) await sleep(30000);
    } catch { /* retry */ }
    await sleep(3000 * (i + 1));
  }
  return null;
}

// Item list (id, English name) from the site's own search index.
const home = await get(`${SITE}/en/`);
const searchFile = home.match(/data-search="([^"]+)"/)[1];
const tsv = await get(SITE + searchFile);
let list = tsv.split('\n').map((l) => l.split('\t')).filter((c) => c[0] && c[2]).map((c) => [Number(c[0]), c[2]]);
// One wiki page per name: items that share a name share the page.
const byName = new Map();
for (const [id, name] of list) { if (!byName.has(name)) byName.set(name, []); byName.get(name).push(id); }
let names = [...byName.keys()].filter((_, i) => i % SHARDS === SHARD);
if (LIMIT) names = names.slice(0, LIMIT);
console.log(`[wiki] shard ${SHARD + 1}/${SHARDS}: ${names.length} pages`);

// "1 Snowflake + 700 Karma": numbers followed by the currency/item link in the cost cell.
function costText($, cell) {
  const parts = [];
  let num = '';
  $(cell).contents().each((_, n) => {
    if (n.type === 'text') { const m = clean($(n).text()).match(/[\d,.]+(?:\s+for\s+[\d,.]+)?/); if (m) num = m[0]; return; }
    const a = $(n).is('a[title]') ? $(n) : $(n).find('a[title]').first();
    const title = clean(a.attr('title'));
    if (title && num) { parts.push(`${num} ${title}`); num = ''; }
    else { const m = clean($(n).text()).match(/[\d,.]+/); if (m) num = m[0]; }
  });
  return parts.join(' + ') || clean($(cell).text());
}

const KEY = (h) => (/^Sold by/i.test(h) ? 'sold' : /^Contained in/i.test(h) ? 'cont' : /^Gathered from|^Harvested|^Mined|^Logged/i.test(h) ? 'gath'
  : /^Dropped by/i.test(h) ? 'drop' : /^Rewarded by|^Reward/i.test(h) ? 'rew' : /^Salvaged from/i.test(h) ? 'salv' : null);

const out = {};
const why = { missing: 0, notItem: 0, noAcq: 0, empty: 0 };
const examples = [];
let pages = 0;
let found = 0;
const queue = [...names];
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const name = queue.shift();
    const ids = byName.get(name);
    const h = await get(BASE + encodeURIComponent(name.replace(/ /g, '_')).replace(/%2F/g, '/'), 3);
    pages++;
    if (pages % 500 === 0) console.log(`[wiki] ${pages}/${names.length} pages, ${found} with data`);
    await sleep(250);
    if (!h) { why.missing++; continue; }
    // The page must be the item's page (its infobox lists the API id).
    const id = ids.find((x) => new RegExp(`(ids=|item_id=|API[^0-9]{0,40})${x}\\b`).test(h)) || (ids.length === 1 && /Item infobox|infobox-item|class="infobox/i.test(h) ? ids[0] : 0);
    if (!id) { why.notItem++; if (examples.length < 3) examples.push(['notItem', name, h.slice(0, 300).replace(/\s+/g, ' '), (h.match(/infobox[^"]*/g) || []).slice(0, 4)]); continue; }
    const $ = cheerio.load(h);
    const acq = $('h2').filter((_, el) => /^Acquisition/i.test(clean($(el).text()))).first();
    if (!acq.length) { why.noAcq++; if (examples.length < 6) examples.push(['noAcq', name, $('h2').map((_, e) => clean($(e).text())).get().slice(0, 8)]); continue; }
    const rec = { title: name };
    let key = null;
    for (let el = acq.next(); el.length && !el.is('h2'); el = el.next()) {
      if (el.is('h3, h4')) { key = KEY(clean(el.text()).replace(/\[edit\]/, '')); continue; }
      if (!key) continue;
      if (key === 'sold') {
        el.find('table').addBack('table').each((_, t) => {
          const head = $(t).find('tr').first().children().map((__, c) => clean($(c).text())).get();
          const col = (n) => head.findIndex((x) => x.toLowerCase().startsWith(n));
          const [vi, ai, zi, ci, ni] = [col('vendor'), col('area'), col('zone'), col('cost'), col('notes')];
          if (vi < 0 || ci < 0) return;
          $(t).find('tr').slice(1).each((__, r) => {
            const c = $(r).children();
            if (c.length < 2) return;
            (rec.sold ||= []).push([clean($(c[vi]).text()), ai >= 0 ? clean($(c[ai]).text()) : '', zi >= 0 ? clean($(c[zi]).text()) : '', costText($, c[ci]), ni >= 0 ? clean($(c[ni]).text()) : '']);
          });
        });
      } else {
        el.find('li').addBack('li').each((_, li) => {
          const txt = clean($(li).clone().children('ul').remove().end().text());
          if (!txt || txt.length > 160) return;
          if (key === 'cont' || key === 'gath') (rec[key] ||= []).push(txt);
          else (rec.src ||= []).push([key, txt]);
        });
      }
    }
    if (rec.sold || rec.cont || rec.gath || rec.src) { for (const x of ids) out[x] = rec; found++; } else { why.empty++; if (examples.length < 9) examples.push(['empty', name, acq.nextAll().slice(0, 8).map((_, e) => e.tagName + ':' + clean($(e).text()).slice(0, 40)).get()]); }
  }
}));
fs.mkdirSync('.cache', { recursive: true });
fs.writeFileSync(`.cache/wiki-items-${SHARD}.json`, JSON.stringify(out));
console.log('[wiki] reasons', JSON.stringify(why));
if (LIMIT) console.log('[wiki] examples', JSON.stringify(examples).slice(0, 4000));
console.log(`[wiki] shard ${SHARD + 1}/${SHARDS} done: ${pages} pages, ${found} with acquisition data, ${Object.keys(out).length} items`);
