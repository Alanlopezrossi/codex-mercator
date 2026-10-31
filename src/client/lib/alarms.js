// Event alarms: tap the bell next to an event and the site plays a soft chime when it is about to start,
// with a floating card to turn it off (and, optionally, a system notification).
// Everything stays in this browser (localStorage). It works while any page of the site is open,
// even in another tab or minimized. Runs on every page (common.js); events.json is only loaded if there are alarms.
import { lang, li, t, store } from './env.js';
import { esc } from '../../shared/format.js';
import { segments } from '../../shared/events.js';

const KEY = 'cm-alarms';
const FIRED = 'cm-alarms-fired';
// Alarms ringing right now, shared by all pages and tabs: going to another page keeps the card until it is turned off.
const RINGING = 'cm-alarms-ringing';
const RING_MS = 180000;
const DEFAULT = { list: {}, lead: 5, vol: 0.5, sound: 'bell', notif: false };
let CFG = { ...DEFAULT, ...store.get(KEY, {}) };
const listeners = new Set();
function save() { store.set(KEY, CFG); listeners.forEach((f) => f()); }
// Other tabs change the alarms too: keep this one in sync.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { CFG = { ...DEFAULT, ...store.get(KEY, {}) }; listeners.forEach((f) => f()); ensureEngine(); }
  if (e.key === RINGING) { const live = store.get(RINGING, {}); for (const k of [...ringing.keys()]) if (!live[k]) stop(k, false); }
});

export const onAlarmsChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const alarmId = (ev, r) => `${ev}|${r}`;
export const hasAlarm = (id) => !!CFG.list[id];
export const alarmList = () => Object.entries(CFG.list).map(([id, a]) => ({ id, ...a }));
export const alarmSettings = () => ({ lead: CFG.lead, vol: CFG.vol, sound: CFG.sound, notif: CFG.notif });
export function setAlarmSettings(p) { CFG = { ...CFG, ...p }; save(); }
/** rec = { ev, r, n: [es, en] (segment), m: [es, en] (event), wp }. Returns true if the alarm is now on. */
export function toggleAlarm(rec) {
  const id = alarmId(rec.ev, rec.r);
  if (CFG.list[id]) delete CFG.list[id];
  else CFG.list[id] = { ev: rec.ev, r: rec.r, n: rec.n, m: rec.m, wp: rec.wp || '' };
  save();
  unlockAudio();
  ensureEngine();
  return !!CFG.list[id];
}
export function removeAlarm(id) { delete CFG.list[id]; save(); }
const nameOf = (a) => a.n?.[li] || a.n?.[1] || '';
const eventOf = (a) => a.m?.[li] || a.m?.[1] || '';

// ---------- Sound (WebAudio, no files) ----------
let ctx = null;
function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio */ }
}
const SOUNDS = {
  bell: { label: ['Campanita', 'Bell'], notes: [[880, 0], [1108.7, 0.16], [1318.5, 0.32]], decay: 1.4, type: 'sine' },
  gong: { label: ['Gong suave', 'Soft gong'], notes: [[220, 0], [330, 0.02]], decay: 2.6, type: 'sine' },
  drops: { label: ['Gotas', 'Drops'], notes: [[1046.5, 0], [1568, 0.22]], decay: 0.6, type: 'triangle' },
  marimba: { label: ['Marimba', 'Marimba'], notes: [[523.3, 0], [659.3, 0.14], [784, 0.28], [1046.5, 0.42]], decay: 0.9, type: 'sine' },
};
export const SOUND_NAMES = Object.entries(SOUNDS).map(([k, s]) => [k, s.label[li] || s.label[1]]);
export function playChime(kind = CFG.sound, vol = CFG.vol) {
  unlockAudio();
  if (!ctx) return;
  const s = SOUNDS[kind] || SOUNDS.bell;
  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, vol)) * 0.35;
  master.connect(ctx.destination);
  for (const [f, dt] of s.notes) {
    for (const [mult, amp] of [[1, 1], [2, 0.18], [3, 0.06]]) { // fundamental + soft harmonics (bell timbre)
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = s.type;
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(amp, t0 + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + s.decay / mult);
      o.connect(g); g.connect(master);
      o.start(t0 + dt);
      o.stop(t0 + dt + s.decay + 0.1);
    }
  }
}

// ---------- Engine: checks every 10 seconds ----------
let EVENTS = null;
let started = false;
let fired = store.get(FIRED, {});
const ringing = new Map(); // key -> { a, start, end, loop }
let titleTimer = null;
let baseTitle = '';
const fmtT = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: lang !== 'es' });
const timeOf = (min) => fmtT.format(new Date(min * 60000));

