// Crafting tree: expands every ingredient that can itself be crafted (artisan recipe or Mystic Forge) down to the
// base materials, with the total of raw materials and their live trading post cost. Data comes from the item shards.
import { lang, li, t } from './env.js';
import { prices } from './gw2.js';
import { esc, coin, num, iconUrl } from '../../shared/format.js';
import { itemPath, tr } from '../../shared/i18n.js';
import { shardOf } from '../../shared/data.js';

const MAX_DEPTH = 10;
const MAX_NODES = 1500;
const shards = new Map();
async function load(id) {
  const s = shardOf(id);
  if (!shards.has(s)) shards.set(s, fetch(`${document.body.dataset.data}/items/${s}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return (await shards.get(s))[id] || null;
}

// The recipe used to make an item: artisan recipe first, otherwise the first Mystic Forge recipe.
function recipeOf(it, root = false) {
  if (it.rc?.length) {
    const r = it.rc[0];
    return { kind: 'craft', q: r.q || 1, d: r.d || [], m: r.m || 0, i: r.i.map(([id, n]) => [id, n]) };
  }
  // Mystic Forge: tradable materials have "promotion" recipes (e.g. dust from lower-tier dust) that are not how
  // anyone gets them, so below the root they count as base materials (buy or farm them).
  const f = it.w?.forge?.[0] || it.mf?.[0];
  if (f && (root || !it.tp)) return { kind: 'forge', q: f.q || 1, i: f.i.filter(([id]) => id).map(([id, n]) => [id, n]) };
  return null;
}

// 1) Load every item of the tree level by level (in parallel), 2) build the tree from memory (same result every time).
const cache = new Map();
async function preload(rootId) {
  let level = [rootId];
  const seen = new Set();
  for (let d = 0; d <= MAX_DEPTH && level.length && seen.size < MAX_NODES; d++) {
    const ids = level.filter((x) => !seen.has(x));
    ids.forEach((x) => seen.add(x));
    const its = await Promise.all(ids.map(load));
    const next = [];
    its.forEach((it, k) => { cache.set(ids[k], it); const r = it && recipeOf(it, ids[k] === rootId); if (r) for (const [cid] of r.i) if (!seen.has(cid)) next.push(cid); });
    level = [...new Set(next)];
  }
}
function build(id, qty, depth, path, counter) {
  const it = cache.get(id) || null;
  const node = { id, qty, it, kids: [] };
  if (!it || depth >= MAX_DEPTH || path.has(id) || counter.n > MAX_NODES) return node;
  const r = recipeOf(it, depth === 0);
  if (!r || !r.i.length) return node;
  node.r = r;
  const runs = Math.ceil(qty / (r.q || 1));
  node.runs = runs;
  const next = new Set(path).add(id);
  for (const [cid, n] of r.i) { counter.n++; node.kids.push(build(cid, n * runs, depth + 1, next, counter)); }
  return node;
}

function leaves(node, acc = new Map()) {
  if (!node.kids.length) acc.set(node.id, (acc.get(node.id) || 0) + node.qty);
  else for (const k of node.kids) leaves(k, acc);
  return acc;
}

// How to get one item, in short (from its own data): crafted, Mystic Forge, vendors, containers, gathering,
// drops/rewards, achievements and the trading post. Shown when the "how to get it" button of a row is tapped.
function acqHtml(it, id) {
  const es = lang === 'es';
  if (!it) return `<p class="small muted">${es ? 'Sin datos.' : 'No data.'}</p>`;
  const L = (p) => (p ? p[li] || p[1 - li] || '' : '');
  const more = (n) => (n > 0 ? ` <span class="muted">+${n}</span>` : '');
  const lines = [];
  if (it.rc?.length) lines.push([es ? 'Se fabrica' : 'Crafted', esc(it.rc[0].d.map((d) => tr.discipline(lang, d)).join(' / ') || '') + (it.rc[0].m ? ` ${it.rc[0].m}` : '')]);
  if (it.w?.forge?.length || it.mf?.length) lines.push([t('item.forge'), es ? 'Receta en la Forja Mística' : 'Mystic Forge recipe']);
  const sold = it.w?.sold || [];
  if (sold.length) lines.push([es ? 'Lo venden' : 'Sold by', sold.slice(0, 3).map((r) => { const loc = (r.l || [{ a: r.a, z: r.z }])[0] || {}; const where = [L(loc.a), L(loc.z)].filter(Boolean).join(', '); return `${esc(L(r.v))}${where ? ` <span class="muted">(${esc(where)})</span>` : ''}${L(r.c) ? ` · ${esc(L(r.c))}` : ''}`; }).join('<br>') + more(sold.length - 3)]);
  const cont = [...(it.ci || []).map(([bid]) => (it.refs?.[bid] ? [it.refs[bid][0], it.refs[bid][1]] : null)).filter(Boolean), ...(it.w?.cont || []).map((e) => e.n)];
  if (cont.length) lines.push([es ? 'Viene en' : 'Contained in', cont.slice(0, 3).map((n) => esc(L(n))).join(' · ') + more(cont.length - 3)]);
  if (it.w?.gath?.length) lines.push([es ? 'Se recolecta' : 'Gathered', it.w.gath.slice(0, 3).map((e) => esc(L(e.n))).join(' · ') + more(it.w.gath.length - 3)]);
  const src = it.w?.src || [];
  if (src.length) lines.push([es ? 'Se obtiene de' : 'Obtained from', src.slice(0, 3).map((e) => esc(L(e.n))).join(' · ') + more(src.length - 3)]);
  if (it.ach?.length) lines.push([es ? 'Logros' : 'Achievements', it.ach.slice(0, 2).map(([, aes, aen]) => esc(li === 0 ? aes : aen)).join(' · ') + more(it.ach.length - 2)]);
  if (it.tp) lines.push([es ? 'Bazar' : 'Trading post', es ? 'Se compra y vende en el bazar' : 'Bought and sold on the trading post']);
  const body = lines.length
    ? `<dl class="tr-acq">${lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`
    : `<p class="small muted">${es ? 'No tenemos datos de cómo se consigue.' : 'We have no data on how to get it.'}</p>`;
  return `${body}<p class="small"><a href="${itemPath(lang, id, it.n[li] || it.n[1 - li])}">${es ? 'Ver ficha completa →' : 'Full item page →'}</a></p>`;
}
const infoBtn = (id) => `<button type="button" class="tr-info" data-info="${id}" aria-expanded="false" aria-label="${lang === 'es' ? 'Cómo se consigue' : 'How to get it'}" title="${lang === 'es' ? 'Cómo se consigue' : 'How to get it'}">?</button>`;

const nameOf = (it, id) => (it ? it.n[li] || it.n[1 - li] : `#${id}`);
const icon = (it) => (it?.ic ? `<img src="${esc(iconUrl(it.ic))}" alt="" width="28" height="28" loading="lazy" class="ic r-${esc(it.r)}">` : '<span class="ic ic-ph" aria-hidden="true"></span>');

function nodeHtml(node, depth = 0) {
  const it = node.it;
  const label = `${icon(it)}<span class="tr-qty">${num(node.qty, lang)}×</span><a class="r-txt-${esc(it?.r || 'Basic')}" href="${itemPath(lang, node.id, nameOf(it, node.id))}">${esc(nameOf(it, node.id))}</a>`;
  if (!node.kids.length) return `<li class="tr-leaf"><span class="tr-row">${label}${infoBtn(node.id)}<span class="tr-price" data-tp="${node.id}" data-n="${node.qty}"></span></span></li>`;
  const how = node.r.kind === 'forge'
    ? `<span class="tag tag-small tag-forge">${esc(t('item.forge'))}</span>`
    : `<span class="tag tag-small">${esc(node.r.d.map((d) => tr.discipline(lang, d)).join(' / ') || (lang === 'es' ? 'Artesanía' : 'Crafting'))}${node.r.m ? ` ${node.r.m}` : ''}</span>`;
  const row = `<span class="tr-row">${label}${how}${infoBtn(node.id)}</span>`;
  const kids = `<ul>${node.kids.map((k) => nodeHtml(k, depth + 1)).join('')}</ul>`;
  if (depth === 0) return `<li class="tr-node tr-root">${row}${kids}</li>`;
  // A toggle button next to the row (links inside <summary> are not accessible).
  const open = depth < 3;
  return `<li class="tr-node${open ? '' : ' is-closed'}"><button type="button" class="tr-toggle" aria-expanded="${open}" aria-label="${lang === 'es' ? 'Mostrar u ocultar ingredientes' : 'Show or hide ingredients'}"></button>${row}${kids}</li>`;
}

/** Renders the tree of the item into `box` (a section element). */
export async function renderTree(box, id) {
  const counter = { n: 0 };
  await preload(id);
  const root = build(id, 1, 0, new Set(), counter);
  if (!root.kids.length) { box.hidden = true; return; }
  // Only worth showing when at least one ingredient is itself crafted (otherwise the recipe card says it all).
  const deep = root.kids.some((k) => k.kids.length);
  const base = leaves(root);
  const rows = [...base.entries()].sort((a, b) => b[1] - a[1]);
  const items = await Promise.all(rows.map(([lid]) => load(lid)));
  rows.forEach(([lid], i) => { if (!cache.has(lid)) cache.set(lid, items[i]); });
  const es = lang === 'es';
  box.innerHTML = `<h2 id="tree-h">${es ? 'Árbol de fabricación' : 'Crafting tree'}</h2>
    <p class="small muted">${es ? 'Todo lo que hay que fabricar, paso a paso, hasta los materiales básicos. Tocá un ítem para ver su ficha.' : 'Everything to craft, step by step, down to the base materials. Tap an item to open it.'}${counter.n > MAX_NODES ? ` ${es ? '(Árbol recortado: es muy grande.)' : '(Tree trimmed: it is very large.)'}` : ''}</p>
    ${deep ? `<ul class="tree">${nodeHtml(root)}</ul>` : ''}
    <h3 class="h-sub">${es ? 'Materiales básicos en total' : 'Total base materials'} <span class="count">${rows.length}</span></h3>
    <ul class="tr-total">${rows.map(([lid, n], i) => `<li><span class="tr-row">${icon(items[i])}<span class="tr-qty">${num(n, lang)}×</span><a class="r-txt-${esc(items[i]?.r || 'Basic')}" href="${itemPath(lang, lid, nameOf(items[i], lid))}">${esc(nameOf(items[i], lid))}</a>${infoBtn(lid)}<span class="tr-price" data-tp="${lid}" data-n="${n}"></span></span></li>`).join('')}</ul>
    <p class="small" id="treeCost"></p>`;
  box.hidden = false;
  box.addEventListener('click', (e) => {
    const info = e.target.closest('.tr-info');
    if (info) {
      const row = info.closest('.tr-row');
      let panel = row.nextElementSibling?.classList.contains('tr-acq-box') ? row.nextElementSibling : null;
      if (panel) { panel.remove(); info.setAttribute('aria-expanded', 'false'); return; }
      const iid = Number(info.dataset.info);
      panel = document.createElement('div');
      panel.className = 'tr-acq-box';
      panel.innerHTML = acqHtml(cache.get(iid), iid);
      row.after(panel);
      info.setAttribute('aria-expanded', 'true');
      return;
    }
    const b = e.target.closest('.tr-toggle');
    if (!b) return;
    const li = b.parentElement;
    const open = li.classList.toggle('is-closed') === false;
    b.setAttribute('aria-expanded', String(open));
  });
  // Live prices for the base materials (sell price, i.e. buying them instantly).
  try {
    const p = await prices(rows.map(([lid]) => lid));
    let total = 0;
    let missing = 0;
    for (const el of box.querySelectorAll('[data-tp]')) {
      const v = p.get(Number(el.dataset.tp));
      const n = Number(el.dataset.n);
      el.innerHTML = v?.sell ? coin(v.sell * n, { lang }) : `<span class="muted">${es ? 'no se vende' : 'not tradable'}</span>`;
    }
    for (const [lid, n] of rows) { const v = p.get(lid); if (v?.sell) total += v.sell * n; else missing++; }
    box.querySelector('#treeCost').innerHTML = `<strong>${es ? 'Costo de los materiales comprables' : 'Cost of the tradable materials'}:</strong> ${coin(total, { lang })}${missing ? ` <span class="muted">· ${es ? `${missing} material(es) no se venden en el bazar (se consiguen jugando)` : `${missing} material(s) are not on the trading post (earned in game)`}</span>` : ''}`;
  } catch { /* prices are optional */ }
}
