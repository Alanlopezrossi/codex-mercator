// Compare up to 4 items side by side. The list is in the URL (?ids=1,2) and in this browser (cm-compare).
import { $, lang, li, t, store } from '../lib/env.js';
import { autocomplete } from '../lib/autocomplete.js';
import { prices } from '../lib/gw2.js';
import { toast } from '../lib/toast.js';
import { esc, coin, num, iconUrl } from '../../shared/format.js';
import { itemPath, tr } from '../../shared/i18n.js';
import { shardOf } from '../../shared/data.js';

const MAX = 4;
const table = $('#cmpTable');
const note = $('#cmpNote');
const KEY = 'cm-compare';

const fromUrl = (new URLSearchParams(location.search).get('ids') || '').split(',').map(Number).filter((x) => x > 0);
let ids = [...new Set(fromUrl.length ? fromUrl : store.get(KEY, []))].slice(0, MAX);

const shards = new Map();
async function load(id) {
  const s = shardOf(id);
  if (!shards.has(s)) shards.set(s, fetch(`${document.body.dataset.data}/items/${s}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return (await shards.get(s))[id] || null;
}

function save() {
  store.set(KEY, ids);
  const qs = ids.length ? `?ids=${ids.join(',')}` : '';
  history.replaceState(null, '', `${location.pathname}${qs}`);
}

function add(id) {
  if (ids.includes(id)) return;
  if (ids.length >= MAX) { toast(t('cmp.full')); return; }
  ids.push(id);
  save();
  render();
}

async function render() {
  if (!ids.length) { table.innerHTML = `<p class="empty">${esc(t('cmp.empty'))}</p>`; note.textContent = ''; return; }
  table.innerHTML = `<p class="muted">${esc(t('loading'))}</p>`;
  const list = (await Promise.all(ids.map(load))).filter(Boolean);
  draw(list, new Map());
  // Live prices arrive after the table is shown (the API can be slow).
  const want = ids.join(',');
  try { const p = await prices(list.map((x) => x.id)); if (ids.join(',') === want) draw(list, p); } catch { /* prices are optional */ }
}

function draw(list, p) {
  const name = (it) => it.n[li] || it.n[1 - li];
  // Rows: [label, value per item (number for comparisons or null), html per item]
  const rows = [];
  const row = (label, get, fmt = (v) => num(v, lang)) => {
    const vals = list.map(get);
    if (vals.every((v) => v == null || v === '' || v === 0)) return;
    const nums = vals.filter((v) => typeof v === 'number');
    const best = nums.length > 1 ? Math.max(...nums) : null;
    rows.push([label, vals.map((v) => ({ html: v == null || v === '' ? `<span class="muted">${esc(t('cmp.none'))}</span>` : (typeof v === 'number' ? fmt(v) : esc(v)), best: best != null && v === best && nums.filter((x) => x === best).length < nums.length }))]);
  };
  row(t('rarity'), (it) => tr.rarity(lang, it.r));
  row(t('type'), (it) => [tr.type(lang, it.t), it.st && it.st !== it.t ? tr.sub(lang, it.st) : ''].filter(Boolean).join(' · '));
  row(t('level'), (it) => it.l || null);
  row(t('item.weight'), (it) => (it.x?.w ? tr.weight(lang, it.x.w) : null));
  row(t('item.defense'), (it) => it.x?.def ?? null);
  row(t('item.power'), (it) => (it.x?.pw ? Math.round((it.x.pw[0] + it.x.pw[1]) / 2) : null), (v) => `${num(v, lang)} <span class="small muted">(${lang === 'es' ? 'promedio' : 'average'})</span>`);
  const attrs = [...new Set(list.flatMap((it) => (it.x?.at || []).map(([a]) => a)))];
  for (const a of attrs) row(tr.attr(lang, a), (it) => (it.x?.at || []).find(([k]) => k === a)?.[1] ?? null, (v) => `+${num(v, lang)}`);
  row(t('item.slots'), (it) => it.x?.inf || null);
  row(lang === 'es' ? 'Espacios de bolsa' : 'Bag slots', (it) => it.x?.size || null);
  row(t('cmp.sell'), (it) => p.get(it.id)?.sell || null, (v) => coin(v, { lang }));
  row(t('cmp.buy'), (it) => p.get(it.id)?.buy || null, (v) => coin(v, { lang }));
  row(t('cmp.vendor'), (it) => it.v || null, (v) => coin(v, { lang }));
  const headCells = list.map((it) => `<th scope="col" class="cmp-item">
      <a href="${itemPath(lang, it.id, name(it))}" class="cmp-link">${it.ic ? `<img src="${esc(iconUrl(it.ic))}" alt="" width="48" height="48" class="ic ic-lg r-${esc(it.r)}">` : ''}<span class="r-txt-${esc(it.r)}">${esc(name(it))}</span></a>
      <button type="button" class="btn btn-small" data-rm="${it.id}" aria-label="${esc(t('cmp.remove'))}: ${esc(name(it))}">✕ ${esc(t('cmp.remove'))}</button></th>`).join('');
  table.innerHTML = `<table class="data-table cmp-table"><thead><tr><th scope="col" class="left"><span class="sr-only">${esc(t('cmp.title'))}</span></th>${headCells}</tr></thead>
    <tbody>${rows.map(([label, cells]) => `<tr><th scope="row" class="left">${esc(label)}</th>${cells.map((c) => `<td class="left${c.best ? ' cmp-best' : ''}">${c.html}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  note.textContent = list.length > 1 ? t('cmp.best') : '';
}

table.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]');
  if (!b) return;
  ids = ids.filter((x) => x !== Number(b.dataset.rm));
  save();
  render();
});
$('#cmpClear').addEventListener('click', () => { ids = []; save(); render(); });
$('#cmpShare').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast(t('copied')); } catch { toast(location.href); }
});
$('#cmpForm').addEventListener('submit', (e) => e.preventDefault());
autocomplete($('#cq'), $('#cq-list'), { onPick: (id) => { $('#cq').value = ''; add(id); } });
save();
render();
