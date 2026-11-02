// Legendary and ascended gear: filters (rarity, slot, subtype, weight, how to get it) over data/gear.json.
import { $, lang, li, t, debounce } from '../lib/env.js';
import { norm, terms } from '../lib/search.js';
import { esc, iconUrl, num } from '../../shared/format.js';
import { itemPath, tr } from '../../shared/i18n.js';

const PAGE = 60;
const form = $('#gearFilters');
const list = $('#glist');
const count = $('#gcount');
const pager = $('#gpager');
const subBox = $('.js-sub');
const weightBox = $('.js-weight');
let rows = [];
let SRC = {};
let res = [];
let page = 0;

const SRC_KEYS = ['forge', 'craft', 'ach', 'vendor', 'container', 'tp'];

function srcChecked() {
  return [...form.querySelectorAll('input[name="gsrc"]:checked')].map((i) => i.value);
}

function readParams() {
  const p = new URLSearchParams(location.search);
  form.q.value = p.get('q') || '';
  form.grar.value = p.get('rarity') || '';
  form.gslot.value = p.get('slot') || '';
  const src = (p.get('src') || '').split(',');
  for (const i of form.querySelectorAll('input[name="gsrc"]')) i.checked = src.includes(i.value);
  page = Math.max(0, Number(p.get('page') || 1) - 1);
  return p;
}
function writeParams() {
  const p = new URLSearchParams();
  if (form.q.value.trim()) p.set('q', form.q.value.trim());
  if (form.grar.value) p.set('rarity', form.grar.value);
  if (form.gslot.value) p.set('slot', form.gslot.value);
  if (form.gsub?.value) p.set('sub', form.gsub.value);
  if (form.gw?.value) p.set('w', form.gw.value);
  const s = srcChecked();
  if (s.length) p.set('src', s.join(','));
  if (page) p.set('page', String(page + 1));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// Subtype boxes depend on the selected slot (weapon types, armor pieces, trinket types…).
function renderSubs(keep) {
  const slot = form.gslot.value;
  subBox.hidden = !slot;
  weightBox.hidden = slot !== 'Armor';
  if (!slot) return;
  const subs = [...new Set(rows.filter((r) => r[4] === slot && r[5]).map((r) => r[5]))].sort((a, b) => tr.sub(lang, a).localeCompare(tr.sub(lang, b), lang));
  const row = subBox.querySelector('.chip-row');
  row.innerHTML = `<input type="radio" class="chip-input" name="gsub" id="gsub-all" value="" checked><label class="chip" for="gsub-all">${esc(t('all'))}</label>`
    + subs.map((s, i) => `<input type="radio" class="chip-input" name="gsub" id="gsub-${i}" value="${esc(s)}"><label class="chip" for="gsub-${i}">${esc(tr.sub(lang, s))}</label>`).join('');
  if (keep && subs.includes(keep)) form.gsub.value = keep;
}

function run() {
  const words = terms(form.q.value);
  const rar = form.grar.value;
  const slot = form.gslot.value;
  const sub = form.gsub?.value || '';
  const w = slot === 'Armor' ? form.gw?.value || '' : '';
  const mask = srcChecked().reduce((m, k) => m | (SRC[k] || 0), 0);
  res = rows.filter((r) => (rar === '' || String(r[3]) === rar) && (!slot || r[4] === slot) && (!sub || r[5] === sub) && (!w || r[6] === w)
    && (!mask || (r[7] & mask)) && (!words.length || words.every((x) => r.key.includes(x))));
  if (page * PAGE >= res.length) page = 0;
  render();
}

function render() {
  writeParams();
  count.textContent = `${num(res.length, lang)} ${t('results')}`;
  const slice = res.slice(page * PAGE, page * PAGE + PAGE);
  if (!slice.length) { list.innerHTML = `<li class="empty">${esc(t('noResults'))}</li>`; pager.innerHTML = ''; return; }
  list.innerHTML = slice.map((r) => {
    const name = r[1 + li] || r[2 - li];
    const rar = r[3] ? 'Legendary' : 'Ascended';
    const tags = SRC_KEYS.filter((k) => r[7] & SRC[k]).map((k) => `<li class="tag tag-src">${esc(t(`gear.src.${k}`))}</li>`).join('');
    const kind = [tr.type(lang, r[4]), r[5] ? tr.sub(lang, r[5]) : '', r[6] ? tr.weight(lang, r[6]) : ''].filter(Boolean).join(' · ');
    return `<li><a class="gear-card" href="${itemPath(lang, r[0], name)}">
      <img src="${esc(iconUrl(r[8]))}" alt="" width="48" height="48" loading="lazy" class="ic ic-lg r-${rar}">
      <span class="gear-main"><span class="gear-name r-txt-${rar}">${esc(name)}</span><span class="small muted">${esc(kind)}</span><ul class="tags" aria-label="${esc(t('gear.source'))}">${tags}</ul></span>
    </a></li>`;
  }).join('');
  const pages = Math.ceil(res.length / PAGE);
  pager.innerHTML = pages > 1 ? `<button class="btn" type="button" data-go="-1" ${page === 0 ? 'disabled' : ''}>${esc(t('prev'))}</button>
    <span>${esc(t('page'))} ${page + 1} ${esc(t('of'))} ${pages}</span>
    <button class="btn" type="button" data-go="1" ${page >= pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button>` : '';
}

pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  page += Number(b.dataset.go);
  render();
  count.scrollIntoView({ block: 'start' });
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('change', (e) => { if (e.target.name === 'gslot') renderSubs(); page = 0; run(); });
form.q.addEventListener('input', debounce(() => { page = 0; run(); }, 150));
form.addEventListener('reset', () => setTimeout(() => { renderSubs(); page = 0; run(); }, 0));

const params = readParams();
count.textContent = t('loading');
fetch(`${document.body.dataset.data}/gear.json`).then((r) => r.json()).then((d) => {
  SRC = d.src;
  rows = d.rows;
  for (const r of rows) r.key = norm(`${r[1]} ${r[2]} ${tr.type(lang, r[4])} ${tr.sub(lang, r[5])}`);
  renderSubs(params.get('sub'));
  if (params.get('w') && form.gw) form.gw.value = params.get('w');
  run();
}).catch(() => { count.textContent = t('error'); });
