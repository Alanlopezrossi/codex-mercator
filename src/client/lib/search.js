// Client-side item search over the TSV index (id, name es, name en, rarity, type, level, tradable).
import { searchFile } from './env.js';

let loading = null;
export let index = null;

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// Words of a search, without small words that the game names may or may not have ("Don de la realidad" finds
// "Don de realidad"; "gift of the reality" finds "Gift of Reality"). Shared by every search box of the site.
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'a', 'al', 'en', 'un', 'una', 'of', 'the', 'and', 'a', 'an', 'to', 'in']);
export function terms(q) {
  const all = norm(q).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  const main = all.filter((w) => !STOP.has(w));
  return main.length ? main : all;
}

export function loadIndex() {
  if (index) return Promise.resolve(index);
  if (loading) return loading;
  loading = fetch(searchFile).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }).then((txt) => {
    const lines = txt.split('\n');
    const n = lines.length;
    const ids = new Int32Array(n);
    const nameEs = new Array(n);
    const nameEn = new Array(n);
    const key = new Array(n);
    const rarity = new Int8Array(n);
    const type = new Int8Array(n);
    const level = new Int8Array(n);
    const tp = new Uint8Array(n);
    const byId = new Map();
    for (let i = 0; i < n; i++) {
      const c = lines[i].split('\t');
      ids[i] = Number(c[0]);
      nameEs[i] = c[1];
      nameEn[i] = c[2] || c[1];
      key[i] = norm(c[2] ? `${c[1]} | ${c[2]}` : c[1]);
      rarity[i] = Number(c[3]);
      type[i] = Number(c[4]);
      level[i] = Number(c[5]);
      tp[i] = c[6] === '1' ? 1 : 0;
      byId.set(ids[i], i);
    }
    index = { n, ids, nameEs, nameEn, key, rarity, type, level, tp, byId };
    return index;
  }).catch((e) => { loading = null; throw e; });
  return loading;
}

/** Decodes an item chat code [&AgH...] to its ID (or null). */
export function chatCodeId(s) {
  const m = String(s).match(/\[&([A-Za-z0-9+/=]+)\]/);
  if (!m) return null;
  try {
    const b = atob(m[1]);
    if (b.charCodeAt(0) !== 2) return null;
    return b.charCodeAt(2) | (b.charCodeAt(3) << 8) | (b.charCodeAt(4) << 16);
  } catch { return null; }
}

export function nameOf(i, lang) {
  return lang === 'es' ? index.nameEs[i] : index.nameEn[i];
}

/**
 * Returns positions in the index that match the query and the filters, ordered by relevance.
 * @param {string} q
 * @param {{type?:number, rarity?:number, lmin?:number, lmax?:number, tp?:boolean, limit?:number}} f
 */
export function search(q, f = {}) {
  const ix = index;
  const out = [];
  const pass = (i) => (f.type == null || ix.type[i] === f.type) && (f.rarity == null || ix.rarity[i] === f.rarity)
    && (f.lmin == null || ix.level[i] >= f.lmin) && (f.lmax == null || ix.level[i] <= f.lmax) && (!f.tp || ix.tp[i]);
  const id = /^\d{1,7}$/.test(String(q).trim()) ? Number(q) : chatCodeId(q);
  if (id != null) {
    const i = ix.byId.get(id);
    if (i != null && pass(i)) out.push(i);
  }
  const nq = norm(q);
  if (!nq || (id != null && /^\d+$/.test(nq))) {
    if (!nq) for (let i = 0; i < ix.n; i++) if (pass(i)) out.push(i);
    return out;
  }
  const words = terms(q);
  const scored = [];
  for (let i = 0; i < ix.n; i++) {
    const k = ix.key[i];
    let ok = true;
    for (const w of words) if (!k.includes(w)) { ok = false; break; }
    if (!ok || !pass(i)) continue;
    let s = 0;
    if (k === nq || k.startsWith(`${nq} |`) || k.endsWith(`| ${nq}`)) s += 100;
    else if (k.startsWith(nq) || k.includes(`| ${nq}`)) s += 50;
    else if (k.includes(` ${words[0]}`)) s += 10;
    s += ix.tp[i] * 5 + ix.rarity[i] * 0.5 - k.length * 0.05;
    scored.push([s, i]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  for (const [, i] of scored) if (!out.includes(i)) out.push(i);
  return out;
}
