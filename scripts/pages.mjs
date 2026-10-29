// Static pages (one HTML per language). Live data is loaded by the scripts in src/client/pages/.
import { esc, iconUrl, num } from '../src/shared/format.js';
import { LANGS, pagePath, t, itemPath, tr, RARITIES, TYPE_KEYS } from '../src/shared/i18n.js';
import { layout, alternatesFor, ICONS } from '../src/shared/layout.js';

const head = (lang, key, extra = '') => `<header class="page-head"><h1>${esc(t(lang, `${key}.title`))}</h1><p class="lead">${esc(t(lang, `${key}.lead`))}</p>${extra}</header>`;
const noscript = (lang) => `<noscript><p class="notice">${esc(t(lang, 'noscript'))}</p></noscript>`;

function typeOptions(lang) {
  return TYPE_KEYS.map((k, i) => ({ v: i, label: tr.type(lang, k) })).sort((a, b) => a.label.localeCompare(b.label, lang))
    .map((o) => `<option value="${o.v}">${esc(o.label)}</option>`).join('');
}
function rarityOptions(lang) {
  return RARITIES.map((r, i) => `<option value="${i}">${esc(tr.rarity(lang, r))}</option>`).join('');
}

const SECTIONS = ['items', 'bazaar', 'achievements', 'professions', 'events', 'map', 'calculator'];
const SECTION_ICONS = {
  items: '<path d="M5 7h14v12H5zM8 7V5h8v2" />',
  bazaar: '<path d="M4 18 9 12l4 3 7-9M15 6h5v5" />',
  achievements: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 20h8M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />',
  professions: '<path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z" />',
  events: '<path d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />',
  calculator: '<path d="M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />',
};

function home(lang, meta, popular) {
  const c = meta.counts;
  const cards = SECTIONS.map((k) => `<li><a class="card section-card" href="${pagePath(lang, k)}">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SECTION_ICONS[k]}</svg>
    <h3>${esc(t(lang, `nav.${k}`))}</h3><p>${esc(t(lang, `card.${k}`))}</p></a></li>`).join('');
  const li = LANGS.indexOf(lang);
  const pop = popular.map((p) => `<li><a class="chip-item" href="${itemPath(lang, p.id, p.n[li])}"><img src="${esc(iconUrl(p.ic))}" alt="" width="32" height="32" loading="lazy" class="ic r-${esc(p.r)}"><span>${esc(p.n[li])}</span></a></li>`).join('');
  return `
<section class="hero">
  <h1>${esc(t(lang, 'home.title'))}</h1>
  <p class="lead">${esc(t(lang, 'home.lead'))}</p>
  <form class="hero-search" role="search" action="${pagePath(lang, 'items')}" method="get">
    <label class="sr-only" for="heroq">${esc(t(lang, 'searchLabel'))}</label>
    <input id="heroq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false">
    <button type="submit" class="btn btn-primary">${ICONS.search}<span>${esc(t(lang, 'searchBtn'))}</span></button>
  </form>
  <dl class="stats">
    <div><dt>${esc(t(lang, 'home.stats.items'))}</dt><dd>${num(c.items, lang)}</dd></div>
    <div><dt>${esc(t(lang, 'home.stats.recipes'))}</dt><dd>${num(c.recipes, lang)}</dd></div>
    <div><dt>${esc(t(lang, 'home.stats.tradable'))}</dt><dd>${num(c.tradable, lang)}</dd></div>
  </dl>
  <ul class="popular" aria-label="${lang === 'es' ? 'Ítems populares' : 'Popular items'}">${pop}</ul>
</section>
<section aria-labelledby="sec-h">
  <h2 id="sec-h">${esc(t(lang, 'home.sections'))}</h2>
  <ul class="section-grid">${cards}</ul>
</section>
<section aria-labelledby="fav-h" class="js-only">
  <h2 id="fav-h">${esc(t(lang, 'home.favorites'))}</h2>
  <div id="favs" data-empty="${esc(t(lang, 'home.noFavorites'))}"><p class="muted">${esc(t(lang, 'loading'))}</p></div>
</section>`;
}

