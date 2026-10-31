// Events: timeline (wiki timer style) + "now" and "upcoming" lists, searchable by event, map or category.
// Widths and colors are applied with element.style (the CSP does not allow style="" attributes in HTML).
import { $, lang, li, t, store, debounce } from '../lib/env.js';
import { esc } from '../../shared/format.js';
import { segments, segmentsAll } from '../../shared/events.js';
import { pagePath } from '../../shared/i18n.js';
import { norm } from '../lib/search.js';
import { toast } from '../lib/toast.js';
import { toggleAlarm, hasAlarm, alarmId, alarmList, removeAlarm, alarmSettings, setAlarmSettings, playChime, testAlarm, askNotifications, onAlarmsChange } from '../lib/alarms.js';

// Hidden by default: day/night cycles, PvP tournaments and festivals that are not always active.
const HIDE = ['core-dn', 'eod-dn', 'voe-dn', 'core-ateu', 'core-atna', 'festival-lc', 'festival-db'];
const KEY = 'cm-events';
const saved = store.get(KEY, {});
const st = {
  q: '',
  cat: saved.cat || '',
  range: ['2', '4', '8'].includes(saved.range) ? saved.range : '2',
  top: !!saved.top,
  hidden: new Set(saved.hidden || HIDE),
};
const save = () => store.set(KEY, { cat: st.cat, range: st.range, top: st.top, hidden: [...st.hidden] });

const form = $('#evFilters');
const qEl = $('#evq');
const topEl = $('#evtop');
const tl = $('#evTimeline');
const hiddenEl = $('#evHidden');
const nowEl = $('#evnow');
const soonEl = $('#evsoon');
let events = [];
let byKey = new Map();

// Bell button: turns the daily alarm of one event segment on or off.
const bell = (ev, r, label, cls = '') => {
  const on = hasAlarm(alarmId(ev.key, r));
  return `<button type="button" class="ev-bell${on ? ' on' : ''}${cls ? ` ${cls}` : ''}" data-bell="${esc(ev.key)}" data-r="${esc(r)}" aria-pressed="${on}" aria-label="${esc(t(on ? 'al.unset' : 'al.set'))}: ${esc(label)}" title="${esc(t(on ? 'al.unset' : 'al.set'))}">${on ? '🔔' : '🔕'}</button>`;
};

const fmtT = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: lang !== 'es' });
const fmtS = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: lang !== 'es' });
const timeOf = (min) => fmtT.format(new Date(min * 60000));
const rel = (m) => {
  const v = Math.max(0, Math.ceil(m));
  if (v < 1) return '<1 min';
  return v < 60 ? `${v} min` : `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60} min` : ''}`;
};
const rgb = (c) => `rgb(${c.join(',')})`;
const bgOf = (c) => (!c ? '' : Array.isArray(c[0]) ? `linear-gradient(90deg, ${c.map(rgb).join(', ')})` : rgb(c));
// Dark text on light colors and light text on dark ones (WCAG relative luminance).
const lum = (c) => {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const isDark = (c) => {
  if (!c) return false;
  const cs = Array.isArray(c[0]) ? c : [c];
  return Math.max(...cs.map(lum)) < 0.18;
};
const mapLink = (seg, ev) => {
  if (!seg.pos) return '';
  const label = `${seg.n[li] || seg.n[1]} — ${ev.n[li]}`;
  return `${pagePath(lang, 'map')}#@${seg.pos[0]},${seg.pos[1]},${encodeURIComponent(label)}${seg.wp ? `,${encodeURIComponent(seg.wp)}` : ''}`;
};

