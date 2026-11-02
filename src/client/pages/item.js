// Item page: live price, recipe ingredient cost and favorite button.
import { $, $$, lang, t, relTime } from '../lib/env.js';
import { prices } from '../lib/gw2.js';
import { isFav, toggleFav } from '../lib/fav.js';
import { toast } from '../lib/toast.js';
import { coin, num, netSale } from '../../shared/format.js';
import { renderTree } from '../lib/tree.js';

const art = $('article.item');
const id = Number(art?.dataset.item);

// Favorite
const fb = $('#favBtn');
if (fb && id) {
  const label = fb.querySelector('span');
  const sync = () => {
    const on = isFav(id);
    fb.setAttribute('aria-pressed', String(on));
    label.textContent = on ? fb.dataset.on : fb.dataset.off;
  };
  sync();
  fb.addEventListener('click', () => {
    const on = toggleFav({ id, n: [art.dataset.nameEs, art.dataset.nameEn], ic: art.dataset.icon, r: art.dataset.rarity });
    sync();
    toast(on ? fb.dataset.on : fb.dataset.off);
  });
}

// Compare: adds this item to the comparison list (up to 4, saved in this browser).
const cb = $('#cmpBtn');
if (cb && id) {
  cb.addEventListener('click', () => {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem('cm-compare') || '[]'); } catch { /* blocked */ }
    if (!ids.includes(id)) {
      if (ids.length >= 4) ids.shift();
      ids.push(id);
      try { localStorage.setItem('cm-compare', JSON.stringify(ids)); } catch { /* blocked */ }
    }
    location.href = `${cb.dataset.href}?ids=${ids.join(',')}`;
  });
}

// Live price and recipe cost
const box = $('#price');
const ingIds = [...new Set($$('[data-ing]').map((el) => Number(el.dataset.ing)))];
let lastAt = 0;

async function refresh() {
  const ids = [...(box ? [id] : []), ...ingIds];
  if (!ids.length) return;
  let p;
  try {
    p = await prices(ids);
  } catch {
    if (box) $('[data-p="stamp"]', box).textContent = t('error');
    return;
  }
  lastAt = Date.now();
  if (box) {
    const v = p.get(id);
    const set = (k, html) => { const el = $(`[data-p="${k}"]`, box); if (el) el.innerHTML = html; };
    if (v) {
      set('sell', coin(v.sell, { lang }));
      set('buy', coin(v.buy, { lang }));
      set('supply', num(v.sellQty, lang));
      set('demand', num(v.buyQty, lang));
      set('net', v.sell ? `${t('item.youGet')}: ${coin(netSale(v.sell), { lang })}` : '');
    } else {
      for (const k of ['sell', 'buy', 'supply', 'demand']) set(k, '—');
    }
    stamp();
  }
  // Cost of each recipe buying the ingredients at the sell price (only when all of them are on the trading post).
  for (const el of $$('[data-cost-for]')) {
    const rows = $$('[data-ing]', el.closest('.recipe'));
    let total = 0;
    let ok = rows.length > 0;
    for (const r of rows) {
      const v = p.get(Number(r.dataset.ing));
      if (!v || !v.sell) { ok = false; break; }
      total += v.sell * Number(r.dataset.count);
    }
    const out = Number(el.dataset.out) || 1;
    el.innerHTML = ok
      ? `${lang === 'es' ? 'Costo de ingredientes (precio de venta)' : 'Ingredient cost (sell price)'}: ${coin(total, { lang })}${out > 1 ? ` · ${coin(Math.round(total / out), { lang })} ${lang === 'es' ? 'c/u' : 'each'}` : ''}`
      : '';
  }
}

function stamp() {
  const el = box && $('[data-p="stamp"]', box);
  if (el && lastAt) el.textContent = `${t('item.liveNote')} ${t('item.updatedAgo')} ${relTime(lastAt)}.`;
}

refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
setInterval(stamp, 15000);

// Crafting tree down to base materials (only items that are crafted or made in the Mystic Forge).
const treeBox = $('#tree');
if (treeBox && id) renderTree(treeBox, id).catch(() => { treeBox.hidden = true; });