function items(lang) {
  return `${head(lang, 'items')}
<form class="filters card" id="itemFilters" role="search" action="" method="get">
  <div class="field grow"><label for="iq">${esc(t(lang, 'searchLabel'))}</label><input id="iq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false"></div>
  <div class="field"><label for="it">${esc(t(lang, 'type'))}</label><select id="it" name="type"><option value="">${esc(t(lang, 'all'))}</option>${typeOptions(lang)}</select></div>
  <div class="field"><label for="ir">${esc(t(lang, 'rarity'))}</label><select id="ir" name="rarity"><option value="">${esc(t(lang, 'all'))}</option>${rarityOptions(lang)}</select></div>
  <div class="field narrow"><label for="ilmin">${esc(t(lang, 'minLevel'))}</label><input id="ilmin" name="lmin" type="number" inputmode="numeric" min="0" max="80"></div>
  <div class="field narrow"><label for="ilmax">${esc(t(lang, 'maxLevel'))}</label><input id="ilmax" name="lmax" type="number" inputmode="numeric" min="0" max="80"></div>
  <div class="field check"><input id="itp" name="tp" type="checkbox" value="1"><label for="itp">${esc(t(lang, 'tradableOnly'))}</label></div>
  <div class="field actions"><button class="btn btn-primary" type="submit">${esc(t(lang, 'searchBtn'))}</button><button class="btn" type="reset" id="iclear">${esc(t(lang, 'clear'))}</button></div>
</form>
${noscript(lang)}
<p class="result-count muted" id="icount" aria-live="polite"></p>
<ol class="item-list" id="ilist"></ol>
<nav class="pager" id="ipager" aria-label="${esc(t(lang, 'page'))}"></nav>`;
}

function bazaar(lang) {
  const col = (k, label, cls = 'num') => `<th scope="col" class="${cls}" aria-sort="none"><button type="button" class="sort" data-sort="${k}">${esc(label)}</button></th>`;
  return `${head(lang, 'bazaar', '<p class="muted small" id="bstamp" aria-live="polite"></p>')}
<form class="filters card" id="bzFilters" role="search" action="" method="get">
  <div class="field grow"><label for="bq">${esc(t(lang, 'searchLabel'))}</label><input id="bq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false"></div>
  <div class="field"><label for="bt">${esc(t(lang, 'type'))}</label><select id="bt" name="type"><option value="">${esc(t(lang, 'all'))}</option>${typeOptions(lang)}</select></div>
  <div class="field"><label for="br">${esc(t(lang, 'rarity'))}</label><select id="br" name="rarity"><option value="">${esc(t(lang, 'all'))}</option>${rarityOptions(lang)}</select></div>
  <div class="field narrow"><label for="bd">${esc(t(lang, 'bazaar.minDemand'))}</label><input id="bd" name="dmin" type="number" inputmode="numeric" min="0"></div>
  <div class="field actions"><button class="btn" type="reset">${esc(t(lang, 'clear'))}</button></div>
</form>
${noscript(lang)}
<div class="table-wrap card" tabindex="0" role="region" aria-labelledby="btcap">
<table class="data-table" id="btable">
  <caption id="btcap" class="sr-only">${esc(t(lang, 'bazaar.title'))}</caption>
  <thead><tr>${col('name', t(lang, 'name'), 'left')}${col('buy', t(lang, 'bazaar.buy'))}${col('sell', t(lang, 'bazaar.sell'))}${col('margin', t(lang, 'bazaar.margin'))}${col('supply', t(lang, 'bazaar.supply'))}${col('demand', t(lang, 'bazaar.demand'))}</tr></thead>
  <tbody id="bbody"><tr><td colspan="6" class="empty">${esc(t(lang, 'loading'))}</td></tr></tbody>
</table>
</div>
<p class="muted small">${esc(t(lang, 'bazaar.marginHelp'))} ${esc(t(lang, 'item.feesNote'))}</p>
<nav class="pager" id="bpager" aria-label="${esc(t(lang, 'page'))}"></nav>`;
}

