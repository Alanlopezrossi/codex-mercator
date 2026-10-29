// Formatting helpers shared by the Worker, the build and the browser. Everything that ends up in HTML goes through esc().

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Copper -> HTML with gold/silver/copper, e.g. 12g 3s 4c. */
export function coin(copper, { lang = 'en' } = {}) {
  if (copper == null || !Number.isFinite(Number(copper))) return '<span class="coin coin-none">—</span>';
  const n = Math.round(Number(copper));
  const neg = n < 0;
  const a = Math.abs(n);
  const g = Math.floor(a / 10000);
  const s = Math.floor((a % 10000) / 100);
  const c = a % 100;
  const parts = [];
  const fmt = (v) => v.toLocaleString(lang === 'es' ? 'es-AR' : 'en-US');
  if (g) parts.push(`<span class="cg">${fmt(g)}<abbr title="${lang === 'es' ? 'oro' : 'gold'}">g</abbr></span>`);
  if (g || s) parts.push(`<span class="cs">${s}<abbr title="${lang === 'es' ? 'plata' : 'silver'}">s</abbr></span>`);
  parts.push(`<span class="cc">${c}<abbr title="${lang === 'es' ? 'cobre' : 'copper'}">c</abbr></span>`);
  return `<span class="coin${neg ? ' neg' : ''}">${neg ? '−' : ''}${parts.join(' ')}</span>`;
}

/** Copper -> plain text (for meta descriptions). */
export function coinText(copper) {
  if (copper == null) return '';
  const a = Math.abs(Math.round(copper));
  const g = Math.floor(a / 10000);
  const s = Math.floor((a % 10000) / 100);
  const c = a % 100;
  return `${copper < 0 ? '-' : ''}${g ? `${g}g ` : ''}${g || s ? `${s}s ` : ''}${c}c`;
}

export function num(n, lang = 'en') {
  if (n == null) return '—';
  return Number(n).toLocaleString(lang === 'es' ? 'es-AR' : 'en-US');
}

// Trading post fees: 5% listing + 10% exchange, minimum 1c each.
export const listFee = (p) => (p > 0 ? Math.max(1, Math.round(p * 0.05)) : 0);
export const saleFee = (p) => (p > 0 ? Math.max(1, Math.round(p * 0.1)) : 0);
export const netSale = (p) => (p > 0 ? p - listFee(p) - saleFee(p) : 0);
/** Flip margin: list at sell price minus buying at buy price, after fees. */
export const margin = (buy, sell) => (buy > 0 && sell > 0 ? netSale(sell) - buy : null);

export const ICON_BASE = 'https://render.guildwars2.com/file/';
export function iconUrl(ic) {
  if (!ic) return '';
  return ic.startsWith('http') ? ic : ICON_BASE + ic;
}
