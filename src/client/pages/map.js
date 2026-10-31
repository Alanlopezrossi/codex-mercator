// Map of Tyria with Leaflet, official tiles and waypoints. Side panel: search + boxes to pick what to show,
// and a list of results (maps, waypoints, events) that center the map when tapped.
import L from 'leaflet';
import { $, lang, li, t, debounce } from '../lib/env.js';
import { toast } from '../lib/toast.js';
import { norm } from '../lib/search.js';
import { esc, num } from '../../shared/format.js';

const el = $('#gmap');
const q = $('#mq');
const resEl = $('#mres');
const countEl = $('#mcount');
const kinds = () => new Set([...document.querySelectorAll('input[name="mkind"]:checked')].map((i) => i.value));
const KIND_LABEL = { map: lang === 'es' ? 'Mapa' : 'Map', wp: lang === 'es' ? 'Punto de ruta' : 'Waypoint', ev: lang === 'es' ? 'Evento' : 'Event', dg: lang === 'es' ? 'Mazmorra' : 'Dungeon' };
const valid = (s) => s && !/^[\s?¿]*$/.test(s);

async function init() {
  let geo;
  try {
    geo = await fetch(`${document.body.dataset.data}/geo.json`).then((r) => r.json());
  } catch {
    el.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  // API coordinates are pixels at zoom 7 (the tiles go up to 7).
  const Z = 7;
  const map = L.map(el, { crs: L.CRS.Simple, minZoom: 1, maxZoom: Z + 1, zoomSnap: 0.25, zoomDelta: 0.5, preferCanvas: true, attributionControl: true });
  const un = (x, y) => map.unproject([x, y], Z);
  const [W, H] = geo.dims;
  // Where the maps really are (the texture has a lot of empty black space around the continent).
  const rects = geo.maps.map((m) => m.rect).filter((r) => r && r[1][0] - r[0][0] < 20000);
  const minX = Math.min(...rects.map((r) => r[0][0]));
  const minY = Math.min(...rects.map((r) => r[0][1]));
  const maxX = Math.max(...rects.map((r) => r[1][0]));
  const maxY = Math.max(...rects.map((r) => r[1][1]));
  const content = L.latLngBounds(un(minX, maxY), un(maxX, minY));
  L.tileLayer('https://tiles.guildwars2.com/1/1/{z}/{x}/{y}.jpg', {
    minZoom: 1, maxZoom: Z + 1, minNativeZoom: 0, maxNativeZoom: Z, bounds: L.latLngBounds(un(0, H), un(W, 0)), noWrap: true, attribution: '© ArenaNet',
  }).addTo(map);
  map.setMaxBounds(content.pad(0.15));
  // Fill the whole frame from the start: zoom so the continent covers the map box (no black borders).
  // Start on the core of Tyria (10th–90th percentile of map centers, so far-away regions like Cantha do not
  // leave the view on open ocean), zoomed so the tiles fill the whole frame.
  const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor((arr.length - 1) * p)];
  const cx = rects.map((r) => (r[0][0] + r[1][0]) / 2);
  const cy = rects.map((r) => (r[0][1] + r[1][1]) / 2);
  const core = L.latLngBounds(un(pct(cx, 0.1), pct(cy, 0.6)), un(pct(cx, 0.9), pct(cy, 0.1)));
  const fit = () => {
    map.setMinZoom(Math.max(1, map.getBoundsZoom(content, false)));
    map.fitBounds(core, { animate: false });
    map.setZoom(Math.max(map.getZoom(), map.getBoundsZoom(content, true)), { animate: false });
  };
  fit();

  const layer = L.layerGroup();
  const wpName = (w) => w.n[li] || w.n[1];
  for (const w of geo.wps) {
    if (!valid(wpName(w))) continue;
    const m = L.circleMarker(un(w.c[0], w.c[1]), { radius: 5, color: '#0d1117', weight: 1.5, fillColor: '#4fb3ff', fillOpacity: 0.95 });
    m.bindTooltip(wpName(w), { direction: 'top' });
    m.on('click', () => showPoint(w.c, wpName(w), w.chat));
    layer.addLayer(m);
  }
  const sync = () => { if (map.getZoom() >= 4.5 && kinds().has('wp')) layer.addTo(map); else layer.remove(); };
  map.on('zoomend', sync);
  sync();

  function showPoint(pos, name, chat) {
    const ll = un(pos[0], pos[1]);
    map.setView(ll, Math.max(map.getZoom(), 6));
    L.popup().setLatLng(ll).setContent(`<strong>${esc(name)}</strong>${chat ? `<br><button type="button" class="btn btn-small copy-btn" data-copy="${esc(chat)}"><code>${esc(chat)}</code></button>` : ''}`).openOn(map);
    if (chat) {
      navigator.clipboard?.writeText(chat).then(() => toast(`${t('copied')}: ${chat}`)).catch(() => {});
    }
  }

  // Search entries
  const mapsById = new Map(geo.maps.map((m) => [m.id, m]));
  const entries = [];
  const seen = new Set();
  const add = (e) => {
    if (!valid(e.label)) return;
    const k = `${e.kind}|${e.label}`;
    if (seen.has(k)) return;
    seen.add(k);
    e.key = norm(`${e.label} ${e.sub || ''} ${e.alt || ''}`);
    entries.push(e);
  };
  for (const m of geo.maps) if (m.rect) add({ kind: 'map', label: m.n[li] || m.n[1], alt: m.n[1 - li], sub: m.reg?.[li], m });
  for (const w of geo.wps) add({ kind: 'wp', label: wpName(w), alt: w.n[1 - li], sub: mapsById.get(w.m)?.n[li], w });
  try {
    const evs = (await fetch(`${document.body.dataset.data}/events.json`).then((r) => r.json())).events;
    for (const ev of evs) for (const sg of Object.values(ev.s)) {
      if (!sg.pos) continue;
      add({ kind: 'ev', label: sg.n[li] || sg.n[1], alt: sg.n[1 - li], sub: ev.n[li], pos: sg.pos, chat: sg.wp });
    }
  } catch { /* events are optional on the map */ }
  try {
    const dg = await fetch(`${document.body.dataset.data}/dungeons.json`).then((r) => r.json());
    for (const x of [...dg.dungeons, ...dg.other]) if (x.pos) add({ kind: 'dg', label: x.n[li] || x.n[1], alt: x.n[1 - li], sub: x.mapN?.[li], pos: x.pos, chat: x.chat });
  } catch { /* dungeons are optional on the map */ }

  function go(e) {
    if (e.kind === 'map') map.fitBounds(L.latLngBounds(un(e.m.rect[0][0], e.m.rect[1][1]), un(e.m.rect[1][0], e.m.rect[0][1])));
    else if (e.kind === 'ev' || e.kind === 'dg') showPoint(e.pos, `${e.label} — ${e.sub}`, e.chat);
    else showPoint(e.w.c, e.label, e.w.chat);
    if (matchMedia('(max-width: 900px)').matches) el.scrollIntoView({ block: 'start' });
  }

  let shown = [];
  function renderList() {
    const ks = kinds();
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    const all = entries.filter((e) => ks.has(e.kind) && words.every((w) => e.key.includes(w)));
    shown = all.slice(0, 120);
    countEl.textContent = `${num(all.length, lang)} ${t('results')}`;
    resEl.innerHTML = shown.map((e, i) => `<li><button type="button" class="map-hit" data-i="${i}"><span class="tag tag-${e.kind}">${esc(KIND_LABEL[e.kind])}</span><span class="map-hit-name">${esc(e.label)}</span>${e.sub ? `<span class="small muted">${esc(e.sub)}</span>` : ''}</button></li>`).join('')
      || `<li class="muted small">${esc(t('noResults'))}</li>`;
    sync();
  }
  resEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-i]');
    if (b) go(shown[Number(b.dataset.i)]);
  });
  q.addEventListener('input', debounce(renderList, 120));
  document.addEventListener('change', (ev) => { if (ev.target.name === 'mkind') renderList(); });
  renderList();

  // Links from Events: /map#@x,y,label,waypoint
  const m = location.hash.match(/^#@(-?\d+),(-?\d+)(?:,([^,]*))?(?:,([^,]*))?/);
  if (m) {
    const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return ''; } };
    showPoint([Number(m[1]), Number(m[2])], dec(m[3]), dec(m[4]));
    el.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('resize', debounce(() => map.invalidateSize(), 200));
}
if (el) init();
