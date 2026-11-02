// Trading post: one small file per language with name + prices (build snapshot), then the visible rows refresh live.
import { $, lang, t, debounce, relTime } from '../lib/env.js';
import { norm, terms, chatCodeId } from '../lib/search.js';
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

let all = []; // {id, name, other, key, r, ty, buy, buyQty, sell, sellQty}
const byId = new Map();
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
  for (const k of ['q', 'type', 'rarity', 'dmin']) if (String(form[k].value).trim()) p.set(k, String(form[k].value).trim());
  if (!(sort.key === 'demand' && sort.dir === -1)) p.set('sort', `${sort.key}.${sort.dir > 0 ? 'asc' : 'desc'}`);
  if (page) p.set('page', String(page + 1));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const val = (r, k) => {
  if (k === 'margin') return margin(r.buy, r.sell) ?? -Infinity;
  if (k === 'supply') return r.sellQty;
  if (k === 'demand') return r.buyQty;
  return r[k] || 0;
};

function run() {
  const q = norm(form.q.value);
  const words = terms(q);
  const id = /^\d+$/.test(q) ? Number(q) : chatCodeId(form.q.value);
  const type = form.type.value === '' ? null : Number(form.type.value);
  const rar = form.rarity.value === '' ? null : Number(form.rarity.value);
  const dmin = Number(form.dmin.value) || 0;
  rows = all.filter((r) => (type == null || r.ty === type) && (rar == null || r.r === rar) && (!dmin || r.buyQty >= dmin)
    && (id != null ? r.id === id : words.every((w) => r.key.includes(w))));
  if (sort.key === 'name') rows.sort((a, b) => sort.dir * a.name.localeCompare(b.name, lang));
  else rows.sort((a, b) => sort.dir * (val(a, sort.key) - val(b, sort.key)) || a.id - b.id);
  if (page * PAGE >= rows.length) page = 0;
  render();
}

function cells(r) {
  const m = margin(r.buy, r.sell);
  return `<td class="num">${coin(r.buy, { lang })}</td><td class="num">${coin(r.sell, { lang })}</td><td class="num ${m != null && m > 0 ? 'pos' : 'neg-c'}">${m == null ? '—' : coin(m, { lang })}</td><td class="num">${num(r.sellQty, lang)}</td><td class="num">${num(r.buyQty, lang)}</td>`;
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
  body.innerHTML = slice.map((r) => `<tr data-id="${r.id}"><th scope="row" class="left"><a class="item-cell" href="${itemPath(lang, r.id, r.name)}"><span class="ic ic-ph" data-icon="${r.id}" aria-hidden="true"></span><span class="r-txt-${RARITIES[r.r] || 'Basic'}">${esc(r.name)}</span></a></th>${cells(r)}</tr>`).join('');
  const pages = Math.ceil(rows.length / PAGE);
  pager.innerHTML = `<button class="btn" type="button" data-go="-1" ${page === 0 ? 'disabled' : ''}>${esc(t('prev'))}</button>
    <span>${esc(t('page'))} ${page + 1} ${esc(t('of'))} ${num(pages, lang)} · ${num(rows.length, lang)} ${esc(t('results'))}</span>
    <button class="btn" type="button" data-go="1" ${page >= pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button>`;
  refreshVisible(slice.map((r) => r.id));
}

async function refreshVisible(ids = rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => r.id)) {
  if (!ids.length) return;
  try {
    const [p, its] = await Promise.all([livePrices(ids), apiItems(ids, lang).catch(() => new Map())]);
    for (const [id, v] of p) {
      const r = byId.get(id);
      if (!r) continue;
      Object.assign(r, v);
      const tr = body.querySelector(`tr[data-id="${id}"]`);
      if (!tr) continue;
      tr.querySelectorAll('td').forEach((td) => td.remove());
      tr.insertAdjacentHTML('beforeend', cells(r));
    }
    for (const [id, it] of its) {
      const ph = body.querySelector(`[data-icon="${id}"]`);
      if (ph && it.icon) {
        const img = document.createElement('img');
        Object.assign(img, { src: iconUrl(it.icon), alt: '', width: 28, height: 28, loading: 'lazy', className: `ic r-${it.rarity}` });
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
form.addEventListener('input', debounce(() => { page = 0; run(); }, 180));
form.addEventListener('reset', () => setTimeout(() => { page = 0; run(); }, 0));

readParams();
Promise.all([
  fetch(`${dataBase}/tp-${lang}.tsv`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
  fetch(`${dataBase}/meta.json`).then((r) => r.json()).catch(() => null),
]).then(([tsv, meta]) => {
  all = tsv.split('\n').map((line) => {
    const c = line.split('\t');
    const r = { id: Number(c[0]), name: c[1], other: c[2], r: Number(c[3]), ty: Number(c[4]), buy: Number(c[5]), buyQty: Number(c[6]), sell: Number(c[7]), sellQty: Number(c[8]) };
    r.key = norm(`${r.name} ${r.other}`);
    byId.set(r.id, r);
    return r;
  });
  snapshotAt = meta?.pricesAt || meta?.builtAt;
  run();
  stamp();
}).catch(() => { body.innerHTML = `<tr><td colspan="6" class="empty">${esc(t('error'))}</td></tr>`; });

setInterval(() => { if (!document.hidden) refreshVisible(); }, 60000);
setInterval(stamp, 20000);