function matches(ev, segName) {
  if (st.cat && ev.c[1] !== st.cat) return false;
  const q = norm(st.q);
  if (!q) return true;
  const hay = norm(`${ev.n.join(' ')} ${ev.c.join(' ')} ${segName || Object.values(ev.s).map((s) => s.n.join(' ')).join(' ')}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function renderTimeline(nowMin) {
  const H = Number(st.range) * 60;
  const from = Math.floor((nowMin - 15) / 15) * 15;
  const to = nowMin + H + 15;
  const span = to - from;
  const pct = (m) => ((m - from) / span) * 100;
  const limit = nowMin + H;
  const searching = !!norm(st.q);
  const shown = events.filter((ev) => matches(ev) && (searching || !st.hidden.has(ev.key)));
  const byCat = new Map();
  for (const ev of shown) {
    if (!byCat.has(ev.c[1])) byCat.set(ev.c[1], { name: ev.c[li], list: [] });
    byCat.get(ev.c[1]).list.push(ev);
  }
  let html = `<div class="evt-pointer" data-left="${pct(nowMin)}"><span>${esc(timeOf(nowMin))}</span></div>
    <div class="evt-limit" data-left="${pct(limit)}"><span>${esc(t('ev.next'))} ${st.range} h</span></div>`;
  if (st.top) {
    const ticks = [];
    for (let m = Math.ceil(from / 30) * 30; m < to; m += 30) ticks.push(m);
    html += `<div class="evt-toptimes" aria-hidden="true">${ticks.map((m) => `<span data-left="${pct(m)}">${esc(timeOf(m))}</span>`).join('')}</div>`;
  }
  for (const { name, list } of byCat.values()) {
    html += `<div class="evt-cat"><h3>${esc(name)}</h3>`;
    for (const ev of list) {
      const segs = segmentsAll(ev, from, to).map((sg) => {
        const l = Math.max(sg.start, from);
        const r = Math.min(sg.end, to);
        if (r <= l) return '';
        const w = ((r - l) / span) * 100;
        const seg = ev.s[sg.r];
        if (!seg || sg.r === '0') return `<div class="evt-seg evt-empty" data-w="${w}" aria-hidden="true"></div>`;
        const on = sg.start <= nowMin && sg.end > nowMin;
        const future = sg.start >= limit;
        const cls = ['evt-seg', future ? 'future' : '', on ? 'on' : '', !future && isDark(seg.col) ? 'dark' : '', seg.pos ? 'has-map' : ''].filter(Boolean).join(' ');
        const label = seg.n[li] || seg.n[1];
        const title = `${label}${seg.n[1] !== label ? ` (${seg.n[1]})` : ''} · ${timeOf(sg.start)}–${timeOf(sg.end)} (${sg.end - sg.start} min)`;
        const link = mapLink(seg, ev);
        // Future segments: neutral background with the event color as a top band (keeps the text readable).
        return `<div class="${cls}" data-w="${w}" ${future ? `data-band="${esc(bgOf(seg.col))}"` : `data-bg="${esc(bgOf(seg.col))}"`} title="${esc(title)}">
          <span class="evt-time">${esc(timeOf(sg.start))}${bell(ev, sg.r, label, 'mini')}</span>
          ${link ? `<a class="evt-name" href="${esc(link)}" title="${esc(t('ev.onMap'))}">${esc(label)}</a>` : `<span class="evt-name">${esc(label)}</span>`}
          ${seg.wp ? `<button type="button" class="evt-chat" data-copy="${esc(seg.wp)}" aria-label="${esc(t('copy'))} ${esc(seg.wp)}">${esc(seg.wp)}</button>` : ''}
        </div>`;
      }).join('');
      html += `<div class="evt-container"><div class="evt-title"><h4>${esc(ev.n[li])}</h4><button type="button" class="evt-exit" data-hide="${esc(ev.key)}" aria-label="${esc(t('ev.hide'))}: ${esc(ev.n[li])}" title="${esc(t('ev.hide'))}">✕ ${esc(t('ev.hide'))}</button></div><div class="evt-bar${st.top ? ' notimes' : ''}">${segs}</div></div>`;
    }
    html += '</div>';
  }
  if (!byCat.size) html += `<p class="empty">${esc(t('noResults'))}</p>`;
  tl.innerHTML = html;
  for (const el of tl.querySelectorAll('[data-w]')) el.style.width = `${el.dataset.w}%`;
  for (const el of tl.querySelectorAll('[data-bg]')) if (el.dataset.bg) el.style.background = el.dataset.bg;
  for (const el of tl.querySelectorAll('[data-band]')) if (el.dataset.band) el.style.borderTop = `4px solid ${el.dataset.band.startsWith('linear') ? '#888' : el.dataset.band}`;
  for (const el of tl.querySelectorAll('[data-left]')) el.style.left = `${el.dataset.left}%`;
  const hid = events.filter((e) => st.hidden.has(e.key));
  hiddenEl.innerHTML = hid.length && !searching
    ? `${esc(t('ev.hidden'))}: ${hid.map((e) => `<button type="button" class="btn btn-small btn-ghost" data-show="${esc(e.key)}" aria-label="${esc(t('ev.show'))}: ${esc(e.n[li])}">${esc(e.n[li])} +</button>`).join(' ')}`
    : '';
}

function row(ev, sg, nowMin, live) {
  const seg = ev.s[sg.r];
  const label = seg.n[li] || seg.n[1];
  const when = live ? `${t('ev.endsIn')} ${rel(sg.end - nowMin)}` : `${t('ev.in')} ${rel(sg.start - nowMin)}`;
  const link = mapLink(seg, ev);
  return `<li class="ev${live ? ' ev-live' : ''}">
    <time class="ev-time" datetime="${new Date(sg.start * 60000).toISOString()}">${esc(timeOf(sg.start))}</time>
    <div class="ev-main"><p class="ev-name">${link ? `<a href="${esc(link)}">${esc(label)}</a>` : esc(label)}</p><p class="small muted">${esc(ev.n[li])} · ${esc(ev.c[li])} · ${sg.end - sg.start} min</p></div>
    <span class="ev-rel small">${esc(when)} ${bell(ev, sg.r, label)}</span>
    ${seg.wp ? `<button type="button" class="btn btn-small copy-btn" data-copy="${esc(seg.wp)}" aria-label="${esc(t('copy'))} ${esc(seg.wp)}"><code>${esc(seg.wp)}</code></button>` : '<span></span>'}
  </li>`;
}

function renderLists(nowMin) {
  const searching = !!norm(st.q);
  const live = [];
  const soon = [];
  const horizon = Number(st.range) * 60;
  for (const ev of events) {
    if (!searching && !st.cat && st.hidden.has(ev.key)) continue;
    for (const sg of segments(ev, nowMin - 1, nowMin + horizon)) {
      const seg = ev.s[sg.r];
      if (!seg || !matches(ev, seg.n.join(' '))) continue;
      if (sg.start <= nowMin && sg.end > nowMin) live.push([ev, sg]);
      else if (sg.start > nowMin) soon.push([ev, sg]);
    }
  }
  live.sort((a, b) => a[1].end - b[1].end);
  soon.sort((a, b) => a[1].start - b[1].start);
  nowEl.innerHTML = live.map(([ev, sg]) => row(ev, sg, nowMin, true)).join('') || `<li class="muted">${esc(t('noResults'))}</li>`;
  soonEl.innerHTML = soon.slice(0, 40).map(([ev, sg]) => row(ev, sg, nowMin, false)).join('') || `<li class="muted">${esc(t('noResults'))}</li>`;
}

function render() {
  const nowMin = Date.now() / 60000;
  renderTimeline(nowMin);
  renderLists(nowMin);
}

function tick() {
  const d = new Date();
  $('#evClock').textContent = fmtS.format(d);
  $('#evUtc').textContent = `${d.toISOString().slice(11, 16)} ${t('ev.utc')}`;
}

// ---------- Alarms panel ----------
const alForm = $('#evAlarms');
function paintAlarms() {
  if (!alForm) return;
  const cfg = alarmSettings();
  for (const el of alForm.querySelectorAll('input[name="allead"]')) el.checked = Number(el.value) === cfg.lead;
  for (const el of alForm.querySelectorAll('input[name="alsound"]')) el.checked = el.value === cfg.sound;
  $('#alvol').value = String(cfg.vol);
  const nb = $('#alNotif');
  const perm = 'Notification' in window ? Notification.permission : 'denied';
  const on = cfg.notif && perm === 'granted';
  nb.textContent = perm === 'denied' ? t('al.notifBlocked') : t(on ? 'al.notifActive' : 'al.notifOn');
  nb.disabled = perm === 'denied';
  nb.setAttribute('aria-pressed', String(on));
  const list = alarmList();
  $('#alCount').textContent = list.length ? `(${list.length} ${t('al.count')})` : '';
  $('#alList').innerHTML = list.length
    ? `<p class="small"><strong>${esc(t('al.active'))}:</strong></p><ul class="al-chips">${list.map((a) => `<li class="al-chip"><span>🔔 ${esc(a.n?.[li] || a.n?.[1] || '')}</span><span class="small muted">${esc(a.m?.[li] || a.m?.[1] || '')}</span><button type="button" class="al-x" data-aldel="${esc(a.id)}" aria-label="${esc(t('al.remove'))}: ${esc(a.n?.[li] || '')}" title="${esc(t('al.remove'))}">✕</button></li>`).join('')}</ul>`
    : `<p class="small muted">${esc(t('al.none'))}</p>`;
}
if (alForm) {
  alForm.addEventListener('change', (e) => {
    if (e.target.name === 'allead') setAlarmSettings({ lead: Number(e.target.value) });
    if (e.target.name === 'alsound') { setAlarmSettings({ sound: e.target.value }); playChime(e.target.value); }
    if (e.target.id === 'alvol') { setAlarmSettings({ vol: Number(e.target.value) }); playChime(); }
  });
  $('#alTest').addEventListener('click', () => testAlarm());
  $('#alNotif').addEventListener('click', async () => {
    const cfg = alarmSettings();
    if (cfg.notif && 'Notification' in window && Notification.permission === 'granted') setAlarmSettings({ notif: false });
    else await askNotifications();
    paintAlarms();
  });
  alForm.addEventListener('click', (e) => {
    const d = e.target.closest('[data-aldel]');
    if (d) removeAlarm(d.dataset.aldel);
  });
  // Open the panel by default once the visitor has alarms.
  if (alarmList().length) alForm.open = true;
}

async function init() {
  try {
    events = (await fetch(`${document.body.dataset.data}/events.json`).then((r) => r.json())).events;
    byKey = new Map(events.map((e) => [e.key, e]));
  } catch {
    tl.innerHTML = `<p class="notice">${esc(t('error'))}</p>`;
    return;
  }
  const cats = [...new Map(events.map((e) => [e.c[1], e.c[li]])).entries()];
  // Category boxes (one row that wraps), same markup as the server-rendered chip groups.
  const row = $('#evcats .chip-row');
  row.insertAdjacentHTML('beforeend', cats.map(([k, v], i) => `<input type="radio" class="chip-input" name="evc" id="evc-c${i}" value="${esc(k)}"><label class="chip" for="evc-c${i}">${esc(v)}</label>`).join(''));
  form.evc.value = st.cat;
  form.evr.value = st.range;
  topEl.checked = st.top;
  const params = new URLSearchParams(location.search);
  if (params.get('q')) { qEl.value = params.get('q'); st.q = qEl.value; }

  form.addEventListener('submit', (e) => e.preventDefault());
  qEl.addEventListener('input', debounce(() => { st.q = qEl.value; render(); }, 150));
  form.addEventListener('change', (e) => {
    if (e.target.name === 'evc') { st.cat = form.evc.value; save(); render(); }
    if (e.target.name === 'evr') { st.range = form.evr.value; save(); render(); }
  });
  topEl.addEventListener('change', () => { st.top = topEl.checked; save(); render(); });
  document.addEventListener('click', (e) => {
    const h = e.target.closest('[data-hide]');
    if (h) { st.hidden.add(h.dataset.hide); save(); render(); return; }
    const s = e.target.closest('[data-show]');
    if (s) { st.hidden.delete(s.dataset.show); save(); render(); return; }
    const b = e.target.closest('[data-bell]');
    if (b) {
      const ev = byKey.get(b.dataset.bell);
      const seg = ev?.s[b.dataset.r];
      if (!seg) return;
      const on = toggleAlarm({ ev: ev.key, r: b.dataset.r, n: seg.n, m: ev.n, wp: seg.wp || '' });
      const lead = alarmSettings().lead;
      toast(on ? `${t('al.onToast')}: ${seg.n[li] || seg.n[1]}${lead ? ` (−${lead} min)` : ''}` : t('al.offToast'));
    }
  });
  render();
  tick();
  paintAlarms();
  onAlarmsChange(() => { paintAlarms(); render(); });
  setInterval(render, 30000);
  setInterval(tick, 1000);
}
if (tl) init();
