// Service worker: makes the site installable and usable with a bad connection.
// - Assets and data files are versioned and immutable: served from the cache once seen.
// - Pages: network first, the last copy seen when offline, else a short offline notice.
// - Third-party requests (live prices from the official API, icons) are never touched.
/* global __VERSION__ */
const VERSION = __VERSION__;
const STATIC = `bl-static-${VERSION}`;
const PAGES = 'bl-pages';
const DATA = 'bl-data';
const MAX_DATA = 300;
const MAX_PAGES = 120;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/es/', '/en/']).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('bl-static-') && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { c.put(req, res.clone()); if (max) trim(name, max); }
  return res;
}
async function page(req) {
  const c = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) { c.put(req, res.clone()); trim(PAGES, MAX_PAGES); }
    return res;
  } catch {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const es = new URL(req.url).pathname.startsWith('/es');
    const msg = es ? ['Sin conexión', 'No hay conexión a internet y esta página todavía no estaba guardada. Las páginas que ya visitaste se pueden ver sin conexión.', 'Reintentar'] : ['Offline', 'There is no internet connection and this page was not saved yet. Pages you already visited work offline.', 'Try again'];
    return new Response(`<!doctype html><html lang="${es ? 'es' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${msg[0]} · Bazaar Ledger</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1116;color:#ebe8e1;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px"><main><h1 style="color:#e0b85c">${msg[0]}</h1><p>${msg[1]}</p><p><a href="" style="color:#f3d27e">${msg[2]}</a></p></main></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) { e.respondWith(cacheFirst(req, STATIC)); return; }
  if (url.pathname.startsWith('/data/')) { e.respondWith(cacheFirst(req, DATA, MAX_DATA)); return; }
  if (req.mode === 'navigate') e.respondWith(page(req));
});
