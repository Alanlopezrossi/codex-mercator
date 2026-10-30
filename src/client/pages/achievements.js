// Achievements: groups and categories from the official API; achievements load when a category is opened.
import { $, lang, t, debounce, store } from '../lib/env.js';
import { get, batched, items as apiItems } from '../lib/gw2.js';
import { esc, coin, iconUrl, num } from '../../shared/format.js';
import { itemPath } from '../../shared/i18n.js';

const cats = $('#acats');
const list = $('#alist');
const filter = $('#acf');
let groups = [];
let categories = new Map();

const strip = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
const text = (s) => esc(strip(s)).replace(/\n/g, '<br>');

async function init() {
  try {
    [groups, categories] = await Promise.all([
      get('/v2/achievements/groups?ids=all', lang),
      get('/v2/achievements/categories?ids=all', lang).then((a) => new Map(a.map((c) => [c.id, c]))),
    ]);
  } catch {
    cats.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  groups.sort((a, b) => a.order - b.order);
  renderTree();
  // Something is always shown: the category in the link, else the last one opened here, else the first one.
  const m = location.hash.match(/cat=(\d+)/);
  const last = store.get('cm-ach-cat');
  const first = groups.flatMap((g) => g.categories.map((id) => categories.get(id)).filter(Boolean).sort((a, b) => a.order - b.order))[0];
  const pick = [m && Number(m[1]), last, first?.id].find((id) => id && categories.has(id));
  if (pick) open(pick);
}

function renderTree(q = '') {
  const nq = q.trim().toLowerCase();
  cats.innerHTML = groups.map((g) => {
    const cs = g.categories.map((id) => categories.get(id)).filter(Boolean).sort((a, b) => a.order - b.order)
      .filter((c) => !nq || c.name.toLowerCase().includes(nq) || g.name.toLowerCase().includes(nq));
    if (!cs.length) return '';
    return `<details ${nq ? 'open' : ''}><summary>${esc(g.name)} <span class="count">${cs.length}</span></summary><ul>${cs.map((c) => `<li><a href="#cat=${c.id}" data-cat="${c.id}">${c.icon ? `<img src="${esc(iconUrl(c.icon))}" alt="" width="20" height="20" loading="lazy">` : ''}<span>${esc(c.name)}</span></a></li>`).join('')}</ul></details>`;
  }).join('') || `<p class="muted">${esc(t('noResults'))}</p>`;
}

async function open(catId) {
  const c = categories.get(catId);
  if (!c) return;
  store.set('cm-ach-cat', catId);
  cats.querySelectorAll('[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
  const link = cats.querySelector(`[data-cat="${catId}"]`);
  if (link) { link.setAttribute('aria-current', 'true'); link.closest('details').open = true; }
  list.innerHTML = `<p class="muted">${esc(t('loading'))}</p>`;
  let achs;
  try {
    achs = await batched('/v2/achievements', c.achievements, `&lang=${lang}`);
  } catch {
    list.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  const order = new Map(c.achievements.map((id, i) => [id, i]));
  achs.sort((a, b) => order.get(a.id) - order.get(b.id));
  const itemIds = new Set();
  for (const a of achs) {
    for (const r of a.rewards || []) if (r.type === 'Item') itemIds.add(r.id);
    for (const b of a.bits || []) if (b.type === 'Item') itemIds.add(b.id);
  }
  let names = new Map();
  try { names = await apiItems([...itemIds], lang); } catch { /* without names we show IDs */ }
  const itemLink = (id, count) => {
    const it = names.get(id);
    const name = it?.name || `#${id}`;
    return `<a class="ref" href="${itemPath(lang, id, name)}">${it?.icon ? `<img src="${esc(iconUrl(it.icon))}" alt="" width="32" height="32" loading="lazy" class="ic r-${esc(it.rarity)}">` : '<span class="ic ic-ph" aria-hidden="true"></span>'}<span class="ref-name r-txt-${esc(it?.rarity || 'Basic')}">${esc(name)}</span>${count > 1 ? `<span class="ref-count">×${count}</span>` : ''}</a>`;
  };
  list.innerHTML = `<header class="cat-head">${c.icon ? `<img src="${esc(iconUrl(c.icon))}" alt="" width="48" height="48">` : ''}<div><h2>${esc(c.name)}</h2>${c.description ? `<p class="muted">${text(c.description)}</p>` : ''}</div></header>`
    + achs.map((a) => {
      const pts = (a.tiers || []).reduce((s, x) => s + (x.points || 0), 0);
      const tiers = (a.tiers || []).length > 1 ? `<p class="small"><strong>${esc(t('ach.tiers'))}:</strong> ${a.tiers.map((x) => `${num(x.count, lang)} (${x.points} ${esc(t('ach.points'))})`).join(' · ')}</p>` : '';
      const rewards = (a.rewards || []).map((r) => {
        if (r.type === 'Item') return `<li>${itemLink(r.id, r.count)}</li>`;
        if (r.type === 'Coins') return `<li>${coin(r.count, { lang })}</li>`;
        if (r.type === 'Mastery') return `<li class="tag">${lang === 'es' ? 'Punto de maestría' : 'Mastery point'} (${esc(r.region)})</li>`;
        if (r.type === 'Title') return `<li class="tag">${lang === 'es' ? 'Título' : 'Title'}</li>`;
        return '';
      }).join('');
      const bits = (a.bits || []).filter((b) => b.type === 'Item' || b.text).slice(0, 60).map((b) => (b.type === 'Item' ? `<li>${itemLink(b.id, 1)}</li>` : `<li>${esc(b.text)}</li>`)).join('');
      return `<article class="card ach" id="a${a.id}">
        <header><h3>${esc(a.name)}</h3>${pts ? `<span class="pts">${pts} ${esc(t('ach.points'))}</span>` : ''}</header>
        ${a.description ? `<p class="muted">${text(a.description)}</p>` : ''}
        ${a.requirement ? `<p>${text(a.requirement.replace(/ {2}/g, ` ${num(a.tiers?.at(-1)?.count || '', lang)} `))}</p>` : ''}
        ${tiers}
        ${bits ? `<details><summary>${esc(t('ach.objectives'))} (${a.bits.length})</summary><ul class="ref-grid">${bits}</ul></details>` : ''}
        ${rewards ? `<p class="small"><strong>${esc(t('ach.rewards'))}:</strong></p><ul class="ref-list">${rewards}</ul>` : ''}
      </article>`;
    }).join('');
  list.querySelector('h2')?.setAttribute('tabindex', '-1');
}

cats.addEventListener('click', (e) => {
  const a = e.target.closest('[data-cat]');
  if (!a) return;
  e.preventDefault();
  history.replaceState(null, '', `#cat=${a.dataset.cat}`);
  open(Number(a.dataset.cat)).then(() => {
    const h = list.querySelector('h2');
    if (h && matchMedia('(max-width: 860px)').matches) h.scrollIntoView({ block: 'start' });
  });
});
filter.addEventListener('input', debounce(() => renderTree(filter.value), 150));
init();
