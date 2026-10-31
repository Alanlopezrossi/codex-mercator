// HTML page layout. Used by the build (static pages) and by the Worker (item pages).
import { adSlot, supportLinks, monetizationHead } from './monetize.js';
import { esc } from './format.js';
import { LANGS, ROUTES, SITE_NAME, pagePath, t } from './i18n.js';

const NAV = ['events', 'bazaar', 'items', 'gear', 'vendors', 'dungeons', 'achievements', 'professions', 'map', 'calculator'];

const ICONS = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  theme: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
export { ICONS };

export const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><ellipse cx="13" cy="8" rx="9" ry="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 8v5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V8M4 13v5c0 1.9 4 3.5 9 3.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="17" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 21h6M20 25h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * @param {object} o
 * @param {'es'|'en'} o.lang
 * @param {string} o.title       page title (without the site suffix)
 * @param {string} o.description meta description
 * @param {string} o.body        main HTML
 * @param {{es:string,en:string}} o.alternates paths of this page in each language
 * @param {string} [o.page]      key of the active section (for the nav)
 * @param {string[]} [o.scripts] page script entries (src/client/pages/*.js)
 * @param {object} [o.jsonLd]
 * @param {boolean} [o.noindex]
 * @param {object} o.meta        { siteUrl, assetVersion, dataVersion, builtAt }
 */
export function layout(o) {
  const { lang, meta } = o;
  const other = lang === 'es' ? 'en' : 'es';
  const A = `/assets/${meta.assetVersion}`;
  const canonical = meta.siteUrl + o.alternates[lang];
  const fullTitle = o.title ? `${o.title} · ${SITE_NAME} (${t(lang, 'fansite')})` : `${SITE_NAME} · ${t(lang, 'tagline')} (${t(lang, 'fansite')})`;
  const navLinks = NAV.map((k) => {
    const href = pagePath(lang, k);
    const cur = o.page === k ? ' aria-current="page"' : '';
    return `<li><a href="${href}"${cur}>${esc(t(lang, `nav.${k}`))}</a></li>`;
  }).join('');
  const hreflang = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(meta.siteUrl + o.alternates[l])}">`).join('')
    + `<link rel="alternate" hreflang="x-default" href="${esc(meta.siteUrl + o.alternates.en)}">`;
  const scripts = (o.scripts || []).map((s) => `<script type="module" src="${A}/pages/${s}.js"></script>`).join('');
  const ld = o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  const year = new Date(meta.builtAt || Date.now()).getUTCFullYear();
  return `<!doctype html>
<html lang="${lang}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(canonical)}">
${hreflang}
<meta name="theme-color" content="#14161c">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(o.title || SITE_NAME)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(o.ogImage || `${meta.siteUrl}/og.png`)}">
<meta property="og:locale" content="${lang === 'es' ? 'es_ES' : 'en_US'}">
<meta name="twitter:card" content="${o.ogImage ? 'summary' : 'summary_large_image'}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="${A}/fonts/cinzel-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://api.guildwars2.com" crossorigin>
<link rel="preconnect" href="https://render.guildwars2.com">
${(o.scripts || []).map((s) => `<link rel="modulepreload" href="${A}/pages/${s}.js">`).join('')}
<link rel="modulepreload" href="${A}/common.js">
<link rel="stylesheet" href="${A}/main.css">
${(o.styles || []).map((s) => `<link rel="stylesheet" href="${A}/${s}.css">`).join('')}
<script src="${A}/theme.js"></script>
${monetizationHead(meta.mon)}
${ld}
</head>
<body data-lang="${lang}" data-page="${esc(o.page || '')}" data-assets="${A}" data-data="/data/${meta.dataVersion}" data-search="${esc(meta.searchFile || '')}" data-built="${esc(meta.builtAt)}">
<a class="skip" href="#main">${esc(t(lang, 'skip'))}</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${pagePath(lang, 'home')}">${LOGO}<span class="brand-name">Bazaar <b>Ledger</b></span><span class="sr-only"> — ${esc(t(lang, 'fansite'))}</span></a>
    <form class="hsearch" role="search" action="${pagePath(lang, 'items')}" method="get">
      <label class="sr-only" for="hq">${esc(t(lang, 'searchLabel'))}</label>
      <input id="hq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="hq-list" aria-expanded="false" role="combobox">
      <button type="submit" class="icon-btn" aria-label="${esc(t(lang, 'searchBtn'))}">${ICONS.search}</button>
      <ul id="hq-list" class="ac-list" role="listbox" hidden></ul>
    </form>
    <div class="header-tools">
      <a class="lang-link" href="${esc(o.alternates[other])}" hreflang="${other}" lang="${other}" aria-label="${esc(t(lang, 'otherLang'))}"><span class="lang-long">${esc(t(lang, 'otherLang'))}</span><span class="lang-short">${other.toUpperCase()}</span></a>
      <details class="a11y-menu js-only">
        <summary class="icon-btn" aria-label="${esc(t(lang, 'a11y.title'))}" title="${esc(t(lang, 'a11y.title'))}"><span aria-hidden="true" class="a11y-aa">Aa</span></summary>
        <div class="a11y-pop" role="group" aria-label="${esc(t(lang, 'a11y.title'))}">
          <fieldset class="chips"><legend>${esc(t(lang, 'a11y.size'))}</legend><div class="chip-row">${[['1', t(lang, 'a11y.normal')], ['2', t(lang, 'a11y.large')], ['3', t(lang, 'a11y.xlarge')]].map(([v, l]) => `<input type="radio" class="chip-input" name="a11yfs" id="a11yfs-${v}" value="${v}"${v === '1' ? ' checked' : ''}><label class="chip" for="a11yfs-${v}">${esc(l)}</label>`).join('')}</div></fieldset>
          <div class="field check"><input type="checkbox" id="a11yhc"><label for="a11yhc">${esc(t(lang, 'a11y.contrast'))}</label></div>
        </div>
      </details>
      <button type="button" class="icon-btn js-only" id="themeBtn" aria-label="${esc(t(lang, 'theme'))}" title="${esc(t(lang, 'theme'))}">${ICONS.theme}</button>
    </div>
  </div>
  <nav class="wrap main-nav" aria-label="${lang === 'es' ? 'Principal' : 'Main'}">
    <details class="nav-menu">
      <summary>${ICONS.menu}<span>${esc(t(lang, 'menu'))}</span></summary>
      <ul>${navLinks}</ul>
    </details>
    <ul class="nav-inline">${navLinks}</ul>
  </nav>
</header>
<main id="main" class="wrap" tabindex="-1">
${o.body}
${o.ads === false ? '' : adSlot(lang, meta.mon, 'bottom')}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="brand-foot">${LOGO}<span>Bazaar <b>Ledger</b></span></p>
      <p class="small">${esc(t(lang, 'footerDisclaimer'))}</p>
      <p class="small muted">${esc(t(lang, 'footerData'))}</p>
    </div>
    <ul class="footer-links small">
      <li><a href="${pagePath(lang, 'about')}">${esc(t(lang, 'nav.about'))}</a></li>
      <li><a href="${pagePath(lang, 'favorites')}">${esc(t(lang, 'nav.favorites'))}</a></li>
      <li><a href="${pagePath(lang, 'legal')}">${esc(t(lang, 'nav.legal'))}</a></li>
      <li><a href="${pagePath(lang, 'privacy')}">${esc(t(lang, 'nav.privacy'))}</a></li>
      ${supportLinks(lang, meta.mon)}
    </ul>
  </div>
  <div class="wrap legal-notice small muted">
    <p>©2010–${year} ArenaNet, LLC. All rights reserved. Guild Wars, Guild Wars 2, Heart of Thorns, Guild Wars 2: Path of Fire, Guild Wars 2: End of Dragons, Guild Wars 2: Secrets of the Obscure, Guild Wars 2: Janthir Wilds, Guild Wars 2: Visions of Eternity, ArenaNet, NCSOFT, the Interlocking NC Logo, and all associated logos and designs are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners.</p>
    <p>${esc(t(lang, 'updated'))}: <time datetime="${esc(meta.builtAt)}">${esc(String(meta.builtAt).slice(0, 16).replace('T', ' '))} UTC</time></p>
  </div>
</footer>
<script type="module" src="${A}/common.js"></script>
${scripts}
</body>
</html>`;
}

export function alternatesFor(page) {
  return { es: pagePath('es', page), en: pagePath('en', page) };
}

export { ROUTES };
