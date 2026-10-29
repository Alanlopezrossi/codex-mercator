// Accessible autocomplete (ARIA combobox pattern) on top of the item index.
import { lang, debounce, t } from './env.js';
import { loadIndex, search, nameOf, index } from './search.js';
import { esc } from '../../shared/format.js';
import { RARITIES, itemPath } from '../../shared/i18n.js';

/**
 * @param {HTMLInputElement} input
 * @param {HTMLUListElement} list
 * @param {{onPick?: (id:number, name:string) => void, tp?: boolean, limit?: number}} opts
 */
export function autocomplete(input, list, opts = {}) {
  let results = [];
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
    results = search(q, { tp: opts.tp }).slice(0, limit);
    if (!results.length) {
      list.innerHTML = `<li class="ac-empty" role="option" aria-disabled="true">${esc(t('noResults'))}</li>`;
    } else {
      list.innerHTML = results.map((pos, i) => {
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
    const n = results.length;
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
