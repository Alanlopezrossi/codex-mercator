// Smoke test + accessibility (axe-core) + screenshots against a running server (npm run dev).
// BASE=http://127.0.0.1:8787 node tests/e2e/smoke.mjs
// MOCK_API=1 answers the official API calls with the local build data (for environments without internet).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const OUT = process.env.SHOTS || 'tests/e2e/screenshots';
const MOCK = process.env.MOCK_API === '1';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home-es', '/es/'], ['home-en', '/en/'], ['root', '/'], ['items-es', '/es/items?q=ecto'], ['item-es', '/es/item/19721'],
  ['item-en', '/en/item/30689'], ['item-forge-es', '/es/item/30704'], ['bazaar-es', '/es/bazar'], ['bazaar-en', '/en/trading-post'],
  ['achievements-es', '/es/logros'], ['professions-en', '/en/professions'], ['gear-es', '/es/legendarios'], ['gear-en', '/en/legendary?rarity=1&slot=Weapon'], ['map-es', '/es/mapa'],
  ['calculator-es', '/es/calculadora'], ['calculator-tp-en', '/en/calculator#tp'], ['favorites-es', '/es/favoritos'], ['legal-es', '/es/legal'], ['privacy-en', '/en/privacy'],
  ['about-es', '/es/acerca'], ['notfound-es', '/es/no-existe'],
];

let mockPrices = null;
let mockItems = null;
function loadMock() {
  const dist = 'dist/data';
  const ver = fs.readdirSync(dist).find((d) => /^\d{8}T/.test(d));
  mockPrices = new Map(fs.readFileSync(path.join(dist, ver, 'prices.tsv'), 'utf8').split('\n').map((l) => {
    const [id, buy, bq, sell, sq] = l.split('\t').map(Number);
    return [id, { id, buys: { unit_price: buy, quantity: bq }, sells: { unit_price: sell, quantity: sq } }];
  }));
  mockItems = new Map();
  for (const lang of ['es', 'en']) for (const it of JSON.parse(fs.readFileSync(`.cache/raw/items-${lang}.json`, 'utf8'))) mockItems.set(`${lang}:${it.id}`, it);
}

const ICON_SVG = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#2a2f3d"/><circle cx="32" cy="32" r="16" fill="${c}"/></svg>`;

const browser = await chromium.launch();
const problems = [];
const results = [];
if (MOCK) loadMock();

async function newPage(viewport, theme) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'es-AR' });
  if (theme) await ctx.addInitScript((t) => { try { localStorage.setItem('cm-theme', t); } catch {} }, theme);
  if (MOCK) {
    await ctx.route('https://api.guildwars2.com/**', (route) => {
      const u = new URL(route.request().url());
      const ids = (u.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean);
      const lang = u.searchParams.get('lang') || 'en';
      let body = [];
      if (u.pathname === '/v2/commerce/prices') body = ids.map((id) => mockPrices.get(id)).filter(Boolean);
      else if (u.pathname === '/v2/items') body = ids.map((id) => mockItems.get(`${lang}:${id}`)).filter(Boolean);
      else return route.fulfill({ status: 503, body: '{}', headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
    });
    const colors = ['#6fb2ec', '#5fcf4d', '#f8d33a', '#ffaa33', '#ff5fa2', '#b47cff'];
    await ctx.route('https://render.guildwars2.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: ICON_SVG(colors[route.request().url().length % colors.length]) }));
    await ctx.route('https://tiles*.guildwars2.com/**', (route) => route.fulfill({ status: 404, body: '' }));
  }
  const page = await ctx.newPage();
  return { ctx, page };
}

for (const [name, url] of PAGES) {
  const { ctx, page } = await newPage({ width: 1280, height: 900 }, 'dark');
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|CORS|tiles/.test(m.text())) errors.push(`console: ${m.text()}`); });
  const res = await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => `ERR ${e.message}` }));
  await page.waitForTimeout(600);
  const status = res.status();
  await page.evaluate(AXE);
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  await page.screenshot({ path: path.join(OUT, `${name}-desktop.png`), fullPage: false });
  const expected = name.startsWith('notfound') ? 404 : 200;
  if (status !== expected) problems.push(`${url}: status ${status}`);
  for (const e of errors) problems.push(`${url}: ${e}`);
  for (const a of axe) problems.push(`${url}: axe ${a}`);
  results.push({ name, url, status, errors: errors.length, axe: axe.length });
  await ctx.close();
}

// Mobile and light theme
for (const [name, url, theme] of [['home-es', '/es/', 'dark'], ['gear-en', '/en/legendary', 'dark'], ['map-en', '/en/map', 'dark'], ['calc-en', '/en/calculator', 'light'], ['item-es', '/es/item/19721', 'dark'], ['bazaar-es', '/es/bazar', 'light'], ['items-en', '/en/items?q=mithril', 'light']]) {
  const { ctx, page } = await newPage({ width: 390, height: 844 }, theme);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) problems.push(`${url}: horizontal scroll at 390px`);
  await page.screenshot({ path: path.join(OUT, `${name}-mobile-${theme}.png`), fullPage: true });
  await ctx.close();
}
// Light theme on desktop with contrast check
{
  const { ctx, page } = await newPage({ width: 1280, height: 900 }, 'light');
  for (const [name, url] of [['item-es', '/es/item/19721'], ['home-en', '/en/']]) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.evaluate(AXE);
    const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2aa'] })).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    for (const a of axe) problems.push(`${url} [light]: axe ${a}`);
    await page.screenshot({ path: path.join(OUT, `${name}-desktop-light.png`) });
  }
  await ctx.close();
}

// Security headers
const head = await fetch(`${BASE}/es/item/19721`, { redirect: 'manual' });
const page2 = await fetch(`${BASE}/es/`);
for (const [label, r] of [['item redirect', head], ['static page', page2]]) {
  for (const h of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) if (!r.headers.get(h)) problems.push(`${label}: missing ${h}`);
}
await browser.close();
console.table(results);
if (problems.length) {
  console.log(`\n${problems.length} problems:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('\nOK: no errors, no serious/critical accessibility violations, headers present.');
