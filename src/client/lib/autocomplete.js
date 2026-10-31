// Accessible autocomplete (ARIA combobox pattern) on top of the item index.
import { lang, li, debounce, t } from './env.js';
import { loadIndex, search, nameOf, index, norm } from './search.js';
import { esc } from '../../shared/format.js';
import { RARITIES, itemPath } from '../../shared/i18n.js';

/**
 * @param {HTMLInputElement} input
 * @param {HTMLUListElement} list
 * @param {{onPick?: (id:number, name:string) => void, tp?: boolean, limit?: number}} opts
 */
// "Go to" entries for the header search (sections, vendors, dungeons, maps, achievements), loaded on first use.
let goto = null;
function loadGoto() {
  if (!goto) goto = fetch(`${document.body.dataset.data}/goto.json`).then((r) => r.json()).then((rows) => rows.map((r) => ({ r, key: norm(`${r[1]} | ${r[2]}`) }))).catch(() => []);
  return goto;
}
const KINDS = { page: ['Sección', 'Section'], npc: ['PNJ', 'NPC'], dg: ['Mazmorra', 'Dungeon'], map: ['Mapa', 'Map'], ach: ['Logro', 'Achievement'] };
const RANK = { page: 0, dg: 1, npc: 2, map: 3, ach: 4 };
function searchGoto(rows, q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const nq = norm(q);
  return rows.filter((e) => words.every((w) => e.key.includes(w)))
    .map((e) => ({ e, s: (e.key.startsWith(nq) ? 0 : 1) * 10 + RANK[e.r[0]] }))
    .sort((a, b) => a.s - b.s || a.e.key.length - b.e.key.length).slice(0, 4).map((x) => x.e);
}

export function autocomplete(input, list, opts = {}) {
  let results = [];
  let places = [];
  let active = -1;
  const limit = opts.limit || 8;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${i}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const pick = (i) => {
    if (i < places.length) { const r = places[i].r; close(); location.href = li === 0 ? r[3] : r[4]; return; }
    i -= places.length;
    const pos = results[i];
    if (pos == null) return;
    const id = index.ids[pos];
    const name = nameOf(pos, lang);
    close();
    if (opts.onPick) opts.onPick(id, name);
    else location.href = itemPath(lang, id, name);
  };

  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) { close(); return; }
    try { await loadIndex(); } catch { close(); return; }
    places = opts.global ? searchGoto(await loadGoto(), q) : [];
    results = search(q, { tp: opts.tp }).slice(0, limit - Math.min(places.length, 3));
    const placeHtml = places.map((p, i) => {
      const r = p.r;
      const sub = li === 0 ? r[5] : r[6];
      return `<li id="${list.id}-${i}" role="option" aria-selected="false" data-i="${i}" class="ac-place"><span class="tag tag-small tag-go-${r[0]}">${esc(KINDS[r[0]][li])}</span><span>${esc(r[1 + li] || r[2])}</span>${sub ? `<span class="muted small">${esc(sub)}</span>` : ''}</li>`;
    }).join('');
    if (!results.length && !places.length) {
      list.innerHTML = `<li class="ac-empty" role="option" aria-disabled="true">${esc(t('noResults'))}</li>`;
    } else {
      list.innerHTML = placeHtml + results.map((pos, j) => {
        const i = j + places.length;
        const r = RARITIES[index.rarity[pos]] || 'Basic';
        const other = lang === 'es' ? index.nameEn[pos] : index.nameEs[pos];
        const name = nameOf(pos, lang);
        return `<li id="${list.id}-${i}" role="option" aria-selected="false" data-i="${i}"><span class="r-txt-${r}">${esc(name)}</span>${other && other !== name ? `<span class="muted small" lang="${lang === 'es' ? 'en' : 'es'}">${esc(other)}</span>` : ''}</li>`;
      }).join('');
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  }, 120);

  input.addEventListener('focus', () => { loadIndex().catch(() => {}); }, { once: true });
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    const n = results.length + places.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(n ? (active + 1) % n : -1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(n ? (active - 1 + n) % n : -1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { close(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); pick(Number(li.dataset.i)); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  return { close };
}
