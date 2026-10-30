// Generates dist/ (static pages, data, assets) and src/generated/meta.js (build metadata for the Worker).
// Input: .cache/raw/ (from fetch-api.mjs or from-snapshot.mjs) + data/ (wiki data and event timers, versioned in the repo).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import { LANGS, RARITIES, TYPE_KEYS, slugify } from '../src/shared/i18n.js';
import { SHARD_SIZE, shardOf } from '../src/shared/data.js';
import { renderStaticPages } from './pages.mjs';
import { securityHeaders } from '../src/shared/security.js';
import { makeTranslator } from './lib/wiki-i18n.mjs';

const ROOT = path.resolve('.');
const RAW = path.join(ROOT, '.cache/raw');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://codex-mercator.mindcuriosolab.workers.dev').replace(/\/$/, '');
const readRaw = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const readData = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const t0 = Date.now();

// ---------- 1. Load and validate ----------
const rawMeta = readRaw('meta.json');
const itemsEs = readRaw('items-es.json');
const itemsEn = readRaw('items-en.json');
const recipes = readRaw('recipes.json');
const prices = readRaw('prices.json');
const floorEs = readRaw('floor-es.json');
const floorEn = readRaw('floor-en.json');
const wiki = readData('wiki-data.json');
const timers = readData('event-timers.json');
const eventNames = readData('event-names.json');
const names = fs.existsSync(path.join(RAW, 'names.json')) ? readRaw('names.json') : { currencies: [], maps: [], achievements: [] };

const isApi = rawMeta.source === 'api';
const MIN = isApi ? { items: 60000, recipes: 10000, prices: 20000 } : { items: 1000, recipes: 1000, prices: 1000 };
const problems = [];
if (itemsEs.length < MIN.items || itemsEn.length < MIN.items) problems.push(`too few items (${itemsEs.length}/${itemsEn.length})`);
if (recipes.length < MIN.recipes) problems.push(`too few recipes (${recipes.length})`);
if (prices.length < MIN.prices) problems.push(`too few prices (${prices.length})`);
if (Math.abs(itemsEs.length - itemsEn.length) > itemsEs.length * 0.02) problems.push('es/en item counts differ by more than 2%');
if (problems.length) {
  // Failing here keeps the previous deployment online (the deploy step never runs).
  console.error(`[build] VALIDATION FAILED: ${problems.join('; ')}`);
  process.exit(1);
}

const builtAt = new Date().toISOString();
const dataVersion = builtAt.replace(/[-:]/g, '').slice(0, 13); // 20261029T1745

// ---------- 2. Normalize items ----------
const clean = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/?c(=[^>]*)?>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .trim();
const iconKey = (u) => String(u || '').replace('https://render.guildwars2.com/file/', '');

const enById = new Map(itemsEn.map((x) => [x.id, x]));
const items = new Map();
// gw2treasures.com public API data (optional, see scripts/fetch-gw2t.mjs).
const gw2t = fs.existsSync(path.join(RAW, 'gw2t.json')) ? readRaw('gw2t.json') : { containers: {}, gone: {}, forge: {} };
function normalize(es, en) {
  const d = es.details || {};
  const de = en.details || {};
  const x = {};
  if (d.weight_class) x.w = d.weight_class;
  if (d.defense) x.def = d.defense;
  if (d.min_power) x.pw = [d.min_power, d.max_power];
  if (d.damage_type) x.dt = d.damage_type;
  if (d.infix_upgrade?.attributes?.length) x.at = d.infix_upgrade.attributes.map((a) => [a.attribute, a.modifier]);
  if (d.infix_upgrade?.buff?.description) x.buff = [clean(d.infix_upgrade.buff.description), clean(de.infix_upgrade?.buff?.description)];
  if (d.bonuses?.length) x.bon = [d.bonuses.map(clean), (de.bonuses || []).map(clean)];
  if (d.description) x.eff = [clean(d.description), clean(de.description)];
  if (d.duration_ms) x.dur = d.duration_ms;
  if (d.size) x.size = d.size;
  if (d.charges) x.ch = d.charges;
  if (d.suffix_item_id) x.sfx = d.suffix_item_id;
  if (d.infusion_slots?.length) x.inf = d.infusion_slots.length;
  const nameEs = String(es.name || '').trim();
  const nameEn = String(en.name || '').trim();
  return {
    id: es.id,
    n: [nameEs, nameEn],
    d: [clean(es.description), clean(en.description)],
    t: es.type,
    st: d.type || '',
    r: es.rarity,
    l: es.level || 0,
    ic: iconKey(es.icon),
    v: es.vendor_value || 0,
    f: es.flags || [],
    g: es.game_types || [],
    c: es.chat_link || '',
    x,
  };
}
for (const es of itemsEs) items.set(es.id, normalize(es, enById.get(es.id) || {}));
// Items removed from the game: gw2treasures keeps their last known data.
for (const [k, g] of Object.entries(gw2t.gone || {})) {
  const id = Number(k);
  const es = g.es || g.en; const en = g.en || g.es;
  if (items.has(id) || !es?.name || !es.type) continue;
  items.set(id, { ...normalize({ ...es, id }, en), gone: 1 });
}
// Items that are no longer in the official API (removed from the game), kept from the previous project.
const extraItems = fs.existsSync(path.join(ROOT, 'data/items-extra.json')) ? readData('items-extra.json').items : {};
for (const [k, e] of Object.entries(extraItems)) {
  const id = Number(k);
  if (items.has(id)) continue;
  items.set(id, { id, n: [e.es || e.en, e.en || e.es], d: [e.desc || '', ''], t: e.type, st: e.sub || '', r: e.rarity, l: e.level || 0, ic: iconKey(e.icon), v: 0, f: [], g: [], c: '', x: {}, gone: 1 });
}

