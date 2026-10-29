// Minimal client for the official Guild Wars 2 API: rate limit, retries and pagination.
// The API allows ~300 requests per minute per IP (5/s sustained with a burst). We stay below that.

const BASE = process.env.GW2_API_BASE || 'https://api.guildwars2.com';
const RATE = Number(process.env.GW2_RATE || 4.5); // requests per second
const BURST = Number(process.env.GW2_BURST || 120);
const CONCURRENCY = Number(process.env.GW2_CONCURRENCY || 6);

let tokens = BURST;
let last = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function takeToken() {
  for (;;) {
    const now = Date.now();
    tokens = Math.min(BURST, tokens + ((now - last) / 1000) * RATE);
    last = now;
    if (tokens >= 1) { tokens -= 1; return; }
    await sleep(Math.ceil(((1 - tokens) / RATE) * 1000));
  }
}

export async function get(path, { retries = 6 } = {}) {
  const url = BASE + path;
  for (let attempt = 0; ; attempt++) {
    await takeToken();
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'codex-mercator-build/1.0 (+https://github.com/)' }, signal: AbortSignal.timeout(45000) });
    } catch (e) {
      if (attempt >= retries) throw new Error(`${path}: ${e.message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    // 206 = partial content (some ids failed). Accept it, the validation step checks totals.
    if (res.ok || res.status === 206) {
      return { data: await res.json(), headers: res.headers };
    }
    if (res.status === 404 && path.includes('page=')) return { data: [], headers: res.headers };
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = res.status === 429 ? 15000 : 1500 * 2 ** attempt;
      console.warn(`[api] ${res.status} ${path}, retrying in ${wait} ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
}

/** Downloads every page of an endpoint that supports ?page=&page_size=200. */
export async function getAllPages(endpoint, { lang, label = endpoint } = {}) {
  const q = (p) => `${endpoint}?page=${p}&page_size=200${lang ? `&lang=${lang}` : ''}`;
  const first = await get(q(0));
  const total = Number(first.headers.get('x-page-total') || 1);
  const out = [...first.data];
  let next = 1;
  let done = 1;
  async function worker() {
    while (next < total) {
      const p = next++;
      const { data } = await get(q(p));
      out.push(...data);
      done++;
      if (done % 25 === 0 || done === total) console.log(`[api] ${label}: ${done}/${total} pages`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}
