// Vendors (NPCs): who sells what and where. Data: data/vendors.json (built from the wiki "Sold by" tables).
import { $, lang, li, t, debounce } from '../lib/env.js';
import { norm } from '../lib/search.js';
import { esc, iconUrl, num } from '../../shared/format.js';
import { itemPath, pagePath } from '../../shared/i18n.js';

const PAGE = 24;
const form = $('#vFilters');
const list = $('#vlist');
const count = $('#vcount');
const pager = $('#vpager');
let vendors = [];
let ITEMS = {};
let res = [];
let page = 0;
let words = [];

const L = (pair) => (pair ? pair[li] || pair[1] || pair[0] || '' : '');
const mapHref = (loc, v) => (loc.c ? `${pagePath(lang, 'map')}#@${loc.c[0]},${loc.c[1]},${encodeURIComponent(`${L(v.n)} — ${[L(loc.a), L(loc.z)].filter(Boolean).join(', ')}`)}` : '');

function readParams() {
  const p = new URLSearchParams(location.search);
  form.q.value = p.get('q') || '';
  form.off.checked = p.get('off') === '1';
  page = Math.max(0, Number(p.get('page') || 1) - 1);
  return p;
}
function writeParams() {
  const p = new URLSearchParams();
  if (form.q.value.trim()) p.set('q', form.q.value.trim());
  if (form.off.checked) p.set('off', '1');
  if (form.vc.value) p.set('cur', form.vc.value);
  if (page) p.set('page', String(page + 1));
  const qs = p.toString();
  history.replaceState(null, '', `${qs ? `?${qs}` : location.pathname}${location.hash}`);
}

