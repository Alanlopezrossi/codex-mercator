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

// Header search
const hq = $('#hq');
if (hq) autocomplete(hq, $('#hq-list'));

// Mobile menu: close when clicking outside or pressing Escape
const menu = $('.nav-menu');
if (menu) {
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
}

// Event alarms ring on every page of the site.
initAlarms();
