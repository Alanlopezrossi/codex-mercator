// Items page: search and filters over the whole index, with icons from the live API.
import { $, lang, t, debounce } from '../lib/env.js';
import { loadIndex, search, nameOf, index } from '../lib/search.js';
import { items as apiItems } from '../lib/gw2.js';
import { esc, iconUrl, num } from '../../shared/format.js';
import { RARITIES, TYPE_KEYS, itemPath, tr } from '../../shared/i18n.js';

const PAGE = 50;
const form = $('#itemFilters');
const list = $('#ilist');
const count = $('#icount');
const pager = $('#ipager');
let results = [];
let page = 0;

function readParams() {
  const p = new URLSearchParams(location.search);
  form.q.value = p.get('q') || '';
  const type = p.get('type');
  // Accepts the type index or its API name (?type=Weapon from the breadcrumb).
  form.type.value = type == null ? '' : /^\d+$/.test(type) ? type : String(TYPE_KEYS.indexOf(type) >= 0 ? TYPE_KEYS.indexOf(type) : '');
  form.rarity.value = p.get('rarity') || '';
  form.lmin.value = p.get('lmin') || '';
  form.lmax.value = p.get('lmax') || '';
  form.tp.checked = p.get('tp') === '1';
  page = Math.max(0, Number(p.get('page') || 1) - 1);
}

function writeParams() {
  const p = new URLSearchParams();
  if (form.q.value.trim()) p.set('q', form.q.value.trim());
  for (const k of ['type', 'rarity', 'lmin', 'lmax']) if (form[k].value !== '') p.set(k, form[k].value);
  if (form.tp.checked) p.set('tp', '1');
  if (page) p.set('page', String(page + 1));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

function run() {
  results = search(form.q.value, {
    type: numOrNull(form.type.value), rarity: numOrNull(form.rarity.value),
    lmin: numOrNull(form.lmin.value), lmax: numOrNull(form.lmax.value), tp: form.tp.checked,
  });
  if (page * PAGE >= results.length) page = 0;
  render();
}

function render() {
  writeParams();
  const total = results.length;
  count.textContent = `${num(total, lang)} ${t('results')}`;
  const slice = results.slice(page * PAGE, page * PAGE + PAGE);
  if (!slice.length) { list.innerHTML = `<li class="empty">${esc(t('noResults'))}</li>`; pager.innerHTML = ''; return; }
  list.innerHTML = slice.map((pos) => {
    const id = index.ids[pos];
    const name = nameOf(pos, lang);
    const r = RARITIES[index.rarity[pos]] || 'Basic';
    const ty = TYPE_KEYS[index.type[pos]];
    return `<li><a class="item-row" href="${itemPath(lang, id, name)}"><span class="ic ic-ph" data-icon="${id}" aria-hidden="true"></span>
      <span class="row-main"><span class="r-txt-${r}">${esc(name)}</span><span class="small muted">${esc(tr.rarity(lang, r))}${ty ? ` · ${esc(tr.type(lang, ty))}` : ''}${index.level[pos] ? ` · ${esc(t('level'))} ${index.level[pos]}` : ''}</span></span>
      ${index.tp[pos] ? `<span class="tag tag-tp">${esc(t('nav.bazaar'))}</span>` : ''}</a></li>`;
  }).join('');
  renderPager(total);
  loadIcons(slice.map((pos) => index.ids[pos]));
}

function renderPager(total) {
  const pages = Math.ceil(total / PAGE);
  if (pages <= 1) { pager.innerHTML = ''; return; }
  pager.innerHTML = `<button class="btn" type="button" data-go="-1" ${page === 0 ? 'disabled' : ''}>${esc(t('prev'))}</button>
    <span>${esc(t('page'))} ${page + 1} ${esc(t('of'))} ${num(pages, lang)}</span>
    <button class="btn" type="button" data-go="1" ${page >= pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button>`;
}

async function loadIcons(ids) {
  try {
    const data = await apiItems(ids, lang);
    for (const [id, it] of data) {
      const ph = list.querySelector(`[data-icon="${id}"]`);
      if (!ph || !it.icon) continue;
      const img = document.createElement('img');
      img.src = iconUrl(it.icon);
      img.alt = '';
      img.width = 32;
      img.height = 32;
      img.loading = 'lazy';
      img.className = `ic r-${it.rarity}`;
      ph.replaceWith(img);
    }
  } catch { /* icons are decorative */ }
}

pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  page += Number(b.dataset.go);
  render();
  count.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
form.addEventListener('submit', (e) => { e.preventDefault(); page = 0; run(); });
form.addEventListener('input', debounce(() => { page = 0; run(); }, 180));
form.addEventListener('reset', () => setTimeout(() => { page = 0; run(); }, 0));

readParams();
count.textContent = t('items.loadingIndex');
loadIndex().then(run).catch(() => {
  count.textContent = t('error');
});
