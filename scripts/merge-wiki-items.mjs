// Merges the shards from fetch-wiki-items.mjs into data/wiki-data.json (new data adds to what was already there).
import fs from 'node:fs';
import path from 'node:path';

const file = 'data/wiki-data.json';
const wiki = JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = process.argv[2] || '.cache';
let added = 0;
let updated = 0;
const uniq = (a) => [...new Map(a.map((x) => [JSON.stringify(x), x])).values()];
for (const f of fs.readdirSync(dir, { recursive: true }).map(String).filter((x) => /wiki-items-\d+\.json$/.test(x))) {
  const part = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [id, rec] of Object.entries(part)) {
    const cur = wiki.items[id];
    if (!cur) { wiki.items[id] = rec; added++; continue; }
    for (const k of ['sold', 'cont', 'gath', 'src']) if (rec[k]) cur[k] = uniq([...(cur[k] || []), ...rec[k]]);
    updated++;
  }
}
wiki.extractedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(wiki));
console.log(`[wiki] merged: ${added} new items, ${updated} updated, ${Object.keys(wiki.items).length} total`);
