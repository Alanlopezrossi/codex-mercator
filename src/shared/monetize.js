// Monetization, all optional and switched on by build variables (nothing shows until they are set):
//   ADSENSE_CLIENT  ca-pub-XXXXXXXXXXXXXXXX  Google AdSense publisher ID (loads the AdSense script; also ads.txt)
//   ADSENSE_SLOT    1234567890              ID of a responsive display ad unit (fixed, labeled ad boxes)
//   DONATE_URL      https://ko-fi.com/…     "Support the site" link (Ko-fi, Patreon, …)
//   AFFILIATE_URL   https://…               ArenaNet partner link to buy the game (marked as sponsored)
//   CF_ANALYTICS_TOKEN  32 hex chars        Cloudflare Web Analytics (cookie-free visit statistics)
// ArenaNet's Content Terms: the site stays free, ads must not be intrusive and nothing from the game is sold.
import { esc } from './format.js';

export function monetizationFromEnv(env) {
  const url = (v) => (/^https:\/\/[^\s"'<>]+$/.test(v || '') ? v : '');
  const client = /^ca-pub-\d{10,20}$/.test(env.ADSENSE_CLIENT || '') ? env.ADSENSE_CLIENT : '';
  return {
    adClient: client,
    adSlot: client && /^\d{6,20}$/.test(env.ADSENSE_SLOT || '') ? env.ADSENSE_SLOT : '',
    donate: url(env.DONATE_URL),
    affiliate: url(env.AFFILIATE_URL),
    cfBeacon: /^[a-f0-9]{32}$/.test(env.CF_ANALYTICS_TOKEN || '') ? env.CF_ANALYTICS_TOKEN : '',
  };
}

/** Scripts for <head>: AdSense (async, its consent message for the EEA/UK is configured in AdSense) and analytics. */
export function monetizationHead(mon = {}) {
  let h = '';
  if (mon.adClient) h += `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(mon.adClient)}" crossorigin="anonymous"></script>`;
  if (mon.cfBeacon) h += `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${esc(JSON.stringify({ token: mon.cfBeacon }))}"></script>`;
  return h;
}

/** A labeled ad box with reserved height (no layout jumps). Empty string when ads are off. */
export function adSlot(lang, mon = {}, where = 'page') {
  if (!mon.adClient || !mon.adSlot) return '';
  const label = lang === 'es' ? 'Publicidad' : 'Advertisement';
  return `<aside class="ad-slot ad-${esc(where)}" aria-label="${label}"><p class="ad-label">${label}</p><ins class="adsbygoogle" data-ad-client="${esc(mon.adClient)}" data-ad-slot="${esc(mon.adSlot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}

/** Footer links: support the site and buy the game (affiliate). */
export function supportLinks(lang, mon = {}) {
  const es = lang === 'es';
  const out = [];
  if (mon.donate) out.push(`<li><a class="support-link" href="${esc(mon.donate)}" rel="noopener" target="_blank">☕ ${es ? 'Apoyá el sitio' : 'Support the site'}</a></li>`);
  if (mon.affiliate) out.push(`<li><a href="${esc(mon.affiliate)}" rel="sponsored noopener" target="_blank">${es ? 'Comprá Guild Wars 2' : 'Buy Guild Wars 2'}</a> <span class="muted">(${es ? 'enlace de afiliado' : 'affiliate link'})</span></li>`);
  return out.join('');
}

/** Extra CSP sources needed by AdSense and Cloudflare Web Analytics. */
export function cspExtras(mon = {}) {
  const x = { script: [], style: [], img: [], connect: [], frame: [] };
  if (mon.adClient) {
    const g = ['https://pagead2.googlesyndication.com', 'https://*.googlesyndication.com', 'https://*.google.com', 'https://*.doubleclick.net', 'https://*.gstatic.com', 'https://*.adtrafficquality.google', 'https://fundingchoicesmessages.google.com'];
    x.script.push(...g);
    x.style.push("'unsafe-inline'"); // AdSense sizes its boxes with inline styles
    x.img.push('https:');
    x.connect.push(...g);
    x.frame.push(...g);
  }
  if (mon.cfBeacon) { x.script.push('https://static.cloudflareinsights.com'); x.connect.push('https://cloudflareinsights.com'); }
  return x;
}