function achievements(lang) {
  return `${head(lang, 'ach')}
${noscript(lang)}
<div class="split">
  <aside class="card side" aria-label="${esc(t(lang, 'ach.title'))}">
    <label class="sr-only" for="acf">${esc(t(lang, 'ach.search'))}</label>
    <input id="acf" type="search" placeholder="${esc(t(lang, 'ach.search'))}" autocomplete="off">
    <div id="acats" class="cat-tree"><p class="muted">${esc(t(lang, 'loading'))}</p></div>
  </aside>
  <section id="alist" class="stack" aria-live="polite"><p class="muted">${esc(t(lang, 'ach.pick'))}</p></section>
</div>`;
}

function professions(lang) {
  return `${head(lang, 'prof')}
${noscript(lang)}
<div class="prof-tabs" id="ptabs" role="tablist" aria-label="${esc(t(lang, 'prof.title'))}"></div>
<section id="pbody" class="stack" aria-live="polite"><p class="muted">${esc(t(lang, 'loading'))}</p></section>`;
}

function events(lang) {
  const es = lang === 'es';
  return `<header class="page-head ev-head"><div><h1>${esc(t(lang, 'ev.title'))}</h1><p class="lead">${esc(t(lang, 'ev.lead'))}</p></div>
  <div class="clock" aria-live="off"><p class="small muted">${esc(t(lang, 'ev.localTime'))}</p><p class="clock-time" id="evClock">--:--</p><p class="small muted" id="evUtc"></p></div></header>
${noscript(lang)}
<form class="filters card" id="evFilters" role="search" action="" method="get">
  <div class="field grow"><label for="evq">${esc(t(lang, 'ev.search'))}</label><input id="evq" type="search" placeholder="${esc(t(lang, 'ev.searchPh'))}" autocomplete="off" spellcheck="false"></div>
  <div class="field"><label for="evc">${esc(t(lang, 'ev.category'))}</label><select id="evc"><option value="">${esc(t(lang, 'all'))}</option></select></div>
  <div class="field"><label for="evr">${esc(t(lang, 'ev.range'))}</label><select id="evr"><option value="2">2 h</option><option value="4">4 h</option><option value="8">8 h</option></select></div>
  <div class="field check"><input id="evtop" type="checkbox"><label for="evtop">${esc(t(lang, 'ev.topTimes'))}</label></div>
</form>
<section aria-labelledby="evtl-h">
  <h2 id="evtl-h">${esc(t(lang, 'ev.timeline'))}</h2>
  <p class="small muted">${esc(t(lang, 'ev.timelineHelp'))}</p>
  <div class="evt-scroll card" tabindex="0" role="region" aria-labelledby="evtl-h"><div id="evTimeline" class="evt-wrapper"></div></div>
  <p class="small muted" id="evHidden"></p>
</section>
<section aria-labelledby="evnow-h"><h2 id="evnow-h">${esc(t(lang, 'ev.now'))}</h2><ul class="ev-list" id="evnow"></ul></section>
<section aria-labelledby="evsoon-h"><h2 id="evsoon-h">${esc(t(lang, 'ev.soon'))}</h2><ul class="ev-list" id="evsoon"></ul></section>
<p class="muted small">${esc(t(lang, 'ev.source'))} ${es ? 'Los eventos que dependen de los jugadores pueden adelantarse o atrasarse unos minutos.' : 'Player-driven events can start a few minutes early or late.'} <a href="${pagePath(lang, 'legal')}#licencias">${esc(t(lang, 'nav.legal'))}</a></p>`;
}

function map(lang) {
  return `${head(lang, 'map')}
<noscript><p class="notice">${esc(t(lang, 'map.noscript'))}</p></noscript>
<div class="map-tools card"><label class="sr-only" for="mq">${esc(t(lang, 'map.search'))}</label><input id="mq" type="search" placeholder="${esc(t(lang, 'map.search'))}" autocomplete="off" list="mqlist"><datalist id="mqlist"></datalist><span class="muted small" id="mcount"></span></div>
<div id="gmap" class="gmap card" role="application" aria-label="${esc(t(lang, 'map.title'))}"></div>
<p class="muted small">${lang === 'es' ? 'Mosaicos y datos: API oficial de Guild Wars 2 (ArenaNet).' : 'Tiles and data: official Guild Wars 2 API (ArenaNet).'}</p>`;
}

