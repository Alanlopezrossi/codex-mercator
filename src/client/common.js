// Runs on every page: theme, copy buttons, header search and mobile menu.
import { $, t } from './lib/env.js';
import { autocomplete } from './lib/autocomplete.js';
import { toast } from './lib/toast.js';
import { initAlarms } from './lib/alarms.js';

// Theme
const btn = $('#themeBtn');
if (btn) {
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('cm-theme', next); } catch { /* blocked */ }
    sync();
  });
}

// Copy buttons (chat codes, waypoints)
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const text = b.dataset.copy;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    ta.remove();
  }
  toast(`${t('copied')}: ${text}`);
});

// Accessibility menu: text size and high contrast, saved in this browser.
const a11y = $('.a11y-menu');
if (a11y) {
  const root = document.documentElement;
  const read = () => { try { return JSON.parse(localStorage.getItem('cm-a11y') || '{}'); } catch { return {}; } };
  const cur = read();
  const fsIn = a11y.querySelector(`input[name="a11yfs"][value="${cur.fs === '2' || cur.fs === '3' ? cur.fs : '1'}"]`);
  if (fsIn) fsIn.checked = true;
  a11y.querySelector('#a11yhc').checked = !!cur.hc;
  a11y.addEventListener('change', () => {
    const fs = a11y.querySelector('input[name="a11yfs"]:checked')?.value || '1';
    const hc = a11y.querySelector('#a11yhc').checked;
    if (fs === '1') root.removeAttribute('data-fs'); else root.setAttribute('data-fs', fs);
    if (hc) root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast');
    try { localStorage.setItem('cm-a11y', JSON.stringify({ fs, hc })); } catch { /* blocked */ }
  });
  document.addEventListener('click', (e) => { if (a11y.open && !a11y.contains(e.target)) a11y.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && a11y.open) { a11y.open = false; a11y.querySelector('summary').focus(); } });
}

// Header search
const hq = $('#hq');
if (hq) autocomplete(hq, $('#hq-list'), { global: true });

// Mobile menu: close when clicking outside or pressing Escape
const menu = $('.nav-menu');
if (menu) {
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
}

// Installable app: the service worker keeps assets and visited pages for offline use.
// On stand-by unless the build sets APP_ENABLED=1: then any copy installed earlier is removed.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  if (document.body.dataset.app === '1') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* not available */ }); });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
}

// Event alarms ring on every page of the site.
initAlarms();

// Ad boxes (only present when ads are enabled): ask AdSense to fill each one once.
for (const ins of document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])')) {
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by the visitor */ }
}
