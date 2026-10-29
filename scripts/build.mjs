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
const eventNamesEs = readData('event-names-es.json');

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
for (const es of itemsEs) {
  const en = enById.get(es.id) || {};
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
  items.set(es.id, {
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
  });
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
for (const [k, w] of Object.entries(wiki.items)) {
  const it = items.get(Number(k));
  if (!it) continue;
  const ww = { title: w.title };
  if (w.forge) {
    ww.forge = w.forge;
    for (const f of w.forge) for (const [id] of f.i) if (id) {
      let s = usedIn.get(id);
      if (!s) usedIn.set(id, (s = new Set()));
      s.add(it.id);
    }
  }
  // The extraction sometimes glued several areas together ("Grand PiazzaFort Marriner..."): we drop those and keep the zone.
  if (w.sold) ww.sold = w.sold.map(([v, area, zone, cost, notes]) => [v, /[a-z'][A-Z]/.test(area || '') ? '' : area, /[a-z'][A-Z]/.test(zone || '') ? '' : zone, cost, notes]);
  if (w.cont) ww.cont = w.cont;
  if (w.gath) ww.gath = w.gath;
  it.w = ww;
}
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

// ---------- 4. Shards with denormalized references ----------
fs.rmSync(DIST, { recursive: true, force: true });
const DATA = path.join(DIST, 'data', dataVersion);
fs.mkdirSync(path.join(DATA, 'items'), { recursive: true });

const shards = new Map();
for (const it of items.values()) {
  const refIds = new Set();
  for (const r of it.rc || []) for (const [id] of r.i) refIds.add(id);
  for (const f of it.w?.forge || []) for (const [id] of f.i) if (id) refIds.add(id);
  for (const id of it.u || []) refIds.add(id);
  if (it.x.sfx) refIds.add(it.x.sfx);
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
// Each segment: name es/en, waypoint, wiki page, color (as in the wiki timer) and map position (exact point or its waypoint).
const mapEs = new Map(geo.maps.map((m) => [m.n[1], m.n[0]]));
const wpByChat = new Map(geo.wps.map((w) => [w.chat, w]));
const esName = (en) => eventNamesEs.names[en] || mapEs.get(en) || en;
const events = Object.entries(timers.events).map(([key, ev]) => ({
  key,
  c: [eventNamesEs.categories[ev.c] || ev.c, ev.c],
  n: [esName(ev.n), ev.n],
  s: Object.fromEntries(Object.entries(ev.s).map(([k, sg]) => {
    const wp = sg[2] ? wpByChat.get(sg[2]) : null;
    const pos = Array.isArray(sg[4]) ? sg[4].map(Math.round) : wp ? wp.c : null;
    return [k, { n: [esName(sg[0]), sg[0]], wp: sg[2] || '', wiki: sg[1] || '', col: sg[3] || null, pos, wpn: wp ? wp.n : null }];
  })),
  p: ev.p,
  q: ev.q,
}));
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
for (const f of ['cinzel-latin-600-normal.woff2', 'cinzel-latin-700-normal.woff2']) {
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
const CONTACT = process.env.CONTACT_EMAIL || 'contacto@codexmercator.com';
const pages = Object.fromEntries(Object.entries(renderStaticPages(meta, { popular })).map(([k, v]) => [k, v.replaceAll('contacto@codexmercator.com', CONTACT)]));
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

