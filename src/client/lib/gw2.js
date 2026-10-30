// Live calls to the official API from the browser (it allows CORS). Batched in groups of 200 IDs.
const API = 'https://api.guildwars2.com';
const itemCache = new Map();

async function getJson(path, { timeout = 25000 } = {}) {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(timeout), credentials: 'omit' });
  if (!res.ok && res.status !== 206) {
    // 404 with every ID invalid: return an empty list.
    if (res.status === 404) return [];
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function batched(endpoint, ids, extra = '') {
  const uniq = [...new Set(ids.map(Number).filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniq.length; i += 200) {
    const part = uniq.slice(i, i + 200);
    const data = await getJson(`${endpoint}?ids=${part.join(',')}${extra}`);
    if (Array.isArray(data)) out.push(...data);
  }
  return out;
}

/** Map id -> { buy, buyQty, sell, sellQty }. */
export async function prices(ids) {
  const data = await batched('/v2/commerce/prices', ids);
  return new Map(data.map((p) => [p.id, { buy: p.buys?.unit_price || 0, buyQty: p.buys?.quantity || 0, sell: p.sells?.unit_price || 0, sellQty: p.sells?.quantity || 0 }]));
}

/** Basic item data (icon, name) for the visible rows. Cached in memory. */
export async function items(ids, lang) {
  const missing = ids.filter((id) => !itemCache.has(`${lang}:${id}`));
  if (missing.length) {
    const data = await batched('/v2/items', missing, `&lang=${lang}`);
    for (const it of data) itemCache.set(`${lang}:${it.id}`, it);
  }
  return new Map(ids.map((id) => [id, itemCache.get(`${lang}:${id}`)]).filter(([, v]) => v));
}

export async function get(path, lang) {
  return getJson(`${path}${path.includes('?') ? '&' : '?'}lang=${lang}`);
}

export { batched };
