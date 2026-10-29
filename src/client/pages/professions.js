// Professions: specializations and traits from the official API (ARIA tabs pattern).
import { $, lang, t } from '../lib/env.js';
import { get, batched } from '../lib/gw2.js';
import { esc, iconUrl } from '../../shared/format.js';

const tabs = $('#ptabs');
const body = $('#pbody');
let profs = [];

const strip = (s) => esc(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\n/g, '<br>');

async function init() {
  try {
    profs = await get('/v2/professions?ids=all', lang);
  } catch {
    body.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  tabs.innerHTML = profs.map((p, i) => `<button type="button" role="tab" id="tab-${p.id}" aria-controls="pbody" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-p="${p.id}">${p.icon_big || p.icon ? `<img src="${esc(iconUrl(p.icon_big || p.icon))}" alt="" width="28" height="28">` : ''}<span>${esc(p.name)}</span></button>`).join('');
  body.setAttribute('role', 'tabpanel');
  const fromHash = profs.find((p) => `#${p.id}` === location.hash);
  select((fromHash || profs[0]).id);
}

async function select(id) {
  const p = profs.find((x) => x.id === id);
  if (!p) return;
  for (const b of tabs.querySelectorAll('[role=tab]')) {
    const on = b.dataset.p === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  body.setAttribute('aria-labelledby', `tab-${id}`);
  body.innerHTML = `<p class="muted">${esc(t('loading'))}</p>`;
  let specs;
  let traits;
  try {
    specs = await batched('/v2/specializations', p.specializations, `&lang=${lang}`);
    const traitIds = specs.flatMap((s) => [...s.minor_traits, ...s.major_traits]);
    traits = new Map((await batched('/v2/traits', traitIds, `&lang=${lang}`)).map((x) => [x.id, x]));
  } catch {
    body.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  specs.sort((a, b) => Number(a.elite) - Number(b.elite) || a.id - b.id);
  const weapons = Object.keys(p.weapons || {});
  const trait = (id, kind) => {
    const x = traits.get(id);
    if (!x) return '';
    return `<li class="trait trait-${kind}"><img src="${esc(iconUrl(x.icon))}" alt="" width="40" height="40" loading="lazy"><div><p class="trait-name">${esc(x.name)} <span class="muted small">${esc(t(kind === 'minor' ? 'prof.minor' : 'prof.major'))}</span></p><p class="small">${strip(x.description)}</p></div></li>`;
  };
  body.innerHTML = `${weapons.length ? `<p class="small"><strong>${esc(t('prof.weapons'))}:</strong> ${weapons.map(esc).join(', ')}</p>` : ''}`
    + specs.map((s) => `<section class="card spec">
      <header class="spec-head">${s.icon ? `<img src="${esc(iconUrl(s.icon))}" alt="" width="48" height="48" loading="lazy">` : ''}<div><h2>${esc(s.name)}</h2><p class="muted small">${esc(t(s.elite ? 'prof.elite' : 'prof.core'))}</p></div></header>
      <ul class="trait-list">${s.minor_traits.map((id) => trait(id, 'minor')).join('')}${s.major_traits.map((id) => trait(id, 'major')).join('')}</ul>
    </section>`).join('');
}

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[role=tab]');
  if (b) { history.replaceState(null, '', `#${b.dataset.p}`); select(b.dataset.p); }
});
tabs.addEventListener('keydown', (e) => {
  const list = [...tabs.querySelectorAll('[role=tab]')];
  const i = list.indexOf(document.activeElement);
  if (i < 0) return;
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % list.length;
  if (e.key === 'ArrowLeft') n = (i - 1 + list.length) % list.length;
  if (e.key === 'Home') n = 0;
  if (e.key === 'End') n = list.length - 1;
  if (n != null) { e.preventDefault(); list[n].focus(); list[n].click(); }
});
init();
