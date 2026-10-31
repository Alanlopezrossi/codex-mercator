// Fractals page: today's daily fractals (live from the official API, achievement category 88) and reset countdown.
import { $, lang, t } from '../lib/env.js';
import { get, batched } from '../lib/gw2.js';
import { esc } from '../../shared/format.js';

const box = $('#frDaily');
const resetEl = $('#frReset');

function tick() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const m = Math.max(0, Math.floor((next - now) / 60000));
  resetEl.textContent = `${t('fr.resetIn')} ${Math.floor(m / 60)} h ${m % 60} min`;
}

async function load() {
  try {
    const cat = await get('/v2/achievements/categories/88', lang);
    const achs = await batched('/v2/achievements', cat.achievements || [], `&lang=${lang}`);
    if (!achs.length) throw new Error('empty');
    // "Recommended" dailies first, then the tiers in order.
    const rec = achs.filter((a) => /recom/i.test(a.name));
    const tiers = achs.filter((a) => !/recom/i.test(a.name));
    const li = (a) => `<li class="fr-item"><span class="fr-name">${esc(a.name)}</span>${a.requirement ? `<span class="small muted">${esc(a.requirement)}</span>` : ''}</li>`;
    box.innerHTML = `${rec.length ? `<h3 class="h-sub">${lang === 'es' ? 'Recomendados' : 'Recommended'}</h3><ul class="fr-list">${rec.map(li).join('')}</ul>` : ''}
      ${tiers.length ? `<h3 class="h-sub">${lang === 'es' ? 'Por nivel' : 'By tier'}</h3><ul class="fr-list">${tiers.map(li).join('')}</ul>` : ''}`;
  } catch {
    box.innerHTML = `<p class="notice">${esc(t('error'))} <button type="button" class="btn btn-small" id="frRetry">${esc(t('retry'))}</button></p>`;
    $('#frRetry')?.addEventListener('click', () => { box.innerHTML = `<p class="muted">${esc(t('loading'))}</p>`; load(); });
  }
}
if (box) { tick(); setInterval(tick, 30000); load(); }
