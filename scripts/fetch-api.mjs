// Downloads the official API data into .cache/raw/ (items in es/en, recipes, prices, map of Tyria).
// Runs in the Cloudflare build (Workers Builds) on every deploy.
import fs from 'node:fs';
import path from 'node:path';
import { get, getAllPages } from './lib/api.mjs';

const OUT = path.resolve('.cache/raw');
fs.mkdirSync(OUT, { recursive: true });
const write = (f, d) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(d));

const t0 = Date.now();
const [itemsEs, itemsEn, recipes, prices, floorEs, floorEn, curEs, curEn, mapsEs, mapsEn, achEs, achEn] = await Promise.all([
  getAllPages('/v2/items', { lang: 'es', label: 'items es' }),
  getAllPages('/v2/items', { lang: 'en', label: 'items en' }),
  getAllPages('/v2/recipes', { label: 'recipes' }),
  getAllPages('/v2/commerce/prices', { label: 'prices' }),
  get('/v2/continents/1/floors/1?lang=es').then((r) => r.data),
  get('/v2/continents/1/floors/1?lang=en').then((r) => r.data),
  // Names used to translate the wiki data and the event timer into the game's own Spanish names.
  get('/v2/currencies?ids=all&lang=es').then((r) => r.data),
  get('/v2/currencies?ids=all&lang=en').then((r) => r.data),
  get('/v2/maps?ids=all&lang=es').then((r) => r.data),
  get('/v2/maps?ids=all&lang=en').then((r) => r.data),
  getAllPages('/v2/achievements', { lang: 'es', label: 'achievements es' }),
  getAllPages('/v2/achievements', { lang: 'en', label: 'achievements en' }),
]);
const pair = (es, en, f = (x) => x.name) => {
  const byId = new Map(es.map((x) => [x.id, f(x)]));
  return en.filter((x) => byId.has(x.id)).map((x) => ({ id: x.id, en: f(x), es: byId.get(x.id) }));
};
// Items each achievement rewards (r) or asks for (p), for "how to get it".
const achRefs = {};
for (const a of achEn) {
  for (const r of a.rewards || []) if (r.type === 'Item') (achRefs[r.id] ||= []).push([a.id, 'r']);
  for (const b of a.bits || []) if (b.type === 'Item') (achRefs[b.id] ||= []).push([a.id, 'p']);
}
write('names.json', { currencies: pair(curEs, curEn), maps: pair(mapsEs, mapsEn), achievements: pair(achEs, achEn), achRefs });

// Achievement groups and categories (small) are shipped with the site so the page never waits on the API for them.
for (const lang of ['es', 'en']) {
  const [groups, categories] = await Promise.all([
    get(`/v2/achievements/groups?ids=all&lang=${lang}`).then((r) => r.data),
    get(`/v2/achievements/categories?ids=all&lang=${lang}`).then((r) => r.data),
  ]);
  write(`ach-tree-${lang}.json`, { groups, categories });
}

write('items-es.json', itemsEs);
write('items-en.json', itemsEn);
write('recipes.json', recipes);
write('prices.json', prices);
write('floor-es.json', floorEs);
write('floor-en.json', floorEn);
write('meta.json', { source: 'api', fetchedAt: new Date().toISOString() });
console.log(`[fetch] items ${itemsEs.length}/${itemsEn.length}, recipes ${recipes.length}, prices ${prices.length} in ${Math.round((Date.now() - t0) / 1000)} s`);