function calculator(lang) {
  const coinFields = (p) => `<div class="coin-fields">
    <div class="field"><label for="${p}g">${esc(t(lang, 'calc.gold'))}</label><input id="${p}g" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0"></div>
    <div class="field"><label for="${p}s">${esc(t(lang, 'calc.silver'))}</label><input id="${p}s" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="0"></div>
    <div class="field"><label for="${p}c">${esc(t(lang, 'calc.copper'))}</label><input id="${p}c" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="0"></div></div>`;
  return `${head(lang, 'calc')}
${noscript(lang)}
<div class="grid-2">
  <section class="card" aria-labelledby="cc-h">
    <h2 id="cc-h">${esc(t(lang, 'calc.coins'))}</h2>
    <output class="screen" id="cres" aria-live="polite">0c</output>
    ${coinFields('c')}
    <div class="field narrow"><label for="cf">${esc(t(lang, 'calc.factor'))}</label><input id="cf" inputmode="decimal" autocomplete="off" placeholder="1"></div>
    <div class="btn-row">
      <button class="btn" type="button" data-op="add">${esc(t(lang, 'calc.add'))}</button>
      <button class="btn" type="button" data-op="sub">${esc(t(lang, 'calc.sub'))}</button>
      <button class="btn" type="button" data-op="mul">${esc(t(lang, 'calc.mul'))}</button>
      <button class="btn" type="button" data-op="div">${esc(t(lang, 'calc.div'))}</button>
      <button class="btn btn-ghost" type="button" id="creset">${esc(t(lang, 'calc.reset'))}</button>
    </div>
    <ol class="calc-hist small muted" id="chist"></ol>
  </section>
  <section class="card" aria-labelledby="tp-h">
    <h2 id="tp-h">${esc(t(lang, 'calc.tp'))}</h2>
    <div class="field ac-field"><label for="tpq">${esc(t(lang, 'calc.pickItem'))}</label><input id="tpq" type="search" autocomplete="off" placeholder="${esc(t(lang, 'searchPlaceholder'))}" role="combobox" aria-autocomplete="list" aria-controls="tpq-list" aria-expanded="false"><ul id="tpq-list" class="ac-list" role="listbox" hidden></ul></div>
    <div id="tpitem" class="tp-item"></div>
    <p class="small muted">${esc(t(lang, 'calc.price'))}</p>
    ${coinFields('t')}
    <div class="field narrow"><label for="tq">${esc(t(lang, 'calc.qty'))}</label><input id="tq" inputmode="numeric" value="1" autocomplete="off"></div>
    <dl class="kv" id="tpout"></dl>
    <p class="muted small">${esc(t(lang, 'item.feesNote'))}</p>
  </section>
</div>`;
}

function favorites(lang) {
  return `${head(lang, 'fav')}${noscript(lang)}<div id="favs" data-empty="${esc(t(lang, 'home.noFavorites'))}"><p class="muted">${esc(t(lang, 'loading'))}</p></div>`;
}

function prose(lang, key, es, en) {
  return `<article class="prose card"><h1>${esc(t(lang, key))}</h1>${lang === 'es' ? es : en}</article>`;
}

