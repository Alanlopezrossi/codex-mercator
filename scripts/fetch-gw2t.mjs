// Optional: static data that the official API does not have, from the public gw2treasures.com API
// (container contents, items removed from the game, Mystic Forge recipes). Docs: https://gw2treasures.com/dev/api
// Needs the build variable GW2T_API_KEY (free key, register an application at gw2treasures.com/dev).
// Without the key, or if the API fails, the build goes on with the data already in data/.
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GW2T_API_KEY;
const OUT = path.resolve('.cache/raw/gw2t.json');
const API = 'https://api.gw2treasures.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastStatus = 0;
let lastBody = '';
async function get(p, params = {}) {
  const q = new URLSearchParams({ ...params, apiKey: KEY });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}${p}?${q}`, { headers: { 'User-Agent': 'BazaarLedger-build (+https://codex-mercator.mindcuriosolab.workers.dev)' }, signal: AbortSignal.timeout(60000) });
    if (res.ok || res.status === 206) return res.json();
    lastStatus = res.status;
    lastBody = (await res.text().catch(() => '')).slice(0, 120);
    if (res.status === 404) return [];
    if (res.status === 401) throw new Error('GW2T_API_KEY rejected (401)');
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`gw2treasures ${p} failed (HTTP ${lastStatus}${lastBody ? `: ${lastBody}` : ''})`);
}
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

if (!KEY) {
  console.log('[gw2t] GW2T_API_KEY not set: skipping (using data/ only)');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ error: 'GW2T_API_KEY not set', containers: {}, gone: {}, forge: {} }));
  process.exit(0);
}
const t0 = Date.now();
try {
  const official = new Set(JSON.parse(fs.readFileSync('.cache/raw/items-en.json', 'utf8')).map((x) => x.id));
  const wikiForge = new Set(Object.entries(JSON.parse(fs.readFileSync('data/wiki-data.json', 'utf8')).items || {}).filter(([, w]) => w.forge).map(([k]) => Number(k)));

  // 1. Container contents (all of them, in batches of 1000).
  const cIds = await get('/items', { 'container-contents': 'true' });
  const containers = {};
  for (const part of chunks(cIds, 200)) {
    for (const c of await get('/items/bulk/container-contents', { ids: part.join(',') })) {
      containers[c.id] = {
        i: c.contents.filter((x) => x.type === 'Item').map((x) => [x.id, x.quantity, x.chance]),
        c: c.contents.filter((x) => x.type === 'Currency').map((x) => [x.id, x.min, x.max]),
      };
    }
    await sleep(300);
  }

  // 2. Items that are no longer in the official API (removed from the game).
  const all = await get('/items');
  const goneIds = all.filter((id) => !official.has(id));
  const gone = {};
  for (const lang of ['en', 'es']) {
    for (const part of chunks(goneIds, 200)) {
      for (const it of await get('/items/bulk/data', { ids: part.join(','), lang })) if (it?.id) (gone[it.id] ||= {})[lang] = it;
      await sleep(300);
    }
  }

  // 3. Mystic Forge recipes for items the wiki data does not cover (one request per item, gently).
  const mfIds = (await get('/items', { 'mystic-forge': 'true' })).filter((id) => !wikiForge.has(id));
  const forge = {};
  for (const id of mfIds) {
    const recipes = await get(`/items/${id}/mystic-forge`);
    if (recipes.length) forge[id] = recipes.map((r) => ({ q: r.output_item_count_min || 1, qx: r.output_item_count_max || 0, i: r.ingredients.map((g) => [g.item_id, g.count]) }));
    await sleep(150);
  }

  fs.writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), containers, gone, forge }));
  console.log(`[gw2t] containers ${Object.keys(containers).length}, removed items ${Object.keys(gone).length}, forge ${Object.keys(forge).length} in ${Math.round((Date.now() - t0) / 1000)} s`);
} catch (e) {
  console.warn(`[gw2t] skipped: ${e.message}`);
  fs.writeFileSync(OUT, JSON.stringify({ error: e.message, containers: {}, gone: {}, forge: {} }));
}
