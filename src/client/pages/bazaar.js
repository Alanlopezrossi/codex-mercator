// Trading post: build snapshot of every price + live refresh of the visible rows.
import { $, lang, t, debounce, relTime } from '../lib/env.js';
import { loadIndex, search, nameOf, index } from '../lib/search.js';
import { prices as livePrices, items as apiItems } from '../lib/gw2.js';
import { esc, coin, num, margin, iconUrl } from '../../shared/format.js';
import { RARITIES, itemPath } from '../../shared/i18n.js';

const PAGE = 50;
const form = $('#bzFilters');
const body = $('#bbody');
const pager = $('#bpager');
const stampEl = $('#bstamp');
const table = $('#btable');
const dataBase = document.body.dataset.data;

let all = new Map(); // id -> {buy, buyQty, sell, sellQty}
let rows = [];
let page = 0;
let sort = { key: 'demand', dir: -1 };
let snapshotAt = null;
let liveAt = 0;

function readParams() {
  const p = new URLSearchParams(location.search);
  form.q.value = p.get('q') || '';
  form.type.value = p.get('type') || '';
  form.rarity.value = p.get('rarity') || '';
  form.dmin.value = p.get('dmin') || '';
  const s = p.get('sort');
  if (s) { const [k, d] = s.split('.'); sort = { key: k, dir: d === 'asc' ? 1 : -1 }; }
  page = Math.max(0, Number(p.get('page') || 1) - 1);
}
function writeParams() {
  const p = new URLSearchParams();
  for (const k of ['q', 'type', 'rarity', 'dmin']) if (form[k].value.trim()) p.set(k, form[k].value.trim());
  if (!(sort.key === 'demand' && sort.dir === -1)) p.set('sort', `${sort.key}.${sort.dir > 0 ? 'asc' : 'desc'}`);
  if (page) p.set('page', String(page + 1));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const val = (id, k) => {
  const v = all.get(id);
  if (!v) return 0;
  if (k === 'margin') return margin(v.buy, v.sell) ?? -Infinity;
  if (k === 'supply') return v.sellQty;
  if (k === 'demand') return v.buyQty;
  return v[k] || 0;
};

function run() {
  const nn = (v) => (v === '' ? null : Number(v));
  const pos = search(form.q.value, { type: nn(form.type.value), rarity: nn(form.rarity.value), tp: true });
  const dmin = Number(form.dmin.value) || 0;
  rows = pos.map((p) => index.ids[p]).filter((id) => all.has(id) && (all.get(id).buy || all.get(id).sell) && (!dmin || all.get(id).buyQty >= dmin));
  const q = form.q.value.trim();
  if (sort.key === 'name') {
    rows.sort((a, b) => sort.dir * nameOf(index.byId.get(a), lang).localeCompare(nameOf(index.byId.get(b), lang), lang));
  } else if (!q || sort.key !== 'demand' || sort.dir !== -1) {
    // With a search and the default order we keep relevance; otherwise we sort by the chosen column.
    rows.sort((a, b) => sort.dir * (val(a, sort.key) - val(b, sort.key)) || a - b);
  }
  if (page * PAGE >= rows.length) page = 0;
  render();
}

function render() {
  writeParams();
  for (const th of table.querySelectorAll('th')) {
    const k = th.querySelector('[data-sort]')?.dataset.sort;
    th.setAttribute('aria-sort', k === sort.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
  }
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
  if (!slice.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${esc(t('noResults'))}</td></tr>`;
    pager.innerHTML = '';
    return;
  }
  body.innerHTML = slice.map((id) => {
    const pos = index.byId.get(id);
    const name = nameOf(pos, lang);
    const r = RARITIES[index.rarity[pos]] || 'Basic';
    return `<tr data-id="${id}"><th scope="row" class="left"><a class="item-cell" href="${itemPath(lang, id, name)}"><span class="ic ic-ph" data-icon="${id}" aria-hidden="true"></span><span class="r-txt-${r}">${esc(name)}</span></a></th>${cells(id)}</tr>`;
  }).join('');
  const pages = Math.ceil(rows.length / PAGE);
  pager.innerHTML = `<button class="btn" type="button" data-go="-1" ${page === 0 ? 'disabled' : ''}>${esc(t('prev'))}</button>
    <span>${esc(t('page'))} ${page + 1} ${esc(t('of'))} ${num(pages, lang)} · ${num(rows.length, lang)} ${esc(t('results'))}</span>
    <button class="btn" type="button" data-go="1" ${page >= pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button>`;
  refreshVisible(slice);
}

function cells(id) {
  const v = all.get(id) || {};
  const m = margin(v.buy, v.sell);
  return `<td class="num" data-c="buy">${coin(v.buy, { lang })}</td><td class="num" data-c="sell">${coin(v.sell, { lang })}</td><td class="num ${m != null && m > 0 ? 'pos' : 'neg-c'}" data-c="margin">${m == null ? '—' : coin(m, { lang })}</td><td class="num" data-c="supply">${num(v.sellQty, lang)}</td><td class="num" data-c="demand">${num(v.buyQty, lang)}</td>`;
}

async function refreshVisible(ids = rows.slice(page * PAGE, page * PAGE + PAGE)) {
  if (!ids.length) return;
  try {
    const [p, its] = await Promise.all([livePrices(ids), apiItems(ids, lang).catch(() => new Map())]);
    for (const [id, v] of p) {
      all.set(id, v);
      const tr = body.querySelector(`tr[data-id="${id}"]`);
      if (!tr) continue;
      tr.querySelectorAll('td').forEach((td) => td.remove());
      tr.insertAdjacentHTML('beforeend', cells(id));
    }
    for (const [id, it] of its) {
      const ph = body.querySelector(`[data-icon="${id}"]`);
      if (ph && it.icon) {
        const img = document.createElement('img');
        Object.assign(img, { src: iconUrl(it.icon), alt: '', width: 32, height: 32, loading: 'lazy', className: `ic r-${it.rarity}` });
        ph.replaceWith(img);
      }
    }
    liveAt = Date.now();
  } catch { /* the snapshot stays visible */ }
  stamp();
}

function stamp() {
  const parts = [];
  if (liveAt) parts.push(`<span class="live-dot" aria-hidden="true"></span> ${esc(t('bazaar.live'))}: ${esc(relTime(liveAt))}`);
  if (snapshotAt) parts.push(`${esc(t('bazaar.snapshot'))} ${esc(new Date(snapshotAt).toLocaleString(lang === 'es' ? 'es-AR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }))}`);
  stampEl.innerHTML = parts.join(' · ');
}

table.querySelector('thead').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  const k = b.dataset.sort;
  sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 };
  page = 0;
  run();
});
pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  page += Number(b.dataset.go);
  render();
  table.scrollIntoView({ block: 'start' });
});
form.addEventListener('submit', (e) => { e.preventDefault(); page = 0; run(); });
form.addEventListener('input', debounce(() => { page = 0; run(); }, 200));
form.addEventListener('reset', () => setTimeout(() => { page = 0; run(); }, 0));

readParams();
Promise.all([
  loadIndex(),
  fetch(`${dataBase}/prices.tsv`).then((r) => r.text()),
  fetch(`${dataBase}/meta.json`).then((r) => r.json()).catch(() => null),
]).then(([, tsv, meta]) => {
  for (const line of tsv.split('\n')) {
    const [id, buy, buyQty, sell, sellQty] = line.split('\t').map(Number);
    if (id) all.set(id, { buy, buyQty, sell, sellQty });
  }
  snapshotAt = meta?.pricesAt || meta?.builtAt;
  run();
  stamp();
}).catch(() => { body.innerHTML = `<tr><td colspan="6" class="empty">${esc(t('error'))}</td></tr>`; });

setInterval(() => { if (!document.hidden) refreshVisible(); }, 60000);
setInterval(stamp, 20000);
