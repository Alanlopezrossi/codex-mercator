// Events: world bosses and metas in local time. Each day starts at 00:00 UTC: first the "p" sequence,
// then "q" repeats. Each step is [segment, minutes] (segment 0 = nothing happens).
import { $, lang, li, t } from '../lib/env.js';
import { esc } from '../../shared/format.js';
import { segments } from '../../shared/events.js';

const HIDE = new Set(['core-dn', 'eod-dn', 'voe-dn', 'core-ateu', 'core-atna', 'festival-lc', 'festival-db']);
const sel = $('#evc');
const nowEl = $('#evnow');
const soonEl = $('#evsoon');
const clock = $('#evclock');
let events = [];

const fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: lang !== 'es' });
const mins = (m) => (m < 1 ? '<1' : String(Math.ceil(m)));
const timeOf = (min) => fmt.format(new Date(min * 60000));

function row(ev, s, nowMin, live) {
  const seg = ev.s[s.r] || { n: ['?', '?'] };
  const rel = live ? `${t('ev.endsIn')} ${mins(s.end - nowMin)} ${t('ev.min')}` : `${t('ev.in')} ${mins(s.start - nowMin)} ${t('ev.min')}`;
  return `<li class="ev ${live ? 'ev-live' : ''}">
    <time class="ev-time" datetime="${new Date(s.start * 60000).toISOString()}">${esc(timeOf(s.start))}</time>
    <div class="ev-main"><p class="ev-name">${esc(seg.n[li] || seg.n[1])}</p><p class="small muted">${esc(ev.n[li])} · ${esc(ev.c[li])}</p></div>
    <span class="ev-rel small">${esc(rel)}</span>
    ${seg.wp ? `<button type="button" class="btn btn-small copy-btn" data-copy="${esc(seg.wp)}" aria-label="${esc(t('copy'))} ${esc(seg.wp)}"><code>${esc(seg.wp)}</code></button>` : '<span></span>'}
  </li>`;
}

function render() {
  const nowMin = Date.now() / 60000;
  const cat = sel.value;
  const live = [];
  const soon = [];
  for (const ev of events) {
    if (HIDE.has(ev.key) && !cat) continue;
    if (cat && ev.c[1] !== cat) continue;
    for (const s of segments(ev, nowMin - 1, nowMin + 180)) {
      if (s.start <= nowMin && s.end > nowMin) live.push([ev, s]);
      else if (s.start > nowMin && s.start <= nowMin + 120) soon.push([ev, s]);
    }
  }
  live.sort((a, b) => a[1].end - b[1].end);
  soon.sort((a, b) => a[1].start - b[1].start);
  nowEl.innerHTML = live.map(([ev, s]) => row(ev, s, nowMin, true)).join('') || `<li class="muted">${esc(t('noResults'))}</li>`;
  soonEl.innerHTML = soon.map(([ev, s]) => row(ev, s, nowMin, false)).join('') || `<li class="muted">${esc(t('noResults'))}</li>`;
  clock.textContent = `${t('ev.localTime')}: ${fmt.format(new Date())} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}

async function init() {
  try {
    const data = await fetch(`${document.body.dataset.data}/events.json`).then((r) => r.json());
    events = data.events;
  } catch {
    nowEl.innerHTML = `<li class="notice">${esc(t('error'))}</li>`;
    return;
  }
  const cats = [...new Map(events.map((e) => [e.c[1], e.c[li]])).entries()];
  sel.insertAdjacentHTML('beforeend', cats.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join(''));
  sel.addEventListener('change', render);
  render();
  setInterval(render, 30000);
}
if (sel) init();