// ---------- 3. Recipes, "used in", wiki, prices ----------
const usedIn = new Map();
for (const r of recipes) {
  const out = items.get(r.output_item_id);
  if (!out) continue;
  const ing = (r.ingredients || []).filter((i) => i.type === 'Item' || i.item_id).map((i) => [i.id ?? i.item_id, i.count]);
  (out.rc ||= []).push({ id: r.id, d: r.disciplines || [], m: r.min_rating || 0, q: r.output_item_count || 1, i: ing, lf: (r.flags || []).includes('LearnedFromItem') ? 1 : 0 });
  for (const [id] of ing) {
    let s = usedIn.get(id);
    if (!s) usedIn.set(id, (s = new Set()));
    s.add(r.output_item_id);
  }
}
// Place names (regions, maps, areas, points of interest) English -> Spanish, from the official floor data.
const places = new Map();
for (const m of names.maps) if (m.en && m.es) places.set(m.en, m.es);
for (const [rid, reg] of Object.entries(floorEs.regions || {})) {
  const regEn = floorEn.regions?.[rid];
  if (regEn?.name) places.set(regEn.name, reg.name);
  for (const [mid, m] of Object.entries(reg.maps || {})) {
    const mEn = regEn?.maps?.[mid];
    if (!mEn) continue;
    if (mEn.name) places.set(mEn.name, m.name);
    for (const [sid, sc] of Object.entries(m.sectors || {})) if (mEn.sectors?.[sid]?.name) places.set(mEn.sectors[sid].name, sc.name);
    for (const [pid, p] of Object.entries(m.points_of_interest || {})) if (mEn.points_of_interest?.[pid]?.name) places.set(mEn.points_of_interest[pid].name, p.name);
  }
}
const achievements = new Map(names.achievements.map((a) => [a.en, a.es]));
const W = makeTranslator({ items, currencies: names.currencies, places, achievements });
let wikiTotal = 0;
let wikiOk = 0;
const tally = (ok) => { wikiTotal++; if (ok) wikiOk++; return ok; };
// The extraction sometimes glued several areas together ("Grand PiazzaFort Marriner..."): we drop those.
const glued = (x) => /[a-z'][A-Z]/.test(x || '');
for (const [k, w] of Object.entries(wiki.items)) {
  const it = items.get(Number(k));
  if (!it) continue;
  const ww = { title: w.title };
  if (w.forge) {
    // Ingredients without an ID: look the item up by its English name.
    ww.forge = w.forge.map((f) => ({ q: f.q, i: f.i.map(([id, n, title]) => [id || W.itemByEn.get(title)?.id || 0, n, title]) }));
    for (const f of ww.forge) for (const [id] of f.i) if (id) {
      let st = usedIn.get(id);
      if (!st) usedIn.set(id, (st = new Set()));
      st.add(it.id);
    }
  }
  if (w.sold) {
    ww.sold = w.sold.map(([v, area, zone, cost, notes]) => {
      const c = W.cost(cost);
      const nt = W.note(notes);
      tally(c[2]); tally(nt[2]);
      return { v: W.vendor(v), a: W.place(glued(area) ? '' : area), z: W.place(glued(zone) ? '' : zone), c: [c[0], c[1]], n: [nt[0], nt[1]], en: !(c[2] && nt[2]) };
    });
  }
  for (const key of ['cont', 'gath']) {
    if (!w[key]) continue;
    ww[key] = w[key].map((raw) => { const e = W.entry(raw); tally(e.ok); return e; });
  }
  it.w = ww;
}
console.log(`[build] wiki data: ${wikiOk}/${wikiTotal} entries translated to the game's Spanish names`);
const priceMap = new Map();
for (const p of prices) priceMap.set(p.id, [p.buys?.unit_price || 0, p.buys?.quantity || 0, p.sells?.unit_price || 0, p.sells?.quantity || 0]);

const rarityRank = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
for (const [id, set] of usedIn) {
  const it = items.get(id);
  if (!it) continue;
  // Most relevant first: higher rarity and level.
  it.u = [...set].filter((o) => items.has(o)).sort((a, b) => {
    const A = items.get(a); const B = items.get(b);
    return (rarityRank[B.r] - rarityRank[A.r]) || (B.l - A.l) || (a - b);
  }).slice(0, 48);
  it.uc = set.size;
}
for (const it of items.values()) if (priceMap.has(it.id)) it.tp = 1;

// Achievements that reward an item (r) or ask for it (p, collections).
const achById = new Map(names.achievements.map((a) => [a.id, [a.es, a.en]]));
for (const [id, refs] of Object.entries(names.achRefs || {})) {
  const it = items.get(Number(id));
  if (!it) continue;
  const list = refs.map(([aid, kind]) => (achById.has(aid) ? [aid, ...achById.get(aid), kind] : null)).filter(Boolean);
  if (list.length) it.ach = list.slice(0, 12);
}

// Container contents (what each bag/chest gives) and, inverted, which containers give each item.
const containers = fs.existsSync(path.join(ROOT, 'data/containers.json')) ? readData('containers.json').containers : {};
const curName = new Map(names.currencies.map((c) => [c.id, [c.es, c.en]]));
for (const [k, c] of Object.entries(gw2t.containers || {})) {
  // Fresher and more complete than the previous project's copy; currencies get their names in both languages.
  const cur = (c.c || []).filter(([id]) => curName.has(id)).map(([id, min, max]) => [id, min === max ? min : `${min}–${max}`, ...curName.get(id)]);
  containers[k] = { i: c.i, c: cur.length || !containers[k] ? cur : containers[k].c };
}
for (const [k, c] of Object.entries(containers)) {
  const box = items.get(Number(k));
  if (!box) continue;
  box.ct = c.i.filter(([id]) => items.has(id));
  if (c.c?.length) box.ctc = c.c;
  for (const [id, qty, kind] of box.ct) {
    const it = items.get(id);
    (it.ci ||= []).push([box.id, qty, kind]);
  }
}
for (const it of items.values()) if (it.ci) it.ci = it.ci.slice(0, 40);

// Mystic Forge recipes the wiki data lacks (gw2treasures).
for (const [k, recs] of Object.entries(gw2t.forge || {})) {
  const it = items.get(Number(k));
  if (!it || it.w?.forge) continue;
  it.mf = recs.map((r) => ({ q: r.q, qx: r.qx > r.q ? r.qx : 0, i: r.i.filter(([id]) => items.has(id)) })).filter((r) => r.i.length);
  if (!it.mf.length) { delete it.mf; continue; }
  for (const r of it.mf) for (const [id] of r.i) {
    const ing = items.get(id);
    if (ing && !(ing.u || []).includes(it.id) && (ing.u ||= []).length < 48) { ing.u.push(it.id); ing.uc = (ing.uc || 0) + 1; }
  }
}

// Hand-written guides (Spanish) from the previous project: attached to every item they mention.
const guidesData = fs.existsSync(path.join(ROOT, 'data/guides.json')) ? readData('guides.json') : { guides: {}, places: {} };
const guideRefs = new Map(); // guide key -> ids mentioned in its text
for (const [key, g] of Object.entries(guidesData.guides)) {
  const ids = new Set(g.items || []);
  const text = JSON.stringify(g);
  for (const m of text.matchAll(/\{\{(?:\d+×)?(\d+)\}\}/g)) ids.add(Number(m[1]));
  for (const [id] of g.needs || []) ids.add(id);
  guideRefs.set(key, ids);
  for (const id of g.items || []) { const it = items.get(id); if (it) (it.gd ||= []).push(key); }
}

// ---------- 4. Shards with denormalized references ----------
fs.rmSync(DIST, { recursive: true, force: true });
const DATA = path.join(DIST, 'data', dataVersion);
fs.mkdirSync(path.join(DATA, 'items'), { recursive: true });

const shards = new Map();
for (const it of items.values()) {
  const refIds = new Set();
  for (const r of it.rc || []) for (const [id] of r.i) refIds.add(id);
  for (const f of it.w?.forge || []) for (const [id] of f.i) if (id) refIds.add(id);
  for (const f of it.mf || []) for (const [id] of f.i) refIds.add(id);
  for (const e of [...(it.w?.cont || []), ...(it.w?.gath || [])]) if (e.id) refIds.add(e.id);
  for (const id of it.u || []) refIds.add(id);
  if (it.x.sfx) refIds.add(it.x.sfx);
  for (const [id] of it.ct || []) refIds.add(id);
  for (const [id] of it.ci || []) refIds.add(id);
  for (const key of it.gd || []) for (const id of guideRefs.get(key) || []) refIds.add(id);
  const refs = {};
  for (const id of refIds) {
    const o = items.get(id);
    if (o && id !== it.id) refs[id] = [o.n[0], o.n[1], o.r, o.ic];
  }
  const rec = { ...it };
  if (Object.keys(refs).length) rec.refs = refs;
  const s = shardOf(it.id);
  if (!shards.has(s)) shards.set(s, {});
  shards.get(s)[it.id] = rec;
}
let shardBytes = 0;
for (const [s, obj] of shards) {
  const json = JSON.stringify(obj);
  shardBytes += json.length;
  fs.writeFileSync(path.join(DATA, 'items', `${s}.json`), json);
}

// ---------- 5. Search index (one TSV for both languages, named by content hash so browsers keep it cached) and prices ----------
const typeIdx = Object.fromEntries(TYPE_KEYS.map((k, i) => [k, i]));
const tsvSafe = (s) => String(s).replace(/[\t\n\r]/g, ' ');
const hidden = (name) => !name || /^\(\(\d+\)\)$/.test(name);
const searchLines = [];
for (const it of [...items.values()].sort((a, b) => a.id - b.id)) {
  const [es, en] = it.n;
  if (hidden(es) && hidden(en)) continue;
  const nEs = hidden(es) ? en : es;
  const nEn = hidden(en) ? es : en;
  searchLines.push([it.id, tsvSafe(nEs), nEn === nEs ? '' : tsvSafe(nEn), rarityRank[it.r] ?? 1, typeIdx[it.t] ?? -1, it.l, it.tp ? 1 : 0].join('\t'));
}
const searchTsv = searchLines.join('\n');
const searchHash = crypto.createHash('sha256').update(searchTsv).digest('hex').slice(0, 12);
const searchFile = `/data/search/${searchHash}.tsv`;
fs.mkdirSync(path.join(DIST, 'data/search'), { recursive: true });
fs.writeFileSync(path.join(DIST, searchFile), searchTsv);
const priceLines = [...priceMap.entries()].sort((a, b) => a[0] - b[0]).filter(([id]) => items.has(id)).map(([id, p]) => [id, ...p].join('\t'));
fs.writeFileSync(path.join(DATA, 'prices.tsv'), priceLines.join('\n'));
// Trading post table per language (name + prices in one small file, so the page does not need the full search index).
for (const [li, lang] of LANGS.entries()) {
  const rows = [];
  for (const [id, p] of [...priceMap.entries()].sort((a, b) => a[0] - b[0])) {
    const it = items.get(id);
    if (!it || (!p[0] && !p[2])) continue;
    const name = it.n[li] || it.n[1 - li];
    if (hidden(name)) continue;
    const other = it.n[1 - li] && it.n[1 - li] !== name ? it.n[1 - li] : '';
    rows.push([id, tsvSafe(name), tsvSafe(other), rarityRank[it.r] ?? 1, typeIdx[it.t] ?? -1, ...p].join('\t'));
  }
  fs.writeFileSync(path.join(DATA, `tp-${lang}.tsv`), rows.join('\n'));
}

// Legendary and ascended gear: one row per item with how to get it (bit flags) and the icon.
const SRC = { forge: 1, craft: 2, ach: 4, vendor: 8, container: 16, tp: 32 };
const GEAR_TYPES = new Set(['Weapon', 'Armor', 'Trinket', 'Back', 'UpgradeComponent', 'Relic', 'Gathering', 'Tool']);
const gear = [];
for (const it of items.values()) {
  if (it.r !== 'Legendary' && it.r !== 'Ascended') continue;
  if (!GEAR_TYPES.has(it.t)) continue;
  if (hidden(it.n[0]) && hidden(it.n[1])) continue;
  let src = 0;
  if (it.w?.forge || it.mf) src |= SRC.forge;
  if (it.rc?.length) src |= SRC.craft;
  if (it.ach?.length) src |= SRC.ach;
  if (it.w?.sold?.length) src |= SRC.vendor;
  if (it.w?.cont?.length || it.ci?.length) src |= SRC.container;
  if (it.tp) src |= SRC.tp;
  gear.push([it.id, it.n[0], it.n[1], it.r === 'Legendary' ? 1 : 0, it.t, it.st || '', it.x.w || '', src, it.ic, it.l]);
}
gear.sort((a, b) => b[3] - a[3] || a[4].localeCompare(b[4]) || a[2].localeCompare(b[2]));
fs.writeFileSync(path.join(DATA, 'gear.json'), JSON.stringify({ src: SRC, rows: gear }));

// ---------- 6. Map of Tyria (maps and waypoints) ----------
function compactFloor() {
  const maps = [];
  const wps = [];
  const seen = new Set();
  for (const [rid, reg] of Object.entries(floorEs.regions || {})) {
    const regEn = floorEn.regions?.[rid] || reg;
    for (const [mid, m] of Object.entries(reg.maps || {})) {
      if (seen.has(m.id ?? mid)) continue;
      seen.add(m.id ?? mid);
      const mEn = regEn.maps?.[mid] || m;
      maps.push({ id: Number(m.id ?? mid), n: [m.name, mEn.name], reg: [reg.name, regEn.name], rect: m.continent_rect, lv: [m.min_level, m.max_level] });
      for (const [pid, p] of Object.entries(m.points_of_interest || {})) {
        if (p.type !== 'waypoint' || !p.name) continue;
        const pEn = mEn.points_of_interest?.[pid] || p;
        wps.push({ id: Number(p.id ?? pid), m: Number(m.id ?? mid), n: [p.name, pEn.name], c: p.coord.map(Math.round), chat: p.chat_link });
      }
    }
  }
  return { dims: floorEs.texture_dims || [81920, 114688], maps, wps };
}
const geo = compactFloor();
fs.writeFileSync(path.join(DATA, 'geo.json'), JSON.stringify(geo));

// ---------- 7. Events ----------
// Names: data/event-names.json (curated, game names) and, for maps, the official API.
const mapEs = new Map([...names.maps.map((m) => [m.en, m.es]), ...geo.maps.map((m) => [m.n[1], m.n[0]])]);
const wpByChat = new Map(geo.wps.map((w) => [w.chat, w]));
const missingEv = new Set();
const evName = (en, dict = eventNames.names) => {
  if (!en) return ['', ''];
  const d = dict[en];
  const es = d?.es || mapEs.get(en);
  if (!es) missingEv.add(en);
  return [es || en, d?.en || en];
};
const events = Object.entries(timers.events).map(([key, ev]) => ({
  key,
  c: evName(ev.c, eventNames.categories),
  n: evName(ev.n),
  s: Object.fromEntries(Object.entries(ev.s).map(([k, sg]) => {
    const wp = sg[2] ? wpByChat.get(sg[2]) : null;
    const pos = Array.isArray(sg[4]) ? sg[4].map(Math.round) : wp ? wp.c : null;
    return [k, { n: evName(sg[0]), wp: sg[2] || '', wiki: sg[1] || '', col: sg[3] || null, pos, wpn: wp ? wp.n : null }];
  })),
  p: ev.p,
  q: ev.q,
}));
if (missingEv.size) console.warn(`[build] events without a Spanish name (shown in English): ${[...missingEv].join(', ')}`);
for (const lang of LANGS) {
  const f = path.join(RAW, `ach-tree-${lang}.json`);
  if (fs.existsSync(f)) {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    const keep = (c) => ({ id: c.id, name: c.name, description: c.description, order: c.order, icon: c.icon, achievements: c.achievements });
    fs.writeFileSync(path.join(DATA, `ach-${lang}.json`), JSON.stringify({ groups: d.groups.map((g) => ({ id: g.id, name: g.name, order: g.order, categories: g.categories })), categories: d.categories.map(keep) }));
  }
}
// Guides for the Worker (item pages render them on the server).
fs.mkdirSync('src/generated', { recursive: true });
fs.writeFileSync('src/generated/guides.js', `// Generated by scripts/build.mjs. Do not edit.\nexport const GUIDES = ${JSON.stringify(guidesData)};\n`);
// Achievement guides from the wiki (English, GFDL), split by achievement ID so a category loads only what it needs.
if (fs.existsSync(path.join(ROOT, 'data/ach-guides.json'))) {
  const ag = readData('ach-guides.json').guides;
  const parts = new Map();
  const clean = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|i)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  for (const [id, g] of Object.entries(ag)) {
    const txt = clean(g.h);
    if (!txt) continue;
    const b = Math.floor(Number(id) / 250);
    if (!parts.has(b)) parts.set(b, {});
    parts.get(b)[id] = txt.slice(0, 4000);
  }
  fs.mkdirSync(path.join(DATA, 'achg'), { recursive: true });
  for (const [b, obj] of parts) fs.writeFileSync(path.join(DATA, 'achg', `${b}.json`), JSON.stringify(obj));
}
if (fs.existsSync(path.join(ROOT, 'data/achievements-extra.json'))) {
  fs.copyFileSync(path.join(ROOT, 'data/achievements-extra.json'), path.join(DATA, 'ach-extra.json'));
}
fs.writeFileSync(path.join(DATA, 'events.json'), JSON.stringify({ source: timers.source, at: timers.at, v: timers.v, events }));

