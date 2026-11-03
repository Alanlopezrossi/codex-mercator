// Price history of a trading post item: price per hour (last days) and per day (since it was first listed),
// units sold per day, and the period's low, high and average. Data: DataWars2 public API (api.datawars2.ie),
// fetched by the visitor's browser only when the card scrolls into view.
import { lang } from './env.js';
import { esc, coin, coinText, num } from '../../shared/format.js';

const API = 'https://api.datawars2.ie/gw2/v2/history';
const FIELDS = 'date,sell_price_avg,buy_price_avg,sell_price_min,sell_price_max,buy_price_min,buy_price_max,sell_sold,buy_sold';
const es = lang === 'es';
const L = (a, b) => (es ? a : b);
const RANGES = [['7d', L('7 días', '7 days'), 7], ['1m', L('1 mes', '1 month'), 31], ['3m', L('3 meses', '3 months'), 92], ['1y', L('1 año', '1 year'), 366], ['5y', L('5 años', '5 years'), 1827], ['all', L('Todo', 'All'), 0]];
const dateFmt = new Intl.DateTimeFormat(es ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat(es ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short' });
const hourFmt = new Intl.DateTimeFormat(es ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat(es ? 'es-AR' : 'en-US', { month: 'short', year: 'numeric' });

// Older days only have min/max: their midpoint stands in for the average.
const avg = (r, k) => r[`${k}_price_avg`] || (r[`${k}_price_min`] && r[`${k}_price_max`] ? Math.round((r[`${k}_price_min`] + r[`${k}_price_max`]) / 2) : 0);
const rows = (list) => list.map((r) => ({ t: Date.parse(r.date), s: avg(r, 'sell'), b: avg(r, 'buy'), ss: r.sell_sold ?? null, bs: r.buy_sold ?? null })).filter((r) => r.t && (r.s || r.b)).sort((a, b) => a.t - b.t);

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// Long ranges are grouped by week so the line stays readable (and light to draw).
function bucket(list, days) {
  if (list.length <= 400) return list;
  const size = days === 0 || days > 1000 ? 7 : 3;
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    const g = list.slice(i, i + size);
    const m = (k) => { const v = g.map((x) => x[k]).filter((x) => x); return v.length ? Math.round(v.reduce((a, x) => a + x, 0) / v.length) : 0; };
    const sum = (k) => (g.some((x) => x[k] != null) ? g.reduce((a, x) => a + (x[k] || 0), 0) / g.length : null);
    out.push({ t: g[0].t, s: m('s'), b: m('b'), ss: sum('ss'), bs: sum('bs'), n: g.length });
  }
  return out;
}

function niceTicks(min, max, n = 4, log = false) {
  if (log) {
    const a = Math.log10(Math.max(1, min));
    const b = Math.log10(Math.max(2, max));
    return Array.from({ length: n }, (_, i) => Math.round(10 ** (a + ((b - a) * i) / (n - 1))));
  }
  const span = max - min || max || 1;
  const step0 = span / (n - 1);
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const out = [];
  for (let v = lo; v <= max + step * 0.5 && out.length < 8; v += step) out.push(Math.max(0, Math.round(v)));
  return out;
}

const SVGNS = 'http://www.w3.org/2000/svg';

/** Price lines (sale price and buy order), one y-axis in coins, crosshair + tooltip. */
function priceChart(host, data, { hourly, log }) {
  const W = Math.max(280, host.clientWidth);
  const H = W < 560 ? 220 : 280;
  const pad = { l: W < 560 ? 64 : 84, r: 12, t: 12, b: 26 };
  const vals = data.flatMap((d) => [d.s, d.b]).filter((v) => v > 0);
  if (!vals.length) { host.innerHTML = ''; return; }
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min *= 0.95; max *= 1.05; }
  const ticks = niceTicks(min, max, 4, log);
  const yMin = log ? Math.max(1, Math.min(min, ticks[0])) : Math.min(min, ticks[0]);
  const yMax = Math.max(max, ticks.at(-1));
  const t0 = data[0].t;
  const t1 = data.at(-1).t || t0 + 1;
  const x = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (v) => {
    const f = log ? (Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin) || 1) : (v - yMin) / (yMax - yMin || 1);
    return H - pad.b - f * (H - pad.t - pad.b);
  };
  const line = (k) => data.filter((d) => d[k] > 0).map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const xt = [];
  const nx = W < 560 ? 3 : 6;
  for (let i = 0; i < nx; i++) xt.push(t0 + ((t1 - t0) * i) / (nx - 1));
  const fx = (t) => (hourly ? hourFmt : (t1 - t0 > 400 * 864e5 ? monthFmt : shortFmt)).format(t);
  host.innerHTML = `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(L('Gráfico del precio de venta y de la orden de compra', 'Chart of the sale price and the buy order'))}">
    ${ticks.filter((v) => v >= yMin && v <= yMax).map((v) => `<line class="hc-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="hc-tick" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(coinText(v))}</text>`).join('')}
    ${xt.map((t, i) => `<text class="hc-tick" x="${x(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'}">${esc(fx(t))}</text>`).join('')}
    <path class="hc-line hc-buy" d="${line('b')}"/>
    <path class="hc-line hc-sell" d="${line('s')}"/>
    <line class="hc-cross" y1="${pad.t}" y2="${H - pad.b}" x1="-10" x2="-10"/>
    <circle class="hc-dot hc-sell-dot" r="4" cx="-10" cy="-10"/><circle class="hc-dot hc-buy-dot" r="4" cx="-10" cy="-10"/>
    <rect class="hc-hit" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}"/>
  </svg><div class="hc-tip" hidden></div>`;
  hover(host, data, x, (d, cx) => {
    const svg = host.querySelector('svg');
    svg.querySelector('.hc-cross').setAttribute('x1', cx); svg.querySelector('.hc-cross').setAttribute('x2', cx);
    const sd = svg.querySelector('.hc-sell-dot'); const bd = svg.querySelector('.hc-buy-dot');
    sd.setAttribute('cx', d.s ? cx : -10); sd.setAttribute('cy', d.s ? y(d.s) : -10);
    bd.setAttribute('cx', d.b ? cx : -10); bd.setAttribute('cy', d.b ? y(d.b) : -10);
    return `<strong>${esc((hourly ? hourFmt : dateFmt).format(d.t))}${d.n > 1 ? ` · ${L(`promedio de ${d.n} días`, `${d.n}-day average`)}` : ''}</strong>
      <span><i class="hc-key hc-sell-key"></i>${L('Venta', 'Sell')}: ${d.s ? coin(d.s, { lang }) : '—'}</span>
      <span><i class="hc-key hc-buy-key"></i>${L('Orden de compra', 'Buy order')}: ${d.b ? coin(d.b, { lang }) : '—'}</span>`;
  });
}

/** Units sold per day (or hour): stacked bars, sold to buyers at the sale price + buy orders filled. */
function soldChart(host, data, { hourly }) {
  let pts = data.filter((d) => d.ss != null || d.bs != null);
  if (!pts.length) { host.innerHTML = `<p class="small muted">${L('No hay datos de unidades vendidas para este período.', 'No units-sold data for this period.')}</p>`; return; }
  const W = Math.max(280, host.clientWidth);
  // At least ~3 px per bar: on narrow screens, neighbouring days are averaged together.
  const room = Math.floor((W - 96) / 3);
  if (pts.length > room) {
    const g = Math.ceil(pts.length / room);
    const out = [];
    for (let i = 0; i < pts.length; i += g) {
      const c = pts.slice(i, i + g);
      const n = c.reduce((a, x) => a + (x.n || 1), 0);
      out.push({ t: c[0].t, ss: c.reduce((a, x) => a + (x.ss || 0) * (x.n || 1), 0) / n, bs: c.reduce((a, x) => a + (x.bs || 0) * (x.n || 1), 0) / n, n });
    }
    pts = out;
  }
  const H = W < 560 ? 150 : 170;
  const pad = { l: W < 560 ? 64 : 84, r: 12, t: 10, b: 24 };
  const max = Math.max(1, ...pts.map((d) => (d.ss || 0) + (d.bs || 0)));
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(max, ticks.at(-1));
  const t0 = pts[0].t;
  const t1 = pts.at(-1).t || t0 + 1;
  const bw = Math.max(1, (W - pad.l - pad.r) / pts.length - (pts.length > 120 ? 0 : 2));
  const x = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r - bw);
  const h = (v) => (v / top) * (H - pad.t - pad.b);
  const base = H - pad.b;
  const bars = pts.map((d) => {
    const a = h(d.ss || 0); const b = h(d.bs || 0); const X = x(d.t).toFixed(1);
    return `${a ? `<rect class="hc-bar hc-sell-bar" x="${X}" y="${(base - a).toFixed(1)}" width="${bw.toFixed(1)}" height="${a.toFixed(1)}"/>` : ''}${b ? `<rect class="hc-bar hc-buy-bar" x="${X}" y="${(base - a - b).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, b - (a ? 1 : 0)).toFixed(1)}"/>` : ''}`;
  }).join('');
  host.innerHTML = `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(L('Gráfico de unidades vendidas', 'Chart of units sold'))}">
    ${ticks.map((v) => `<line class="hc-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${base - h(v)}" y2="${base - h(v)}"/><text class="hc-tick" x="${pad.l - 8}" y="${base - h(v) + 4}" text-anchor="end">${esc(num(v, lang))}</text>`).join('')}
    ${bars}
    <line class="hc-cross" y1="${pad.t}" y2="${base}" x1="-10" x2="-10"/>
    <rect class="hc-hit" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${base - pad.t}"/>
  </svg><div class="hc-tip" hidden></div>`;
  hover(host, pts, (t) => x(t) + bw / 2, (d, cx) => {
    const c = host.querySelector('.hc-cross'); c.setAttribute('x1', cx); c.setAttribute('x2', cx);
    const n = (v) => (v == null ? '—' : num(Math.round(v), lang));
    return `<strong>${esc((hourly ? hourFmt : dateFmt).format(d.t))}${d.n > 1 ? ` · ${L('promedio por día', 'daily average')}` : ''}</strong>
      <span><i class="hc-key hc-sell-key"></i>${L('Compradas al precio de venta', 'Bought at the sale price')}: ${n(d.ss)}</span>
      <span><i class="hc-key hc-buy-key"></i>${L('Vendidas a órdenes de compra', 'Sold to buy orders')}: ${n(d.bs)}</span>
      <span>${L('Total', 'Total')}: ${n((d.ss || 0) + (d.bs || 0))}</span>`;
  });
}

// Nearest point to the pointer; keyboard: arrows move along the points when the chart has focus.
function hover(host, data, x, show) {
  const svg = host.querySelector('svg');
  const tip = host.querySelector('.hc-tip');
  const hit = svg.querySelector('.hc-hit');
  let idx = -1;
  const at = (i) => {
    idx = Math.max(0, Math.min(data.length - 1, i));
    const d = data[idx];
    const cx = x(d.t);
    tip.innerHTML = show(d, cx);
    tip.hidden = false;
    const scale = host.clientWidth / svg.viewBox.baseVal.width;
    const left = cx * scale;
    tip.style.left = `${Math.min(Math.max(0, left - tip.offsetWidth / 2), host.clientWidth - tip.offsetWidth)}px`;
  };
  const move = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * svg.viewBox.baseVal.width;
    let best = 0; let bd = Infinity;
    for (let i = 0; i < data.length; i++) { const dd = Math.abs(x(data[i].t) - px); if (dd < bd) { bd = dd; best = i; } }
    at(best);
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.setAttribute('tabindex', '0');
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); at((idx < 0 ? data.length : idx) + (e.key === 'ArrowRight' ? 1 : -1)); }
    if (e.key === 'Escape') tip.hidden = true;
  });
  svg.addEventListener('blur', () => { tip.hidden = true; });
}

function stats(list, all, isH) {
  const s = list.filter((d) => d.s);
  if (!s.length) return '';
  const lo = s.reduce((a, d) => (d.s < a.s ? d : a));
  const hi = s.reduce((a, d) => (d.s > a.s ? d : a));
  const last = s.at(-1);
  const first = s[0];
  const ch = first.s ? ((last.s - first.s) / first.s) * 100 : 0;
  const sold = list.filter((d) => d.ss != null || d.bs != null);
  const perDay = sold.length ? sold.reduce((a, d) => a + (d.ss || 0) + (d.bs || 0), 0) / sold.length : null;
  const since = all.find((d) => d.s || d.b);
  const tile = (label, value, note = '') => `<div class="hc-stat"><p class="hc-label">${esc(label)}</p><p class="hc-value">${value}</p>${note ? `<p class="hc-note">${note}</p>` : ''}</div>`;
  return `<div class="hc-stats">
    ${tile(L('Precio de venta', 'Sale price'), coin(last.s, { lang }), `<span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1).replace('.', es ? ',' : '.')}%</span> ${L('en el período', 'in the period')}`)}
    ${tile(L('Mínimo del período', 'Period low'), coin(lo.s, { lang }), esc(dateFmt.format(lo.t)))}
    ${tile(L('Máximo del período', 'Period high'), coin(hi.s, { lang }), esc(dateFmt.format(hi.t)))}
    ${tile(isH ? L('Vendidos por hora', 'Sold per hour') : L('Vendidos por día', 'Sold per day'), perDay == null ? '—' : esc(num(Math.round(perDay), lang)), L('promedio del período', 'period average'))}
    ${since ? tile(L('En el bazar desde', 'On the trading post since'), esc(dateFmt.format(since.t)), `${L('primer precio', 'first price')}: ${coin(since.s || since.b, { lang })}`) : ''}
  </div>`;
}

function tableHtml(list, hourly) {
  const recent = list.slice(-30).reverse();
  const n = (v) => (v == null ? '—' : num(Math.round(v), lang));
  return `<details class="hc-table"><summary>${L('Ver los datos en una tabla', 'See the data as a table')}</summary>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col" class="left">${L('Fecha', 'Date')}</th><th scope="col" class="num">${L('Venta', 'Sell')}</th><th scope="col" class="num">${L('Orden de compra', 'Buy order')}</th><th scope="col" class="num">${L('Vendidos', 'Sold')}</th></tr></thead>
    <tbody>${recent.map((d) => `<tr><td class="left">${esc((hourly ? hourFmt : dateFmt).format(d.t))}</td><td class="num">${d.s ? coin(d.s, { lang }) : '—'}</td><td class="num">${d.b ? coin(d.b, { lang }) : '—'}</td><td class="num">${d.ss == null && d.bs == null ? '—' : n((d.ss || 0) + (d.bs || 0))}</td></tr>`).join('')}</tbody></table></div></details>`;
}

/** Fills the history card of an item page. */
export function initHistory(box, id) {
  let daily = null;
  let hourly = null;
  let range = '1m';
  let log = false;
  try { range = localStorage.getItem('bl-hist-range') || range; } catch { /* blocked */ }
  const body = box.querySelector('.hc-body');
  const tabs = box.querySelector('.hc-ranges');
  tabs.innerHTML = RANGES.map(([k, label]) => `<button type="button" class="hc-range" data-r="${k}" aria-pressed="${k === range}">${esc(label)}</button>`).join('');

  const draw = () => {
    const isH = range === '7d';
    const src = isH ? hourly : daily;
    if (!src) return;
    if (!src.length) { body.innerHTML = `<p class="muted">${L('Todavía no hay historial para este ítem.', 'There is no history for this item yet.')}</p>`; return; }
    const days = RANGES.find((r) => r[0] === range)[2];
    const cut = days && !isH ? src.at(-1).t - days * 864e5 : 0;
    const list = src.filter((d) => d.t >= cut);
    const shown = isH ? list : bucket(list, days);
    body.innerHTML = `${stats(list, daily, isH)}
      <p class="hc-legend"><span><i class="hc-key hc-sell-key"></i>${L('Precio de venta', 'Sale price')}</span><span><i class="hc-key hc-buy-key"></i>${L('Orden de compra', 'Buy order')}</span></p>
      <div class="hc-chart" id="hcPrice"></div>
      <h3 class="h-sub">${isH ? L('Unidades vendidas por hora', 'Units sold per hour') : L('Unidades vendidas por día', 'Units sold per day')}</h3>
      <div class="hc-chart" id="hcSold"></div>
      ${tableHtml(list, isH)}`;
    priceChart(body.querySelector('#hcPrice'), shown, { hourly: isH, log });
    soldChart(body.querySelector('#hcSold'), shown, { hourly: isH });
  };

  const load = async () => {
    try {
      const need = range === '7d' ? 'h' : 'd';
      if (need === 'd' && !daily) daily = rows(await getJson(`${API}/json?itemID=${id}&fields=${FIELDS}`));
      if (need === 'h' && !hourly) hourly = rows(await getJson(`${API}/hourly/json?itemID=${id}&fields=${FIELDS}`));
      // The "on the trading post since" tile needs the daily history: fetched after the hourly one.
      if (need === 'h' && !daily) getJson(`${API}/json?itemID=${id}&fields=${FIELDS}`).then((r) => { daily = rows(r); draw(); }).catch(() => {});
      draw();
    } catch {
      body.innerHTML = `<p class="notice">${L('No se pudo cargar el historial (DataWars2 no respondió). Probá de nuevo en un rato.', 'Could not load the history (DataWars2 did not answer). Please try again later.')}</p>`;
    }
  };

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.hc-range');
    if (!b) return;
    range = b.dataset.r;
    try { localStorage.setItem('bl-hist-range', range); } catch { /* blocked */ }
    tabs.querySelectorAll('.hc-range').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load();
  });
  box.querySelector('#hcLog').addEventListener('change', (e) => { log = e.target.checked; draw(); });
  let w = 0;
  new ResizeObserver(() => { if (Math.abs(box.clientWidth - w) > 40) { w = box.clientWidth; draw(); } }).observe(box);

  // Only when the card is about to be seen (saves the download for visitors who never scroll there).
  const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '400px' });
  io.observe(box);
}