function legal(lang, meta) {
  const updated = meta.builtAt.slice(0, 10);
  return prose(lang, 'legal.title', `
<p class="muted small">Última revisión del texto: 29 de octubre de 2026.</p>
<h2 id="fansite">Sitio de fans no oficial</h2>
<p>Codex Mercator es un sitio de fans, gratuito y no oficial sobre el juego Guild Wars 2. <strong>No está afiliado, patrocinado, aprobado ni respaldado por ArenaNet, LLC ni por NCSOFT Corporation.</strong></p>
<p>Todo el contenido del juego que se muestra (nombres, descripciones, íconos, mapas y otros datos) es propiedad de ArenaNet y NCSOFT y se usa de acuerdo con los <a href="https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/" rel="noopener">Términos de uso de contenido de Guild Wars 2</a>. Nada en este sitio está detrás de un pago ni de un registro.</p>
<h2 id="marcas">Marcas</h2>
<p>©2010–${updated.slice(0, 4)} ArenaNet, LLC. Todos los derechos reservados. Guild Wars, Guild Wars 2, Heart of Thorns, Guild Wars 2: Path of Fire, Guild Wars 2: End of Dragons, Guild Wars 2: Secrets of the Obscure, Guild Wars 2: Janthir Wilds, Guild Wars 2: Visions of Eternity, ArenaNet, NCSOFT, el logo entrelazado NC y todos los logos y diseños asociados son marcas comerciales o marcas registradas de NCSOFT Corporation. El resto de las marcas pertenecen a sus respectivos dueños.</p>
<h2 id="licencias">Fuentes de datos y licencias</h2>
<ul>
<li><strong>API oficial de Guild Wars 2</strong> (api.guildwars2.com): ítems, recetas, precios del bazar, logros, profesiones y mapa. Los íconos y los mosaicos del mapa se cargan directamente desde los servidores oficiales de ArenaNet (render.guildwars2.com y tiles.guildwars2.com) y no se modifican.</li>
<li><strong>Guild Wars 2 Wiki</strong> (wiki.guildwars2.com): las recetas de la Forja Mística, los vendedores, los contenedores y los horarios de eventos provienen de la wiki oficial (copia archivada en web.archive.org). Ese contenido se publica bajo la <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" rel="noopener license">GNU Free Documentation License 1.2</a>; lo redistribuimos bajo la misma licencia, con la atribución y el enlace a la página original en cada ficha. Las imágenes de la wiki no se usan.</li>
<li><strong>Tipografía</strong>: Cinzel, de Natanael Gama, bajo <a href="https://openfontlicense.org/" rel="noopener license">SIL Open Font License 1.1</a>.</li>
<li><strong>Mapa</strong>: <a href="https://leafletjs.com/" rel="noopener">Leaflet</a> (licencia BSD-2-Clause).</li>
<li><strong>Código del sitio</strong>: licencia MIT. El código no incluye contenido de ArenaNet; los datos se descargan en cada compilación.</li>
</ul>
<h2 id="exactitud">Exactitud de la información</h2>
<p>Los datos se actualizan automáticamente desde la API oficial y pueden contener errores o demoras. Los precios del bazar cambian constantemente y se muestran solo como referencia: no son una recomendación de compra o venta.</p>
<h2 id="contacto">Contacto y pedidos de retiro</h2>
<p>Si sos titular de derechos y creés que algún contenido no debería estar acá, escribinos a <a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a> y lo revisamos de inmediato.</p>`, `
<p class="muted small">Last revised: 29 October 2026.</p>
<h2 id="fansite">Unofficial fan site</h2>
<p>Codex Mercator is a free, unofficial fan site about Guild Wars 2. <strong>It is not affiliated with, sponsored, approved or endorsed by ArenaNet, LLC or NCSOFT Corporation.</strong></p>
<p>All game content shown (names, descriptions, icons, maps and other data) is the property of ArenaNet and NCSOFT and is used under the <a href="https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/" rel="noopener">Guild Wars 2 Content Terms of Use</a>. Nothing on this site is behind a paywall or a sign-up.</p>
<h2 id="marcas">Trademarks</h2>
<p>©2010–${updated.slice(0, 4)} ArenaNet, LLC. All rights reserved. Guild Wars, Guild Wars 2, Heart of Thorns, Guild Wars 2: Path of Fire, Guild Wars 2: End of Dragons, Guild Wars 2: Secrets of the Obscure, Guild Wars 2: Janthir Wilds, Guild Wars 2: Visions of Eternity, ArenaNet, NCSOFT, the Interlocking NC Logo, and all associated logos and designs are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners.</p>
<h2 id="licencias">Data sources and licenses</h2>
<ul>
<li><strong>Official Guild Wars 2 API</strong> (api.guildwars2.com): items, recipes, trading post prices, achievements, professions and the map. Icons and map tiles are loaded directly from ArenaNet's official servers (render.guildwars2.com and tiles.guildwars2.com) and are not modified.</li>
<li><strong>Guild Wars 2 Wiki</strong> (wiki.guildwars2.com): Mystic Forge recipes, vendors, containers and event schedules come from the official wiki (archived copy on web.archive.org). That content is published under the <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" rel="noopener license">GNU Free Documentation License 1.2</a>; we redistribute it under the same license, with attribution and a link to the original page on every item page. No wiki images are used.</li>
<li><strong>Typeface</strong>: Cinzel by Natanael Gama, under the <a href="https://openfontlicense.org/" rel="noopener license">SIL Open Font License 1.1</a>.</li>
<li><strong>Map</strong>: <a href="https://leafletjs.com/" rel="noopener">Leaflet</a> (BSD-2-Clause license).</li>
<li><strong>Site code</strong>: MIT license. The code contains no ArenaNet content; data is downloaded at build time.</li>
</ul>
<h2 id="exactitud">Accuracy</h2>
<p>Data is updated automatically from the official API and may contain errors or delays. Trading post prices change constantly and are shown for reference only: they are not buying or selling advice.</p>
<h2 id="contacto">Contact and takedown requests</h2>
<p>If you are a rights holder and believe some content should not be here, write to <a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a> and we will review it right away.</p>`);
}

