// Cloudflare Worker: item pages (rendered from the data shards), language redirect, 404 and security headers.
// Static files (pages, assets, data) are served by Workers Static Assets before reaching this code.
import { META } from '../generated/meta.js';
import { LANGS, DEFAULT_LANG, slugify, itemPath, t } from '../shared/i18n.js';
import { layout } from '../shared/layout.js';
import { renderItemBody, itemTitle, itemDescription, itemJsonLd } from '../shared/item-page.js';
import { shardPath } from '../shared/data.js';
import { iconUrl } from '../shared/format.js';
import { securityHeaders } from '../shared/security.js';

const ITEM_RE = /^\/(es|en)\/item\/(\d{1,7})(?:-([a-z0-9-]*))?\/?$/;
const SEC = securityHeaders();

function withHeaders(res, extra = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SEC, ...extra })) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function html(body, status = 200, cache = 'public, max-age=300, s-maxage=3600') {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, ...SEC } });
}

function redirect(location, status = 301) {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': status === 301 ? 'public, max-age=86400' : 'private, no-store', Vary: 'Accept-Language', ...SEC } });
}

function siteUrl(request) {
  // In production the canonical domain is the one set in SITE_URL at build time.
  return META.siteUrl || new URL(request.url).origin;
}

function preferredLang(request) {
  const al = (request.headers.get('Accept-Language') || '').toLowerCase();
  const parts = al.split(',').map((p) => {
    const [tag, q] = p.trim().split(';q=');
    return { lang: tag.slice(0, 2), q: q ? Number(q) : 1 };
  }).sort((a, b) => b.q - a.q);
  for (const p of parts) if (LANGS.includes(p.lang)) return p.lang;
  return DEFAULT_LANG;
}

const shardCache = new Map(); // per isolate: avoids re-reading the same shard on consecutive requests
async function loadShard(env, request, id) {
  const p = shardPath(META.dataVersion, id);
  if (shardCache.has(p)) return shardCache.get(p);
  const res = await env.ASSETS.fetch(new Request(new URL(p, request.url)));
  if (!res.ok) return null;
  const data = await res.json();
  if (shardCache.size > 24) shardCache.delete(shardCache.keys().next().value);
  shardCache.set(p, data);
  return data;
}

async function notFound(env, request, lang) {
  const res = await env.ASSETS.fetch(new Request(new URL(`/${lang}/404`, request.url)));
  const body = res.ok ? await res.text() : 'Not found';
  return html(body, 404, 'public, max-age=60');
}

async function itemPage(request, env, ctx, m) {
  const [, lang, idStr, slug = ''] = m;
  const id = Number(idStr);
  const cache = caches.default;
  const cacheKey = new Request(`${new URL(request.url).origin}/__item/${META.dataVersion}/${lang}/${id}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const want = hit.headers.get('X-Canonical-Slug') || '';
    if (want !== slug) return redirect(itemPath(lang, id, '') + (want ? `-${want}` : ''));
    return hit;
  }
  const shard = await loadShard(env, request, id);
  const it = shard?.[id];
  if (!it) return notFound(env, request, lang);
  const name = itemTitle(lang, it);
  const canonicalSlug = slugify(name);
  const base = siteUrl(request);
  const page = layout({
    lang,
    meta: { ...META, siteUrl: base },
    page: 'items',
    title: name,
    description: itemDescription(lang, it),
    alternates: { es: itemPath('es', id, itemTitle('es', it)), en: itemPath('en', id, itemTitle('en', it)) },
    body: renderItemBody(lang, it),
    scripts: ['item'],
    jsonLd: itemJsonLd(lang, it, base),
    ogImage: it.ic ? iconUrl(it.ic) : undefined,
    noindex: /^\(\(\d+\)\)$/.test(name),
  });
  const res = html(page);
  res.headers.set('X-Canonical-Slug', canonicalSlug);
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  if (slug !== canonicalSlug) return redirect(itemPath(lang, id, name));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...SEC } });
    }
    const path = url.pathname;
    try {
      // English by default; the Events page is the home page.
      if (path === '/' || path === '') return redirect(`/${DEFAULT_LANG}/`);
      if (path === '/en/events' || path === '/es/eventos') return redirect(path.slice(0, 4));
      if (path === '/es' || path === '/en') return redirect(`${path}/`);
      const m = path.match(ITEM_RE);
      if (m) return await itemPage(request, env, ctx, m);
      // Short /item/123 links -> preferred language.
      const short = path.match(/^\/item\/(\d{1,7})\/?$/);
      if (short) return redirect(`/${DEFAULT_LANG}/item/${short[1]}`);
      if (path.startsWith('/assets/') || path.startsWith('/data/')) {
        return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=60', ...SEC } });
      }
      const lang = path.startsWith('/es/') ? 'es' : path.startsWith('/en/') ? 'en' : preferredLang(request);
      return await notFound(env, request, lang);
    } catch (e) {
      console.error(e);
      return html(`<!doctype html><meta charset="utf-8"><title>Error</title><p>${t('en', 'error')}</p>`, 500, 'no-store');
    }
  },

  // Cron Trigger: asks Workers Builds for a new build (fresh API data). See docs/DEPLOY.md.
  async scheduled(event, env, ctx) {
    if (!env.DEPLOY_HOOK_URL) {
      console.warn('DEPLOY_HOOK_URL is not set: the data will not be refreshed automatically.');
      return;
    }
    ctx.waitUntil(fetch(env.DEPLOY_HOOK_URL, { method: 'POST' }).then((r) => console.log(`deploy hook: HTTP ${r.status}`)));
  },
};

export { withHeaders };