// ---------- 8. Metadata ----------
const counts = { items: items.size, recipes: recipes.length, tradable: priceLines.length, waypoints: geo.wps.length };
fs.writeFileSync(path.join(DATA, 'meta.json'), JSON.stringify({ builtAt, dataVersion, source: rawMeta.source, pricesAt: rawMeta.fetchedAt, counts, shardSize: SHARD_SIZE }));

// ---------- 9. Assets: JS/CSS bundles and fonts ----------
const tmpAssets = path.join(ROOT, '.cache/assets');
fs.rmSync(tmpAssets, { recursive: true, force: true });
const pageEntries = fs.readdirSync('src/client/pages').filter((f) => f.endsWith('.js')).map((f) => `src/client/pages/${f}`);
await esbuild.build({
  entryPoints: { common: 'src/client/common.js', ...Object.fromEntries(pageEntries.map((p) => [`pages/${path.basename(p, '.js')}`, p])) },
  bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020'], outdir: tmpAssets, chunkNames: 'chunks/[name]-[hash]', legalComments: 'linked', logLevel: 'warning',
});
await esbuild.build({ entryPoints: ['src/client/theme.js'], bundle: false, minify: true, outfile: path.join(tmpAssets, 'theme.js'), logLevel: 'warning' });
await esbuild.build({
  entryPoints: { main: 'src/styles/main.css', map: 'src/styles/map.css' }, bundle: true, minify: true, outdir: tmpAssets, logLevel: 'warning',
  loader: { '.png': 'file', '.svg': 'file' }, assetNames: 'img/[name]-[hash]', external: ['*.woff2'],
});
fs.mkdirSync(path.join(tmpAssets, 'fonts'), { recursive: true });
for (const f of ['cinzel-latin-700-normal.woff2']) {
  fs.copyFileSync(path.join('node_modules/@fontsource/cinzel/files', f), path.join(tmpAssets, 'fonts', f));
}
const hash = crypto.createHash('sha256');
for (const f of walk(tmpAssets).sort()) hash.update(f.replace(tmpAssets, '')).update(fs.readFileSync(f));
const assetVersion = hash.digest('hex').slice(0, 10);
fs.cpSync(tmpAssets, path.join(DIST, 'assets', assetVersion), { recursive: true });

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