function privacy(lang) {
  return prose(lang, 'privacy.title', `
<p class="muted small">Última revisión: 29 de octubre de 2026.</p>
<p>Codex Mercator no tiene cuentas de usuario, formularios ni publicidad personalizada, y <strong>no usa cookies</strong>.</p>
<h2>Qué se guarda en tu navegador</h2>
<p>Solo preferencias que nunca salen de tu dispositivo: el tema claro u oscuro, tus ítems favoritos y una copia en caché del índice de ítems para que la búsqueda sea rápida. Podés borrarlas cuando quieras limpiando los datos del sitio en tu navegador.</p>
<h2>Conexiones a terceros</h2>
<p>Para mostrar precios y datos en vivo, tu navegador se conecta directamente a la API oficial de Guild Wars 2 (api.guildwars2.com) y carga íconos y mosaicos de render.guildwars2.com y tiles.guildwars2.com, servidores de ArenaNet. ArenaNet recibe tu dirección IP como en cualquier conexión web; consultá su <a href="https://www.arena.net/en/legal/privacy-policy" rel="noopener">política de privacidad</a>.</p>
<h2>Alojamiento</h2>
<p>El sitio está alojado en Cloudflare, que procesa datos técnicos (IP, navegador, página visitada) para servirlo y protegerlo de ataques, según su <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">política de privacidad</a>. No usamos esos datos para identificarte.</p>
<h2>Estadísticas</h2>
<p>Si activamos estadísticas de visitas, serán agregadas y sin cookies (Cloudflare Web Analytics), y lo vamos a indicar en esta página.</p>
<h2>Contacto</h2>
<p><a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a></p>`, `
<p class="muted small">Last revised: 29 October 2026.</p>
<p>Codex Mercator has no user accounts, forms or personalized advertising, and <strong>does not use cookies</strong>.</p>
<h2>What is stored in your browser</h2>
<p>Only preferences that never leave your device: light or dark theme, your favorite items and a cached copy of the item index so search is fast. You can delete them at any time by clearing this site's data in your browser.</p>
<h2>Third-party connections</h2>
<p>To show live prices and data, your browser connects directly to the official Guild Wars 2 API (api.guildwars2.com) and loads icons and map tiles from render.guildwars2.com and tiles.guildwars2.com, which are ArenaNet servers. ArenaNet receives your IP address as with any web request; see their <a href="https://www.arena.net/en/legal/privacy-policy" rel="noopener">privacy policy</a>.</p>
<h2>Hosting</h2>
<p>The site is hosted on Cloudflare, which processes technical data (IP, browser, page visited) to serve it and protect it from attacks, under its <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">privacy policy</a>. We do not use that data to identify you.</p>
<h2>Analytics</h2>
<p>If we enable visit statistics, they will be aggregated and cookie-free (Cloudflare Web Analytics), and this page will say so.</p>
<h2>Contact</h2>
<p><a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a></p>`);
}

