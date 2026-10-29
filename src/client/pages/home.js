// Home and Favorites: lists the starred items with their live price.
import { $, lang, li } from '../lib/env.js';
import { favs } from '../lib/fav.js';
import { prices } from '../lib/gw2.js';
import { esc, coin, iconUrl } from '../../shared/format.js';
import { itemPath } from '../../shared/i18n.js';

const box = $('#favs');
if (box) render();

async function render() {
  const list = favs();
  if (!list.length) { box.innerHTML = `<p class="muted">${esc(box.dataset.empty)}</p>`; return; }
  box.innerHTML = `<ul class="ref-grid fav-grid">${list.map((f) => {
    const name = (f.n && (f.n[li] || f.n[1 - li])) || f.name || `#${f.id}`;
    return `<li><a class="ref" href="${itemPath(lang, f.id, name)}">${f.ic ? `<img src="${esc(iconUrl(f.ic))}" alt="" width="32" height="32" loading="lazy" class="ic r-${esc(f.r)}">` : '<span class="ic ic-ph" aria-hidden="true"></span>'}<span class="ref-name r-txt-${esc(f.r || 'Basic')}">${esc(name)}</span><span class="ref-price small" data-fp="${f.id}"></span></a></li>`;
  }).join('')}</ul>`;
  try {
    const p = await prices(list.map((f) => f.id));
    for (const [id, v] of p) {
      const el = box.querySelector(`[data-fp="${id}"]`);
      if (el) el.innerHTML = `${coin(v.sell, { lang })}`;
    }
  } catch { /* prices are optional here */ }
}