// ---------- 10. Static files, pages, SEO ----------
fs.cpSync('static', DIST, { recursive: true });
const meta = { siteUrl: SITE_URL, assetVersion, dataVersion, builtAt, counts, searchFile };
const POPULAR = [19721, 19976, 19675, 24295, 19685, 24277, 30689, 46731];
const popular = POPULAR.map((id) => items.get(id)).filter(Boolean).map((o) => ({ id: o.id, n: o.n, ic: o.ic, r: o.r }));
const CONTACT = process.env.CONTACT_EMAIL || 'contact@bazaarledger.com';
const pages = Object.fromEntries(Object.entries(renderStaticPages(meta, { popular })).map(([k, v]) => [k, v.replaceAll('contact@bazaarledger.com', CONTACT)]));
for (const [p, html] of Object.entries(pages)) {
  const f = path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');
  const file = p.endsWith('/') ? f : `${f}.html`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// Sitemaps: static pages + every item in both languages (max 45,000 URLs per file).
const urls = Object.keys(pages).filter((p) => !p.includes('404')).map((p) => SITE_URL + p);
for (const lang of LANGS) {
  const li = LANGS.indexOf(lang);
  for (const it of items.values()) {
    const name = it.n[li] || it.n[1 - li];
    if (hidden(name)) continue;
    urls.push(`${SITE_URL}/${lang}/item/${it.id}${slugify(name) ? `-${slugify(name)}` : ''}`);
  }
}
const chunk = 45000;
const sitemapFiles = [];
const today = builtAt.slice(0, 10);
for (let i = 0; i * chunk < urls.length; i++) {
  const body = urls.slice(i * chunk, (i + 1) * chunk).map((u) => `<url><loc>${u.replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('');
  const name = `sitemap-${i + 1}.xml`;
  fs.writeFileSync(path.join(DIST, name), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
  sitemapFiles.push(name);
}
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapFiles.map((f) => `<sitemap><loc>${SITE_URL}/${f}</loc><lastmod>${today}</lastmod></sitemap>`).join('')}</sitemapindex>`);
fs.mkdirSync(path.join(DIST, '.well-known'), { recursive: true });
fs.writeFileSync(path.join(DIST, '.well-known/security.txt'), `Contact: mailto:${CONTACT}\nExpires: ${new Date(Date.now() + 365 * 864e5).toISOString()}\nPreferred-Languages: es, en\nCanonical: ${SITE_URL}/.well-known/security.txt\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /data/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// Security and cache headers for static assets (the Worker adds its own to dynamic responses).
fs.writeFileSync(path.join(DIST, '_headers'), headersFile());
function headersFile() {
  const sec = securityHeaders();
  const lines = ['/*', ...Object.entries(sec).map(([k, v]) => `  ${k}: ${v}`)];
  lines.push('/assets/*', '  Cache-Control: public, max-age=31536000, immutable');
  lines.push('/data/*', '  Cache-Control: public, max-age=31536000, immutable', '  X-Robots-Tag: noindex');
  lines.push('/*.html', '  Cache-Control: public, max-age=0, s-maxage=600, must-revalidate');
  lines.push('/es/*', '  Cache-Control: public, max-age=0, s-maxage=600, must-revalidate');
  lines.push('/en/*', '  Cache-Control: public, max-age=0, s-maxage=600, must-revalidate');
  return `${lines.join('\n')}\n`;
}

// ---------- 11. Metadata for the Worker ----------
fs.mkdirSync('src/generated', { recursive: true });
fs.writeFileSync('src/generated/meta.js', `// Generated by scripts/build.mjs. Do not edit.\nexport const META = ${JSON.stringify(meta)};\n`);

const fileCount = walk(DIST).length;
console.log(`[build] ${items.size} items in ${shards.size} shards (${Math.round(shardBytes / 1e6)} MB), ${counts.tradable} prices, ${geo.wps.length} waypoints, ${events.length} events`);
console.log(`[build] ${Object.keys(pages).length} pages, ${urls.length} URLs in sitemap, ${fileCount} files in dist/, assets ${assetVersion}, data ${dataVersion} (${Math.round((Date.now() - t0) / 1000)} s)`);
if (fileCount > 19000) { console.error('[build] Too many files for Workers static assets (20,000 limit).'); process.exit(1); }

