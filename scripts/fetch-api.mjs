// Downloads the official API data into .cache/raw/ (items in es/en, recipes, prices, map of Tyria).
// Runs in the Cloudflare build (Workers Builds) on every deploy.
import fs from 'node:fs';
import path from 'node:path';
import { get, getAllPages } from './lib/api.mjs';

const OUT = path.resolve('.cache/raw');
fs.mkdirSync(OUT, { recursive: true });
const write = (f, d) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(d));

const t0 = Date.now();
const [itemsEs, itemsEn, recipes, prices, floorEs, floorEn] = await Promise.all([
  getAllPages('/v2/items', { lang: 'es', label: 'items es' }),
  getAllPages('/v2/items', { lang: 'en', label: 'items en' }),
  getAllPages('/v2/recipes', { label: 'recipes' }),
  getAllPages('/v2/commerce/prices', { label: 'prices' }),
  get('/v2/continents/1/floors/1?lang=es').then((r) => r.data),
  get('/v2/continents/1/floors/1?lang=en').then((r) => r.data),
]);

write('items-es.json', itemsEs);
write('items-en.json', itemsEn);
write('recipes.json', recipes);
write('prices.json', prices);
write('floor-es.json', floorEs);
write('floor-en.json', floorEn);
write('meta.json', { source: 'api', fetchedAt: new Date().toISOString() });
console.log(`[fetch] items ${itemsEs.length}/${itemsEn.length}, recipes ${recipes.length}, prices ${prices.length} in ${Math.round((Date.now() - t0) / 1000)} s`);
