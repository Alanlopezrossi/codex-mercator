// Daily check against the real world: the official API endpoints the site uses and the live site pages.
// Run: SITE=https://… node tests/live-check.mjs   (exits with 1 and a list of problems if anything is wrong)
const SITE = (process.env.SITE || 'https://codex-mercator.mindcuriosolab.workers.dev').replace(/\/$/, '');
const API = 'https://api.guildwars2.com';
const problems = [];
async function check(url, test = () => true, label = url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'BazaarLedger-live-check' } });
    const body = await r.text();
    if (!r.ok) { problems.push(`${label}: HTTP ${r.status}`); return; }
    const why = test(body, r);
    if (why !== true) problems.push(`${label}: ${why || 'unexpected content'}`);
  } catch (e) { problems.push(`${label}: ${e.message}`); }
}
const json = (min) => (b) => { try { const d = JSON.parse(b); return (Array.isArray(d) ? d.length : Object.keys(d).length) >= min || `only ${Array.isArray(d) ? d.length : Object.keys(d).length} entries`; } catch { return 'not JSON'; } };
const page = (b) => (!/>\s*(undefined|NaN|null)\s*</.test(b) && b.includes('</html>')) || 'broken page';

await Promise.all([
  check(`${API}/v2/commerce/prices?ids=19721,24`, json(2), 'API prices'),
  check(`${API}/v2/items?ids=19721&lang=es`, json(1), 'API items'),
  check(`${API}/v2/achievements/categories/88?lang=es`, (b) => /achievements/.test(b) || 'no daily fractals', 'API daily fractals'),
  check(`${API}/v2/professions?ids=all&lang=es`, json(9), 'API professions'),
  ...['/es/', '/en/', '/es/bazar', '/es/items', '/es/legendarios', '/es/mercaderes', '/es/mazmorras', '/es/fractales', '/es/comparar', '/es/logros', '/es/profesiones', '/es/mapa', '/es/calculadora', '/es/item/19721', '/en/item/24', '/sitemap.xml', '/robots.txt', '/sw.js', '/es/apoyar']
    .map((p) => check(SITE + p, p.endsWith('.xml') || p.endsWith('.txt') || p.endsWith('.webmanifest') || p.endsWith('.js') ? () => true : page, `site ${p}`)),
]);
if (problems.length) { console.error(`Live check FAILED (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Live check OK');
