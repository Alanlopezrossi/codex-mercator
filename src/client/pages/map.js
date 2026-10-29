// Map of Tyria with Leaflet, official tiles and waypoints (click = copy code).
import L from 'leaflet';
import { $, lang, li, t } from '../lib/env.js';
import { toast } from '../lib/toast.js';
import { esc, num } from '../../shared/format.js';

const el = $('#gmap');
const q = $('#mq');
const dl = $('#mqlist');
const countEl = $('#mcount');

async function init() {
  let geo;
  try {
    geo = await fetch(`${document.body.dataset.data}/geo.json`).then((r) => r.json());
  } catch {
    el.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  const [W, H] = geo.dims;
  // API coordinates are pixels at zoom 7 (the tiles go up to 7).
  const Z = 7;
  const map = L.map(el, { crs: L.CRS.Simple, minZoom: -1, maxZoom: Z + 1, zoomSnap: 0.5, zoomDelta: 0.5, preferCanvas: true });
  const un = (x, y) => map.unproject([x, y], Z);
  const bounds = L.latLngBounds(un(0, H), un(W, 0));
  L.tileLayer('https://tiles.guildwars2.com/1/1/{z}/{x}/{y}.jpg', {
    minZoom: -1, maxZoom: Z + 1, minNativeZoom: 0, maxNativeZoom: Z, bounds, noWrap: true, attribution: '© ArenaNet',
  }).addTo(map);
  map.setMaxBounds(bounds.pad(0.25));
  map.fitBounds(bounds);

  const layer = L.layerGroup();
  const markers = [];
  for (const w of geo.wps) {
    const m = L.circleMarker(un(w.c[0], w.c[1]), { radius: 5, color: '#0d1117', weight: 1.5, fillColor: '#4fb3ff', fillOpacity: 0.95 });
    const name = w.n[li] || w.n[1];
    m.bindTooltip(name, { direction: 'top' });
    m.on('click', async () => {
      try { await navigator.clipboard.writeText(w.chat); } catch { /* fallback: popup shows it */ }
      L.popup().setLatLng(m.getLatLng()).setContent(`<strong>${esc(name)}</strong><br><code>${esc(w.chat)}</code>`).openOn(map);
      toast(`${t('copied')}: ${w.chat}`);
    });
    markers.push(m);
    layer.addLayer(m);
  }
  const sync = () => { if (map.getZoom() >= 4) layer.addTo(map); else layer.remove(); };
  map.on('zoomend', sync);
  sync();
  countEl.textContent = `${num(geo.wps.length, lang)} ${t('map.waypoints')}`;

  const mapsById = new Map(geo.maps.map((m) => [m.id, m]));
  const options = [
    ...geo.maps.filter((m) => m.rect).map((m) => ({ label: m.n[li] || m.n[1], kind: 'map', m })),
    ...geo.wps.map((w) => ({ label: `${w.n[li] || w.n[1]} — ${mapsById.get(w.m)?.n[li] || ''}`, kind: 'wp', w })),
  ];
  // Events (world bosses, metas) with a position: they can be searched from here too.
  try {
    const evs = (await fetch(`${document.body.dataset.data}/events.json`).then((r) => r.json())).events;
    const seen = new Set();
    for (const ev of evs) for (const sg of Object.values(ev.s)) {
      if (!sg.pos) continue;
      const label = `${lang === 'es' ? 'Evento' : 'Event'}: ${sg.n[li] || sg.n[1]} — ${ev.n[li]}`;
      if (seen.has(label)) continue;
      seen.add(label);
      options.push({ label, kind: 'ev', pos: sg.pos, name: `${sg.n[li] || sg.n[1]} — ${ev.n[li]}`, chat: sg.wp });
    }
  } catch { /* events are optional on the map */ }
  const byLabel = new Map(options.map((o) => [o.label, o]));
  dl.innerHTML = [...byLabel.keys()].slice(0, 4000).map((l) => `<option value="${esc(l)}"></option>`).join('');
  q.addEventListener('change', () => {
    const o = byLabel.get(q.value);
    if (!o) return;
    if (o.kind === 'map') map.fitBounds(L.latLngBounds(un(o.m.rect[0][0], o.m.rect[1][1]), un(o.m.rect[1][0], o.m.rect[0][1])));
    else if (o.kind === 'ev') showPoint(o.pos, o.name, o.chat);
    else map.setView(un(o.w.c[0], o.w.c[1]), 6);
  });

  // Links from Events: /mapa#@x,y,label,waypoint
  function showPoint(pos, name, chat) {
    const ll = un(pos[0], pos[1]);
    map.setView(ll, 6);
    L.popup().setLatLng(ll).setContent(`<strong>${esc(name)}</strong>${chat ? `<br><code>${esc(chat)}</code>` : ''}`).openOn(map);
  }
  const m = location.hash.match(/^#@(-?\d+),(-?\d+)(?:,([^,]*))?(?:,([^,]*))?/);
  if (m) {
    const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return ''; } };
    showPoint([Number(m[1]), Number(m[2])], dec(m[3]), dec(m[4]));
    el.scrollIntoView({ block: 'start' });
  }
}
if (el) init();