export function initAlarms() {
  // Browsers only allow sound after the user has touched the page.
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlockAudio, { passive: true });
  // Resume the alarms that were ringing on the previous page.
  const live = store.get(RINGING, {});
  for (const [k, r] of Object.entries(live)) if (Date.now() - r.at < RING_MS) ring(k, r.a, r, r.at); else delete live[k];
  store.set(RINGING, live);
  paintRinging();
  ensureEngine();
}
async function ensureEngine() {
  if (started || !Object.keys(CFG.list).length) return;
  started = true;
  try {
    const data = await fetch(`${document.body.dataset.data}/events.json`).then((r) => r.json());
    EVENTS = new Map(data.events.map((e) => [e.key, e]));
  } catch { started = false; return; }
  tick();
  setInterval(tick, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

function tick() {
  if (!EVENTS) return;
  const now = Date.now() / 60000;
  const nowMin = Math.floor(now);
  let changed = false;
  for (const [k, v] of Object.entries(fired)) if (v < nowMin - 180) { delete fired[k]; changed = true; }
  for (const [id, a] of Object.entries(CFG.list)) {
    const ev = EVENTS.get(a.ev);
    if (!ev) continue;
    for (const seg of segments(ev, nowMin - 3, nowMin + CFG.lead + 2)) {
      if (seg.r !== String(a.r)) continue;
      const key = `${id}@${seg.start}`;
      if (fired[key]) continue;
      // Rings from "lead" minutes before until 2 minutes after the start (in case the tab was asleep).
      if (now >= seg.start - CFG.lead && now <= seg.start + 2) {
        fired[key] = seg.start;
        changed = true;
        ring(key, a, seg);
      }
    }
  }
  // Another tab may have rung it already: the fired list is shared through localStorage.
  if (changed) store.set(FIRED, { ...store.get(FIRED, {}), ...fired });
  paintRinging();
}

function ring(key, a, seg, startedAt = 0) {
  const resumed = !!startedAt;
  startedAt ||= Date.now();
  playChime();
  // Repeats every 8 seconds until turned off (3 minutes at most).
  const loop = setInterval(() => {
    if (Date.now() - startedAt > RING_MS) { clearInterval(loop); return; }
    playChime();
  }, 8000);
  ringing.set(key, { a, start: seg.start, end: seg.end, loop });
  if (!key.startsWith('test@')) store.set(RINGING, { ...store.get(RINGING, {}), [key]: { a, start: seg.start, end: seg.end, at: startedAt } });
  if (!resumed && CFG.notif && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const mins = Math.round(seg.start - Date.now() / 60000);
      const when = mins > 0 ? `${t('al.startsIn')} ${mins} min` : t('al.started');
      const n = new Notification(`🔔 ${nameOf(a)}`, { body: `${when} (${timeOf(seg.start)}) · ${eventOf(a)}${a.wp ? `\n${a.wp}` : ''}`, tag: key, requireInteraction: true, silent: true });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* notifications blocked */ }
  }
  if (!titleTimer) {
    baseTitle = document.title;
    let on = false;
    titleTimer = setInterval(() => { on = !on; document.title = on ? `🔔 ${nameOf(a)}` : baseTitle; }, 1200);
  }
}

function stop(key, share = true) {
  if (share) { const live = store.get(RINGING, {}); delete live[key]; store.set(RINGING, live); }
  const r = ringing.get(key);
  if (r) clearInterval(r.loop);
  ringing.delete(key);
  if (!ringing.size && titleTimer) { clearInterval(titleTimer); titleTimer = null; document.title = baseTitle || document.title; }
  paintRinging();
}

/** Floating card (bottom right) for every alarm that is ringing. */
function paintRinging() {
  let box = document.getElementById('alarmFloat');
  if (!ringing.size) { box?.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.id = 'alarmFloat';
    box.className = 'alarm-float';
    box.setAttribute('role', 'alert');
    document.body.append(box);
    box.addEventListener('click', (e) => {
      const off = e.target.closest('[data-aoff]');
      if (off) { stop(off.dataset.aoff); return; }
      if (e.target.closest('[data-aall]')) [...ringing.keys()].forEach((k) => stop(k));
    });
  }
  const now = Date.now() / 60000;
  box.innerHTML = `${[...ringing.entries()].map(([k, r]) => {
    const m = Math.ceil(r.start - now);
    const when = m > 0 ? `${esc(t('al.startsIn'))} <b>${m} min</b> (${esc(timeOf(r.start))})` : now < r.end ? `<b>${esc(t('al.started'))}</b> (${esc(timeOf(r.start))})` : esc(t('al.ended'));
    return `<div class="alarm-card">
      <span class="alarm-ic" aria-hidden="true">🔔</span>
      <div class="alarm-body"><p class="alarm-name">${esc(nameOf(r.a))}</p><p class="small muted">${esc(eventOf(r.a))}</p><p class="small">${when}</p>
        <div class="alarm-actions">${r.a.wp ? `<button type="button" class="btn btn-small" data-copy="${esc(r.a.wp)}">${esc(t('copy'))} <code>${esc(r.a.wp)}</code></button>` : ''}
        <button type="button" class="btn btn-small btn-primary" data-aoff="${esc(k)}">${esc(t('al.off'))}</button></div></div>
    </div>`;
  }).join('')}${ringing.size > 1 ? `<button type="button" class="btn btn-small alarm-all" data-aall>${esc(t('al.offAll'))}</button>` : ''}`;
}

/** Asks for permission to also show a system notification. */
export async function askNotifications() {
  if (!('Notification' in window)) return false;
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  setAlarmSettings({ notif: p === 'granted' });
  return p === 'granted';
}
/** Rings right now, to try the sound and the card. */
export function testAlarm() {
  const now = Math.floor(Date.now() / 60000);
  ring(`test@${Date.now()}`, { n: [t('al.testName'), t('al.testName')], m: [t('al.testSub'), t('al.testSub')], wp: '' }, { start: now + CFG.lead, end: now + CFG.lead + 15 });
  paintRinging();
}