// One vendor from a link (#v=key, from the item pages).
const single = () => (location.hash.match(/^#v=([a-z0-9-]+)/) || [])[1] || '';

function run() {
  words = norm(form.q.value).split(/\s+/).filter(Boolean);
  const cur = Number(form.vc.value || 0);
  const one = single();
  res = vendors.filter((v) => {
    if (one) return v.k === one;
    if (v.off && !form.off.checked && !words.length) return false;
    if (cur && !v.cur.includes(cur)) return false;
    if (!words.length) return true;
    return words.every((w) => v.key.includes(w) || v.itemKeys.some((k) => k.includes(w)));
  });
  if (page * PAGE >= res.length) page = 0;
  render();
}

function itemMatches(v) {
  if (!words.length) return null;
  const set = new Set();
  v.it.forEach((row, i) => { if (words.every((w) => v.key.includes(w) || v.itemKeys[i].includes(w))) if (words.some((w) => v.itemKeys[i].includes(w))) set.add(i); });
  return set;
}

function itemsHtml(v, only) {
  const rows = v.it.map((row, i) => [row, i]).filter(([, i]) => !only || only.has(i));
  return `<ul class="v-items">${rows.map(([[id, cEs, cEn, nEs, nEn, off]]) => {
    const ref = ITEMS[id] || [`#${id}`, `#${id}`, 'Basic', ''];
    const name = ref[li] || ref[1];
    const cost = lang === 'es' ? cEs : cEn;
    const note = lang === 'es' ? nEs : nEn;
    return `<li class="v-item${off ? ' is-off' : ''}">
      <a class="v-item-link" href="${itemPath(lang, id, name)}">${ref[3] ? `<img src="${esc(iconUrl(ref[3]))}" alt="" width="40" height="40" loading="lazy" class="ic r-${esc(ref[2])}">` : '<span class="ic ic-ph" aria-hidden="true"></span>'}
        <span class="v-item-body"><span class="v-item-name r-txt-${esc(ref[2])}">${esc(name)}</span>${cost ? `<span class="v-cost">${esc(cost)}</span>` : ''}${note ? `<span class="v-note">${esc(note)}</span>` : ''}${off ? `<span class="tag tag-small">${esc(t('vendors.off'))}</span>` : ''}</span>
      </a></li>`;
  }).join('')}</ul>`;
}

const placeLabel = (l) => [L(l.a), L(l.z)].filter(Boolean).join(', ');
function placesHtml(v) {
  if (!v.loc.length) return `<p class="small muted v-noplace">${esc(t('vendors.noPlace'))}</p>`;
  return `<ul class="v-places" aria-label="${esc(t('vendors.where'))}">${v.loc.map((l) => {
    const href = mapHref(l, v);
    const label = esc(placeLabel(l));
    return `<li>${href ? `<a class="v-place" href="${esc(href)}" title="${esc(t('vendors.onMap'))}"><span aria-hidden="true">📍</span>${label}</a>` : `<span class="v-place is-plain"><span aria-hidden="true">📍</span>${label}</span>`}</li>`;
  }).join('')}</ul>`;
}

function body(v, only) {
  return `<div class="v-body">
    <h3 class="v-h">${esc(t('vendors.where'))}</h3>${placesHtml(v)}
    <h3 class="v-h">${esc(t('vendors.sells'))}${only?.size ? ` <span class="count">${num(only.size, lang)} / ${num(v.it.length, lang)}</span>` : ''}</h3>${itemsHtml(v, only?.size ? only : null)}
  </div>`;
}

function card(v) {
  const name = L(v.n);
  const only = itemMatches(v);
  const open = !!single() || (only && only.size > 0);
  const first = v.loc[0] ? placeLabel(v.loc[0]) : t('vendors.noPlace');
  const more = v.loc.length > 1 ? ` · +${v.loc.length - 1}` : '';
  return `<details class="vendor" id="v-${esc(v.k)}" data-k="${esc(v.k)}"${open ? ' open' : ''}>
    <summary class="v-sum">
      <span class="v-title"><span class="v-name">${esc(name)}</span>${v.heart ? `<span class="tag tag-small tag-heart">❤ ${lang === 'es' ? 'Corazón de renombre' : 'Renown heart'}</span>` : ''}${v.off ? `<span class="tag tag-small">${esc(t('vendors.off'))}</span>` : ''}</span>
      <span class="v-meta"><span class="v-where-short">${esc(first)}${esc(more)}</span></span>
      <span class="v-count"><b>${num(only?.size || v.it.length, lang)}</b> ${esc(t('vendors.items'))}</span>
    </summary>
    ${open ? body(v, only) : ''}
  </details>`;
}

function render() {
  writeParams();
  const one = single();
  count.innerHTML = one
    ? `<a href="${pagePath(lang, 'vendors')}">← ${esc(t('vendors.all'))}</a>`
    : esc(`${num(res.length, lang)} ${t('vendors.count')}`);
  const slice = res.slice(page * PAGE, page * PAGE + PAGE);
  if (!slice.length) { list.innerHTML = `<p class="empty">${esc(t('noResults'))}</p>`; pager.innerHTML = ''; return; }
  list.innerHTML = slice.map(card).join('');
  const pages = Math.ceil(res.length / PAGE);
  pager.innerHTML = pages > 1 ? `<button class="btn" type="button" data-go="-1" ${page === 0 ? 'disabled' : ''}>${esc(t('prev'))}</button>
    <span>${esc(t('page'))} ${page + 1} ${esc(t('of'))} ${pages}</span>
    <button class="btn" type="button" data-go="1" ${page >= pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button>` : '';
}

// Item lists are only built when a vendor is opened (some sell hundreds of things).
list.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches?.('.vendor') || !d.open || d.querySelector('.v-body')) return;
  const v = vendors.find((x) => x.k === d.dataset.k);
  if (v) d.insertAdjacentHTML('beforeend', body(v, null));
}, true);
pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  page += Number(b.dataset.go);
  render();
  count.scrollIntoView({ block: 'start' });
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('change', () => { clearSingle(); page = 0; run(); });
form.q.addEventListener('input', debounce(() => { clearSingle(); page = 0; run(); }, 150));
form.addEventListener('reset', () => setTimeout(() => { clearSingle(); page = 0; run(); }, 0));
window.addEventListener('hashchange', () => { page = 0; run(); });
function clearSingle() { if (single()) history.replaceState(null, '', location.pathname + location.search); }

const params = readParams();
count.textContent = t('loading');
fetch(`${document.body.dataset.data}/vendors.json`).then((r) => r.json()).then((d) => {
  vendors = d.vendors;
  ITEMS = d.items;
  for (const v of vendors) {
    v.key = norm(`${v.n.join(' ')} ${v.loc.map((l) => `${(l.a || []).join(' ')} ${(l.z || []).join(' ')}`).join(' ')}`);
    v.itemKeys = v.it.map(([id]) => norm((ITEMS[id] || []).slice(0, 2).join(' ')));
  }
  const row = $('#vcur .chip-row');
  row.insertAdjacentHTML('beforeend', d.cur.map(([id, es, en], i) => `<input type="radio" class="chip-input" name="vc" id="vc-c${i}" value="${id}"><label class="chip" for="vc-c${i}">${esc(lang === 'es' ? es : en)}</label>`).join(''));
  if (!d.cur.length) $('#vcur').hidden = true;
  form.vc.value = params.get('cur') || '';
  $('#vstat').textContent = `${num(vendors.length, lang)} ${t('vendors.count')} · ${num(vendors.reduce((s, v) => s + v.it.length, 0), lang)} ${t('vendors.items')}`;
  run();
  if (single()) document.getElementById(`v-${single()}`)?.scrollIntoView({ block: 'start' });
}).catch(() => { count.textContent = t('error'); });
