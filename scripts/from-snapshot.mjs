// Development only: converts a local snapshot (the data/ and src/ folders of the gw2-bazar project)
// into the same .cache/raw/ format that fetch-api.mjs produces, so you can build without hitting the API.
// Usage: SNAPSHOT_DIR=../gw2-bazar npm run build:snapshot
import fs from 'node:fs';
import path from 'node:path';

const SNAP = path.resolve(process.env.SNAPSHOT_DIR || '../gw2-bazar');
const OUT = path.resolve('.cache/raw');
fs.mkdirSync(OUT, { recursive: true });
const read = (f) => JSON.parse(fs.readFileSync(path.join(SNAP, f), 'utf8'));
const write = (f, d) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(d));

const detailed = read('data/items.json').list;
const index = read('src/items-index.json');
const col = Object.fromEntries(index.cols.map((c, i) => [c, i]));
const byId = new Map(detailed.map((x) => [x.id, x]));

const es = [];
const en = [];
for (const row of index.rows) {
  const id = row[col.id];
  const d = byId.get(id);
  const base = {
    id,
    type: row[col.type] || d?.type,
    rarity: row[col.rarity] || d?.rarity,
    level: row[col.level] ?? d?.level ?? 0,
    vendor_value: d?.vendor ?? 0,
    flags: d?.flags || [],
    game_types: d?.gameTypes || [],
    restrictions: [],
    chat_link: d?.chat || '',
    icon: d?.icon || '',
    details: row[col.sub] ? { type: row[col.sub] } : undefined,
  };
  es.push({ ...base, name: row[col.es] || d?.name, description: d?.desc || '' });
  en.push({ ...base, name: row[col.en] || d?.nameEn, description: '' });
  byId.delete(id);
}
for (const d of byId.values()) {
  const base = { id: d.id, type: d.type, rarity: d.rarity, level: d.level, vendor_value: d.vendor, flags: d.flags, game_types: d.gameTypes, restrictions: [], chat_link: d.chat, icon: d.icon, details: d.sub ? { type: d.sub } : undefined };
  es.push({ ...base, name: d.name, description: d.desc || '' });
  en.push({ ...base, name: d.nameEn, description: '' });
}

const prices = read('data/prices.json').list.map(([id, buy, buyQty, sell, sellQty]) => ({
  id, whitelisted: false, buys: { quantity: buyQty, unit_price: buy }, sells: { quantity: sellQty, unit_price: sell },
}));
const recipes = read('data/recipes.json').list;

const geo = read('src/geo.json');
function floor(lang) {
  const regions = {};
  for (const m of Object.values(geo.maps)) {
    const r = (regions[m.region] ||= { name: m.region, maps: {} });
    r.maps[m.id] = {
      id: m.id, name: lang === 'es' ? m.name : m.nameEn, min_level: m.level?.[0] ?? 0, max_level: m.level?.[1] ?? 0,
      continent_rect: m.rect, points_of_interest: {},
    };
  }
  const mapIndex = {};
  for (const r of Object.values(regions)) for (const m of Object.values(r.maps)) mapIndex[m.id] = m;
  for (const sc of geo.sectors || []) {
    const m = mapIndex[sc.map];
    if (m) (m.sectors ||= {})[sc.id] = { id: sc.id, name: lang === 'es' ? sc.name : sc.nameEn, coord: sc.coord };
  }
  for (const w of geo.waypoints) {
    const m = mapIndex[w.map];
    if (m) m.points_of_interest[w.id] = { id: w.id, name: lang === 'es' ? w.name : w.nameEn, type: 'waypoint', coord: w.coord, chat_link: w.chat };
  }
  return { texture_dims: geo.dims, regions };
}

write('items-es.json', es);
write('items-en.json', en);
write('recipes.json', recipes);
write('prices.json', prices);
write('floor-es.json', floor('es'));
write('floor-en.json', floor('en'));
let ach = { achievements: {}, items: {} };
try { ach = read('src/ach-items.json'); } catch { /* optional */ }
write('names.json', {
  currencies: [],
  maps: Object.values(geo.maps).map((m) => ({ id: m.id, en: m.nameEn, es: m.name })),
  // The snapshot only has Spanish achievement names.
  achievements: Object.entries(ach.achievements).map(([id, a]) => ({ id: Number(id), en: a[0], es: a[0] })),
  achRefs: ach.items,
});
write('meta.json', { source: 'snapshot', fetchedAt: new Date(read('data/prices.json').at).toISOString() });
console.log(`[snapshot] items ${es.length}, recipes ${recipes.length}, prices ${prices.length}`);
