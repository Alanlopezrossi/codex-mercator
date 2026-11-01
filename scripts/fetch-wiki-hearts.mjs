// One-off extraction (run by the "Wiki hearts" GitHub workflow, not by every build):
// renown heart NPCs, where they are and what they sell, from the archived copy of the Guild Wars 2 Wiki
// (the live wiki now requires signing in). Content of the wiki: GNU FDL 1.2, credited on the site.
// Output: data/heart-vendors.json (static, versioned in the repo).
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const BASE = 'https://web.archive.org/web/2025id_/https://wiki.guildwars2.com/wiki/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(page) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(BASE + page, { headers: { 'User-Agent': 'BazaarLedger-data (fansite; one-off extraction)' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch { /* retry */ }
    await sleep(3000 * (i + 1));
  }
  return null;
}
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const index = await get('Renown_heart');
if (!index) { console.error('Could not load the heart index'); process.exit(1); }
const lists = [...new Set([...index.matchAll(/href="\/wiki\/(List_of_hearts_in_[^"#]+)"/g)].map((m) => m[1]))];
console.log(`[hearts] ${lists.length} zones`);

const npcs = new Map();
for (const l of lists) {
  const h = await get(l);
  if (!h) continue;
  const zone = decodeURIComponent(l.replace('List_of_hearts_in_', '')).replace(/_/g, ' ');
  const $ = cheerio.load(h);
  $('table').each((_, t) => {
    const head = $(t).find('tr').first().children().map((__, c) => clean($(c).text())).get();
    const ni = head.indexOf('NPC');
    const ai = head.indexOf('Area');
    if (ni < 0) return;
    $(t).find('tr').slice(1).each((__, r) => {
      const cells = $(r).children();
      const a = $(cells[ni]).find('a').first();
      const href = a.attr('href');
      if (!href) return;
      const page = href.replace('/wiki/', '');
      if (!npcs.has(page)) npcs.set(page, { en: clean(a.text()), z: zone, a: clean($(cells[ai]).text()) });
    });
  });
  await sleep(300);
}
console.log(`[hearts] ${npcs.size} heart NPCs`);

const out = [];
const queue = [...npcs.entries()];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const [page, m] = queue.shift();
    const h = await get(page);
    if (!h) continue;
    const $ = cheerio.load(h);
    const es = (h.match(/wiki-es\.guildwars2\.com\/wiki\/([^"#?]+)/) || [])[1];
    // Only "Items offered" (not "Historical items").
    const items = [];
    let current = true;
    $('h2, table.npc').each((_, el) => {
      if (el.tagName === 'h2') { current = !/Historical items/i.test($(el).text()); return; }
      if (!current) return;
      const head = $(el).find('tr').first().children().map((__, c) => clean($(c).text())).get();
      const ci = head.indexOf('Cost');
      if (ci < 0) return;
      $(el).find('tr').slice(1).each((__, r) => {
        const cells = $(r).children();
        const a = $(cells[0]).find('a[title]').first();
        const name = clean(a.attr('title') || a.text());
        if (!name) return;
        const cell = $(cells[ci]);
        const amounts = clean(cell.text()).replace(/[^\d ]/g, ' ').trim().split(/\s+/).filter(Boolean);
        const curs = cell.find('a[title]').map((___, x) => clean($(x).attr('title'))).get().filter((x) => !/^Talk:/.test(x));
        items.push([name, amounts.join(' '), curs.join('+')]);
      });
    });
    out.push({ en: m.en, es: es ? decodeURIComponent(es).replace(/_/g, ' ') : '', z: m.z, a: m.a, it: items });
    await sleep(250);
  }
}));
out.sort((a, b) => a.z.localeCompare(b.z) || a.en.localeCompare(b.en));
fs.writeFileSync('data/heart-vendors.json', `${JSON.stringify({ source: 'Guild Wars 2 Wiki (archived copy at web.archive.org), GNU FDL 1.2', extractedAt: new Date().toISOString().slice(0, 10), npcs: out })}\n`);
console.log(`[hearts] wrote ${out.length} NPCs, ${out.reduce((s, x) => s + x.it.length, 0)} offers`);
