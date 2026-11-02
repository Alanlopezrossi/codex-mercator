// Layout stability check (CLS) on the built site, with slow data and a slow CPU (like a phone on mobile data).
// Serves dist/ itself (static pages only). Fails when any page moves more than LIMIT. Usage: node tests/e2e/cls.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('dist');
const LIMIT = Number(process.env.CLS_LIMIT || 0.1);
const PAGES = ['/es/', '/en/', '/es/bazar', '/en/trading-post', '/es/mercaderes', '/en/vendors', '/es/logros', '/es/items', '/es/legendarios', '/es/mazmorras', '/es/fractales', '/es/comparar', '/es/apoyar', '/es/calculadora'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.tsv': 'text/plain' };

const server = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { r.writeHead(400); return r.end(); }
  if (p.endsWith('/')) f = path.join(f, 'index.html');
  else if (!fs.existsSync(f) && fs.existsSync(`${f}.html`)) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
let worst = 0;
const fails = [];
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 800 }]) {
  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // Slow data: local data files and the official API answer late. OFFLINE=1 answers the API with an error
    // (for environments without internet; pages that need the API then show their error state).
    await page.route(/\/data\/|api\.guildwars2\.com/, async (route) => { await new Promise((z) => setTimeout(z, 1500)); if (process.env.OFFLINE === '1' && /api\.guildwars2/.test(route.request().url())) return route.fulfill({ status: 503, body: '' }); return route.continue(); });
    await page.route(/render\.guildwars2\.com|tiles\.guildwars2\.com|cloudflareinsights|googlesyndication/, (route) => route.fulfill({ status: 204, body: '' }));
    await page.addInitScript(() => {
      window.__cls = 0; window.__src = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if (e.value > 0.01) window.__src.push(`${e.value.toFixed(3)} ${e.sources.map((s) => (s.node?.id ? `#${s.node.id}` : s.node?.nodeName || '?')).join(',')}`); } }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(6000);
    const { cls, src } = await page.evaluate(() => ({ cls: window.__cls, src: window.__src }));
    worst = Math.max(worst, cls);
    const line = `${viewport.width}px ${p} CLS ${cls.toFixed(3)}${src.length ? `  (${src.join(' | ')})` : ''}`;
    console.log(cls > LIMIT ? `FAIL ${line}` : `ok   ${line}`);
    if (cls > LIMIT) fails.push(line);
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(`\nWorst CLS ${worst.toFixed(3)} (limit ${LIMIT})`);
if (fails.length) { console.error(`${fails.length} page(s) over the limit`); process.exit(1); }
