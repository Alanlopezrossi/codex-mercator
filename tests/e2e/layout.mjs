// Layout audit: at several widths, looks for horizontal page scroll, text squeezed into a column so narrow
// that words break letter by letter, and elements that overflow the viewport.
// BASE=http://127.0.0.1:8787 MOCK_API=1 node tests/e2e/layout.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const OUT = 'tests/e2e/screenshots/layout';
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ['/en/', '/es/', '/en/trading-post', '/en/items?q=ecto', '/es/legendarios', '/en/legendary?slot=Armor', '/en/achievements', '/en/professions',
  '/en/map', '/es/calculadora', '/en/calculator#tp', '/es/item/30704', '/en/item/19721', '/es/item/30689', '/en/item/24295', '/es/legal', '/en/favorites'];
const WIDTHS = [360, 768, 1024, 1440];

let mock = null;
if (process.env.MOCK_API === '1') {
  const ver = fs.readdirSync('dist/data').find((d) => /^\d{8}T/.test(d));
  const prices = new Map(fs.readFileSync(`dist/data/${ver}/prices.tsv`, 'utf8').split('\n').map((l) => { const [id, b, bq, s, sq] = l.split('\t').map(Number); return [id, { id, buys: { unit_price: b, quantity: bq }, sells: { unit_price: s, quantity: sq } }]; }));
  const items = new Map();
  for (const lang of ['es', 'en']) for (const it of JSON.parse(fs.readFileSync(`.cache/raw/items-${lang}.json`, 'utf8'))) items.set(`${lang}:${it.id}`, it);
  mock = { prices, items };
}

const browser = await chromium.launch();
const problems = [];
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  if (mock) {
    await ctx.route('https://api.guildwars2.com/**', (route) => {
      const u = new URL(route.request().url());
      const ids = (u.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean);
      const lang = u.searchParams.get('lang') || 'en';
      let body = [];
      if (u.pathname === '/v2/commerce/prices') body = ids.map((id) => mock.prices.get(id)).filter(Boolean);
      else if (u.pathname === '/v2/items') body = ids.map((id) => mock.items.get(`${lang}:${id}`)).filter(Boolean);
      else return route.fulfill({ status: 503, body: '{}', headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
    });
    await ctx.route('https://render.guildwars2.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#a33"/></svg>' }));
    await ctx.route('https://tiles*.guildwars2.com/**', (r) => r.fulfill({ status: 404, body: '' }));
  }
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px)`);
      const scrollers = new Set([...document.querySelectorAll('.table-wrap, .evt-scroll, .prof-tabs, .nav-inline, .map-results, .gmap, .chip-row')]);
      const insideScroller = (el) => { for (let n = el.parentElement; n; n = n.parentElement) if (scrollers.has(n)) return true; return false; };
      for (const el of document.querySelectorAll('main *')) {
        if (!el.offsetParent || insideScroller(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0) { out.push(`overflows viewport: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`); continue; }
        // Text broken inside words: more line boxes than words.
        if (el.children.length === 0 && el.textContent.trim().length > 3) {
          const words = el.textContent.trim().split(/\s+/).length;
          const range = document.createRange();
          range.selectNodeContents(el);
          const tops = new Set([...range.getClientRects()].map((x) => Math.round(x.top)));
          if (tops.size > words) out.push(`word broken across lines: "${el.textContent.trim().slice(0, 30)}" in ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
        }
      }
      return [...new Set(out)].slice(0, 8);
    });
    for (const x of res) problems.push(`${w}px ${p}: ${x}`);
    const name = `${w}-${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}.png`;
    if ([360, 1440].includes(w)) await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  }
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Layout OK at', WIDTHS.join(', '), 'px');