function about(lang) {
  return prose(lang, 'about.title', `
<p>Codex Mercator es una base de datos de Guild Wars 2 hecha por y para la comunidad: todos los ítems del juego, sus recetas, la Forja Mística y el bazar en vivo, en español y en inglés.</p>
<h2>Cómo funciona</h2>
<ul><li>Varias veces por día, el sitio descarga los datos de la API oficial y regenera todas las fichas.</li><li>Los precios que ves en la ficha de un ítem y en el bazar se piden en vivo a la API cuando abrís la página.</li><li>No hay cuentas ni rastreo: lo que guardás (favoritos, tema) queda solo en tu navegador.</li></ul>
<h2>Qué viene</h2>
<p>Recomendaciones de venta, crafteo rentable, historial de precios y planificador de legendarias.</p>
<p>¿Encontraste un error? Escribinos a <a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a>.</p>`, `
<p>Codex Mercator is a Guild Wars 2 database made by and for the community: every item in the game, its recipes, the Mystic Forge and the live trading post, in English and Spanish.</p>
<h2>How it works</h2>
<ul><li>Several times a day the site downloads the official API data and rebuilds every item page.</li><li>Prices on item pages and on the trading post are requested live from the API when you open the page.</li><li>No accounts and no tracking: what you save (favorites, theme) stays in your browser.</li></ul>
<h2>Coming next</h2>
<p>Selling recommendations, profitable crafting, price history and a legendary planner.</p>
<p>Found a mistake? Write to <a href="mailto:contacto@codexmercator.com">contacto@codexmercator.com</a>.</p>`);
}

function notFound(lang) {
  return `<section class="empty-state"><h1>${esc(t(lang, 'notfound.title'))}</h1><p class="lead">${esc(t(lang, 'notfound.lead'))}</p><p><a class="btn btn-primary" href="${pagePath(lang, 'home')}">${esc(t(lang, 'notfound.back'))}</a></p></section>`;
}

export function renderStaticPages(meta, { popular = [] } = {}) {
  const out = {};
  for (const lang of LANGS) {
    const base = { lang, meta };
    const P = (page, body, extra = {}) => {
      out[pagePath(lang, page)] = layout({ ...base, page, alternates: alternatesFor(page), title: page === 'home' ? '' : (extra.title || t(lang, `nav.${page}`)), description: extra.description || t(lang, `${extra.lead || page}`), body, scripts: extra.scripts, styles: extra.styles, jsonLd: extra.jsonLd, noindex: extra.noindex });
    };
    P('home', home(lang, meta, popular), {
      description: t(lang, 'home.lead'), scripts: ['home'],
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Codex Mercator', url: `${meta.siteUrl}/${lang}/`, inLanguage: lang, potentialAction: { '@type': 'SearchAction', target: `${meta.siteUrl}${pagePath(lang, 'items')}?q={query}`, 'query-input': 'required name=query' } },
    });
    P('items', items(lang), { title: t(lang, 'items.title'), description: t(lang, 'items.lead'), scripts: ['items'] });
    P('bazaar', bazaar(lang), { title: t(lang, 'bazaar.title'), description: t(lang, 'bazaar.lead'), scripts: ['bazaar'] });
    P('achievements', achievements(lang), { title: t(lang, 'ach.title'), description: t(lang, 'ach.lead'), scripts: ['achievements'] });
    P('professions', professions(lang), { title: t(lang, 'prof.title'), description: t(lang, 'prof.lead'), scripts: ['professions'] });
    P('events', events(lang), { title: t(lang, 'ev.title'), description: t(lang, 'ev.lead'), scripts: ['events'] });
    P('map', map(lang), { title: t(lang, 'map.title'), description: t(lang, 'map.lead'), scripts: ['map'], styles: ['map'] });
    P('calculator', calculator(lang), { title: t(lang, 'calc.title'), description: t(lang, 'calc.lead'), scripts: ['calculator'] });
    P('favorites', favorites(lang), { title: t(lang, 'fav.title'), description: t(lang, 'fav.lead'), scripts: ['home'], noindex: true });
    P('legal', legal(lang, meta), { title: t(lang, 'legal.title'), description: t(lang, 'footerDisclaimer') });
    P('privacy', privacy(lang), { title: t(lang, 'privacy.title'), description: lang === 'es' ? 'Codex Mercator no usa cookies ni cuentas de usuario.' : 'Codex Mercator uses no cookies and no user accounts.' });
    P('about', about(lang), { title: t(lang, 'about.title'), description: t(lang, 'home.lead') });
    out[`/${lang}/404`] = layout({ ...base, page: '', alternates: { es: '/es/', en: '/en/' }, title: t(lang, 'notfound.title'), description: t(lang, 'notfound.lead'), body: notFound(lang), noindex: true });
  }
  return out;
}
