// Static pages (one HTML per language). Live data is loaded by the scripts in src/client/pages/.
import { esc, iconUrl, num } from '../src/shared/format.js';
import { LANGS, pagePath, t, itemPath, tr, RARITIES, TYPE_KEYS } from '../src/shared/i18n.js';
import { layout, alternatesFor } from '../src/shared/layout.js';

const head = (lang, key, extra = '') => `<header class="page-head"><div><h1>${esc(t(lang, `${key}.title`))}</h1><p class="lead">${esc(t(lang, `${key}.lead`))}</p></div>${extra}</header>`;
const noscript = (lang) => `<noscript><p class="notice">${esc(t(lang, 'noscript'))}</p></noscript>`;

/**
 * Option list shown as selectable boxes in a row that wraps (radio or checkbox inputs styled as chips).
 * The inputs share a name, so form[name].value works like a <select>.
 */
export function chips(name, legend, options, { type = 'radio', all = null, current = '', cls = '' } = {}) {
  const opts = all != null ? [{ v: '', label: all }, ...options] : options;
  return `<fieldset class="chips ${cls}"><legend>${esc(legend)}</legend><div class="chip-row">${opts.map((o, i) => {
    const id = `${name}-${i}`;
    const checked = type === 'radio' ? String(o.v) === String(current) : o.on;
    return `<input type="${type}" class="chip-input" name="${name}" id="${id}" value="${esc(o.v)}"${checked ? ' checked' : ''}><label class="chip${o.cls ? ` ${o.cls}` : ''}" for="${id}">${esc(o.label)}</label>`;
  }).join('')}</div></fieldset>`;
}
const typeChips = (lang, name) => chips(name, t(lang, 'type'), TYPE_KEYS.map((k, i) => ({ v: i, label: tr.type(lang, k) })).sort((a, b) => a.label.localeCompare(b.label, lang)), { all: t(lang, 'all') });
const rarityChips = (lang, name, only) => chips(name, t(lang, 'rarity'), RARITIES.map((r, i) => ({ v: i, label: tr.rarity(lang, r), cls: `chip-r r-txt-${r}` })).filter((o) => !only || only.includes(RARITIES[o.v])), { all: t(lang, 'all') });

function items(lang, meta, popular) {
  const c = meta.counts;
  const li = LANGS.indexOf(lang);
  const pop = popular.map((p) => `<li><a class="chip-item" href="${itemPath(lang, p.id, p.n[li])}"><img src="${esc(iconUrl(p.ic))}" alt="" width="28" height="28" loading="lazy" class="ic r-${esc(p.r)}"><span>${esc(p.n[li])}</span></a></li>`).join('');
  const stats = `<dl class="stats"><div><dt>${esc(t(lang, 'home.stats.items'))}</dt><dd>${num(c.items, lang)}</dd></div><div><dt>${esc(t(lang, 'home.stats.recipes'))}</dt><dd>${num(c.recipes, lang)}</dd></div><div><dt>${esc(t(lang, 'home.stats.tradable'))}</dt><dd>${num(c.tradable, lang)}</dd></div></dl>`;
  return `${head(lang, 'items', stats)}
<form class="filters card" id="itemFilters" role="search" action="" method="get">
  <div class="filter-top">
    <div class="field grow"><label for="iq">${esc(t(lang, 'searchLabel'))}</label><input id="iq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false"></div>
    <div class="field narrow"><label for="ilmin">${esc(t(lang, 'minLevel'))}</label><input id="ilmin" name="lmin" type="number" inputmode="numeric" min="0" max="80"></div>
    <div class="field narrow"><label for="ilmax">${esc(t(lang, 'maxLevel'))}</label><input id="ilmax" name="lmax" type="number" inputmode="numeric" min="0" max="80"></div>
    <div class="field check"><input id="itp" name="tp" type="checkbox" value="1"><label for="itp">${esc(t(lang, 'tradableOnly'))}</label></div>
    <div class="field actions"><button class="btn btn-primary" type="submit">${esc(t(lang, 'searchBtn'))}</button><button class="btn" type="reset">${esc(t(lang, 'clear'))}</button></div>
  </div>
  ${rarityChips(lang, 'rarity')}
  ${typeChips(lang, 'type')}
</form>
<ul class="popular" aria-label="${lang === 'es' ? 'Ítems populares' : 'Popular items'}">${pop}</ul>
${noscript(lang)}
<p class="result-count muted" id="icount" aria-live="polite"></p>
<ol class="item-list" id="ilist"></ol>
<nav class="pager" id="ipager" aria-label="${esc(t(lang, 'page'))}"></nav>`;
}

function gear(lang) {
  const SLOTS = ['Weapon', 'Armor', 'Trinket', 'Back', 'UpgradeComponent', 'Relic', 'Gathering'];
  const src = ['forge', 'craft', 'ach', 'vendor', 'container', 'tp'];
  return `${head(lang, 'gear')}
<form class="filters card" id="gearFilters" role="search" action="" method="get">
  <div class="filter-top">
    <div class="field grow"><label for="gq">${esc(t(lang, 'searchLabel'))}</label><input id="gq" name="q" type="search" placeholder="${esc(lang === 'es' ? 'Ej: Crepúsculo, Aurora, Berserker, ascendido…' : 'E.g. Twilight, Aurora, Berserker, ascended…')}" autocomplete="off" spellcheck="false"></div>
    <div class="field actions"><button class="btn" type="reset">${esc(t(lang, 'clear'))}</button></div>
  </div>
  ${chips('grar', t(lang, 'rarity'), [{ v: '1', label: tr.rarity(lang, 'Legendary'), cls: 'chip-r r-txt-Legendary' }, { v: '0', label: tr.rarity(lang, 'Ascended'), cls: 'chip-r r-txt-Ascended' }], { all: t(lang, 'all') })}
  ${chips('gslot', t(lang, 'gear.slot'), SLOTS.map((k) => ({ v: k, label: tr.type(lang, k) })), { all: t(lang, 'all') })}
  ${chips('gsub', lang === 'es' ? 'Subtipo' : 'Subtype', [], { all: t(lang, 'all'), cls: 'js-sub' })}
  ${chips('gw', t(lang, 'gear.weight'), ['Light', 'Medium', 'Heavy'].map((w) => ({ v: w, label: tr.weight(lang, w) })), { all: t(lang, 'all'), cls: 'js-weight' })}
  ${chips('gsrc', t(lang, 'gear.source'), src.map((k) => ({ v: k, label: t(lang, `gear.src.${k}`), on: false })), { type: 'checkbox' })}
</form>
${noscript(lang)}
<p class="result-count muted" id="gcount" aria-live="polite"></p>
<ol class="gear-list" id="glist"></ol>
<nav class="pager" id="gpager" aria-label="${esc(t(lang, 'page'))}"></nav>`;
}

function vendors(lang) {
  return `${head(lang, 'vendors', '<p class="muted small stamp" id="vstat" aria-live="polite"></p>')}
<form class="filters card" id="vFilters" role="search" action="" method="get">
  <div class="filter-top">
    <div class="field grow"><label for="vq">${esc(t(lang, 'vendors.search'))}</label><input id="vq" name="q" type="search" placeholder="${esc(t(lang, 'vendors.searchPh'))}" autocomplete="off" spellcheck="false"></div>
    <div class="field check"><input id="voff" name="off" type="checkbox" value="1"><label for="voff">${esc(t(lang, 'vendors.showOff'))}</label></div>
    <div class="field actions"><button class="btn" type="reset">${esc(t(lang, 'clear'))}</button></div>
  </div>
  <div id="vcur">${chips('vc', t(lang, 'vendors.currency'), [], { all: t(lang, 'all') })}</div>
</form>
${noscript(lang)}
<p class="result-count muted" id="vcount" aria-live="polite"></p>
<div class="vendor-list" id="vlist"></div>
<nav class="pager" id="vpager" aria-label="${esc(t(lang, 'page'))}"></nav>
<p class="muted small">${esc(t(lang, 'vendors.source'))} <a href="${pagePath(lang, 'legal')}#licencias">${esc(t(lang, 'nav.legal'))}</a></p>`;
}

function bazaar(lang) {
  const col = (k, label, cls = 'num') => `<th scope="col" class="${cls}" aria-sort="none"><button type="button" class="sort" data-sort="${k}">${esc(label)}</button></th>`;
  return `${head(lang, 'bazaar', '<p class="muted small stamp" id="bstamp" aria-live="polite"></p>')}
<form class="filters card" id="bzFilters" role="search" action="" method="get">
  <div class="filter-top">
    <div class="field grow"><label for="bq">${esc(t(lang, 'searchLabel'))}</label><input id="bq" name="q" type="search" placeholder="${esc(t(lang, 'searchPlaceholder'))}" autocomplete="off" spellcheck="false"></div>
    <div class="field narrow"><label for="bd">${esc(t(lang, 'bazaar.minDemand'))}</label><input id="bd" name="dmin" type="number" inputmode="numeric" min="0"></div>
    <div class="field actions"><button class="btn" type="reset">${esc(t(lang, 'clear'))}</button></div>
  </div>
  ${rarityChips(lang, 'rarity')}
  ${typeChips(lang, 'type')}
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
  <section id="alist" class="stack" aria-live="polite"><p class="muted">${esc(t(lang, 'loading'))}</p></section>
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
  const clock = `<div class="clock" aria-live="off"><p class="small muted">${esc(t(lang, 'ev.localTime'))}</p><p class="clock-time" id="evClock">--:--</p><p class="small muted" id="evUtc"></p></div>`;
  return `${head(lang, 'ev', clock)}
${noscript(lang)}
<form class="filters card" id="evFilters" role="search" action="" method="get">
  <div class="filter-top">
    <div class="field grow"><label for="evq">${esc(t(lang, 'ev.search'))}</label><input id="evq" type="search" placeholder="${esc(t(lang, 'ev.searchPh'))}" autocomplete="off" spellcheck="false"></div>
    ${chips('evr', t(lang, 'ev.range'), [2, 4, 8].map((h) => ({ v: h, label: `${h} h` })), { current: 2, cls: 'inline' })}
    <div class="field check"><input id="evtop" type="checkbox"><label for="evtop">${esc(t(lang, 'ev.topTimes'))}</label></div>
  </div>
  <div id="evcats">${chips('evc', t(lang, 'ev.category'), [], { all: t(lang, 'all') })}</div>
</form>
<details class="card ev-alarms" id="evAlarms">
  <summary><span class="al-title">🔔 ${esc(t(lang, 'al.title'))}</span> <span class="small muted" id="alCount"></span></summary>
  <p class="small muted">${esc(t(lang, 'al.help'))}</p>
  <div class="al-tools">
    ${chips('allead', t(lang, 'al.lead'), [0, 1, 2, 5, 10, 15].map((m) => ({ v: m, label: m ? `${m} min` : t(lang, 'al.atStart') })), { current: 5 })}
    ${chips('alsound', t(lang, 'al.sound'), [['bell', es ? 'Campanita' : 'Bell'], ['gong', es ? 'Gong suave' : 'Soft gong'], ['drops', es ? 'Gotas' : 'Drops'], ['marimba', 'Marimba']].map(([v, label]) => ({ v, label })), { current: 'bell' })}
    <div class="al-row">
      <div class="field al-vol"><label for="alvol">${esc(t(lang, 'al.volume'))}</label><input id="alvol" type="range" min="0.05" max="1" step="0.05" value="0.5"></div>
      <button type="button" class="btn btn-small" id="alTest">▶ ${esc(t(lang, 'al.test'))}</button>
      <button type="button" class="btn btn-small" id="alNotif" aria-pressed="false">${esc(t(lang, 'al.notifOn'))}</button>
    </div>
  </div>
  <div id="alList" class="al-list" aria-live="polite"></div>
  <p class="small muted">${esc(t(lang, 'al.note'))}</p>
</details>
<section aria-labelledby="evtl-h">
  <div class="section-head"><h2 id="evtl-h">${esc(t(lang, 'ev.timeline'))}</h2><p class="small muted">${esc(t(lang, 'ev.timelineHelp'))}</p></div>
  <div class="evt-scroll card" tabindex="0" role="region" aria-labelledby="evtl-h"><div id="evTimeline" class="evt-wrapper"></div></div>
  <p class="small muted" id="evHidden"></p>
</section>
<div class="ev-cols">
  <section aria-labelledby="evnow-h"><h2 id="evnow-h">${esc(t(lang, 'ev.now'))}</h2><ul class="ev-list" id="evnow"></ul></section>
  <section aria-labelledby="evsoon-h"><h2 id="evsoon-h">${esc(t(lang, 'ev.soon'))}</h2><ul class="ev-list" id="evsoon"></ul></section>
</div>
<p class="muted small">${esc(t(lang, 'ev.source'))} ${es ? 'Los eventos que dependen de los jugadores pueden adelantarse o atrasarse unos minutos.' : 'Player-driven events can start a few minutes early or late.'} <a href="${pagePath(lang, 'legal')}#licencias">${esc(t(lang, 'nav.legal'))}</a></p>`;
}

function map(lang) {
  const es = lang === 'es';
  return `${head(lang, 'map')}
<noscript><p class="notice">${esc(t(lang, 'map.noscript'))}</p></noscript>
<div class="map-layout">
  <aside class="card map-side" aria-label="${esc(t(lang, 'map.search'))}">
    <div class="field"><label for="mq">${esc(t(lang, 'map.search'))}</label><input id="mq" type="search" placeholder="${esc(es ? 'Ej: Arco del León, Tequatl…' : "E.g. Lion's Arch, Tequatl…")}" autocomplete="off" spellcheck="false"></div>
    ${chips('mkind', es ? 'Mostrar' : 'Show', [{ v: 'map', label: es ? 'Mapas' : 'Maps', on: true }, { v: 'wp', label: es ? 'Puntos de ruta' : 'Waypoints', on: true }, { v: 'ev', label: es ? 'Eventos' : 'Events', on: true }], { type: 'checkbox' })}
    <p class="small muted" id="mcount" aria-live="polite"></p>
    <ul class="map-results" id="mres"></ul>
  </aside>
  <div id="gmap" class="gmap card" role="application" aria-label="${esc(t(lang, 'map.title'))}"></div>
</div>
<p class="muted small">${es ? 'Mosaicos y datos: API oficial de Guild Wars 2 (ArenaNet).' : 'Tiles and data: official Guild Wars 2 API (ArenaNet).'}</p>`;
}

function calculator(lang) {
  const coinFields = (p) => `<div class="coin-fields">
    <div class="field"><label for="${p}g">${esc(t(lang, 'calc.gold'))}</label><input id="${p}g" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0"></div>
    <div class="field"><label for="${p}s">${esc(t(lang, 'calc.silver'))}</label><input id="${p}s" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="0"></div>
    <div class="field"><label for="${p}c">${esc(t(lang, 'calc.copper'))}</label><input id="${p}c" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="0"></div></div>`;
  const tab = (id, label, on) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${on}" tabindex="${on ? 0 : -1}">${esc(label)}</button>`;
  return `${head(lang, 'calc')}
${noscript(lang)}
<div class="seg-tabs" role="tablist" aria-label="${esc(t(lang, 'calc.tabs'))}">${tab('coins', t(lang, 'calc.coins'), true)}${tab('tp', t(lang, 'calc.tp'), false)}</div>
<section class="card calc-panel" role="tabpanel" id="panel-coins" aria-labelledby="tab-coins">
  <div class="calc-grid">
    <div>
      <output class="screen" id="cres" aria-live="polite">0c</output>
      ${coinFields('c')}
      <div class="field narrow"><label for="cf">${esc(t(lang, 'calc.factor'))}</label><input id="cf" inputmode="decimal" autocomplete="off" placeholder="1"></div>
      <div class="btn-grid">
        <button class="btn" type="button" data-op="add">+ ${esc(t(lang, 'calc.add'))}</button>
        <button class="btn" type="button" data-op="sub">− ${esc(t(lang, 'calc.sub'))}</button>
        <button class="btn" type="button" data-op="mul">× ${esc(t(lang, 'calc.mul'))}</button>
        <button class="btn" type="button" data-op="div">÷ ${esc(t(lang, 'calc.div'))}</button>
        <button class="btn btn-ghost span-2" type="button" id="creset">${esc(t(lang, 'calc.reset'))}</button>
      </div>
    </div>
    <div><h2 class="h-sub">${lang === 'es' ? 'Historial' : 'History'}</h2><ol class="calc-hist small" id="chist"></ol></div>
  </div>
</section>
<section class="card calc-panel" role="tabpanel" id="panel-tp" aria-labelledby="tab-tp" hidden>
  <div class="calc-grid">
    <div>
      <div class="field ac-field"><label for="tpq">${esc(t(lang, 'calc.pickItem'))}</label><input id="tpq" type="search" autocomplete="off" placeholder="${esc(t(lang, 'searchPlaceholder'))}" role="combobox" aria-autocomplete="list" aria-controls="tpq-list" aria-expanded="false"><ul id="tpq-list" class="ac-list" role="listbox" hidden></ul></div>
      <div id="tpitem" class="tp-item"></div>
      <p class="small muted">${esc(t(lang, 'calc.price'))}</p>
      ${coinFields('t')}
      <div class="field narrow"><label for="tq">${esc(t(lang, 'calc.qty'))}</label><input id="tq" inputmode="numeric" value="1" autocomplete="off"></div>
    </div>
    <div><dl class="kv kv-big" id="tpout"></dl><p class="muted small">${esc(t(lang, 'item.feesNote'))}</p></div>
  </div>
</section>`;
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
<p>Bazaar Ledger es un sitio de fans, gratuito y no oficial sobre el juego Guild Wars 2. <strong>No está afiliado, patrocinado, aprobado ni respaldado por ArenaNet, LLC ni por NCSOFT Corporation.</strong></p>
<p>Todo el contenido del juego que se muestra (nombres, descripciones, íconos, mapas y otros datos) es propiedad de ArenaNet y NCSOFT y se usa de acuerdo con los <a href="https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/" rel="noopener">Términos de uso de contenido de Guild Wars 2</a>. Nada en este sitio está detrás de un pago ni de un registro.</p>
<h2 id="marcas">Marcas</h2>
<p>©2010–${updated.slice(0, 4)} ArenaNet, LLC. Todos los derechos reservados. Guild Wars, Guild Wars 2, Heart of Thorns, Guild Wars 2: Path of Fire, Guild Wars 2: End of Dragons, Guild Wars 2: Secrets of the Obscure, Guild Wars 2: Janthir Wilds, Guild Wars 2: Visions of Eternity, ArenaNet, NCSOFT, el logo entrelazado NC y todos los logos y diseños asociados son marcas comerciales o marcas registradas de NCSOFT Corporation. El resto de las marcas pertenecen a sus respectivos dueños.</p>
<h2 id="licencias">Fuentes de datos y licencias</h2>
<ul>
<li><strong>API oficial de Guild Wars 2</strong> (api.guildwars2.com): ítems, recetas, precios del bazar, logros, profesiones y mapa. Los íconos y los mosaicos del mapa se cargan directamente desde los servidores oficiales de ArenaNet (render.guildwars2.com y tiles.guildwars2.com) y no se modifican.</li>
<li><strong>Guild Wars 2 Wiki</strong> (wiki.guildwars2.com): las recetas de la Forja Mística, los vendedores, los contenedores y los horarios de eventos provienen de la wiki oficial (copia archivada en web.archive.org). Ese contenido se publica bajo la <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" rel="noopener license">GNU Free Documentation License 1.2</a>; lo redistribuimos bajo la misma licencia, con la atribución y el enlace a la página original en cada ficha. Las imágenes de la wiki no se usan.</li>
<li><strong>Contenido de contenedores, guías escritas a mano e ítems y logros retirados del juego</strong>: recopilados por el proyecto anterior de este sitio (Bazar GW2). Las guías de logros provienen de la Guild Wars 2 Wiki (GFDL 1.2).</li>
<li><strong>Contenido actualizado de contenedores, ítems retirados y recetas de la Forja Mística que faltan en la wiki</strong>: API pública de gw2treasures.com.</li>
<li><strong>Tipografía</strong>: Cinzel, de Natanael Gama, bajo <a href="https://openfontlicense.org/" rel="noopener license">SIL Open Font License 1.1</a>.</li>
<li><strong>Mapa</strong>: <a href="https://leafletjs.com/" rel="noopener">Leaflet</a> (licencia BSD-2-Clause).</li>
<li><strong>Código del sitio</strong>: licencia MIT. El código no incluye contenido de ArenaNet; los datos se descargan en cada compilación.</li>
</ul>
<h2 id="exactitud">Exactitud de la información</h2>
<p>Los datos se actualizan automáticamente desde la API oficial y pueden contener errores o demoras. Los precios del bazar cambian constantemente y se muestran solo como referencia: no son una recomendación de compra o venta.</p>
<h2 id="contacto">Contacto y pedidos de retiro</h2>
<p>Si sos titular de derechos y creés que algún contenido no debería estar acá, escribinos a <a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a> y lo revisamos de inmediato.</p>`, `
<p class="muted small">Last revised: 29 October 2026.</p>
<h2 id="fansite">Unofficial fan site</h2>
<p>Bazaar Ledger is a free, unofficial fan site about Guild Wars 2. <strong>It is not affiliated with, sponsored, approved or endorsed by ArenaNet, LLC or NCSOFT Corporation.</strong></p>
<p>All game content shown (names, descriptions, icons, maps and other data) is the property of ArenaNet and NCSOFT and is used under the <a href="https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/" rel="noopener">Guild Wars 2 Content Terms of Use</a>. Nothing on this site is behind a paywall or a sign-up.</p>
<h2 id="marcas">Trademarks</h2>
<p>©2010–${updated.slice(0, 4)} ArenaNet, LLC. All rights reserved. Guild Wars, Guild Wars 2, Heart of Thorns, Guild Wars 2: Path of Fire, Guild Wars 2: End of Dragons, Guild Wars 2: Secrets of the Obscure, Guild Wars 2: Janthir Wilds, Guild Wars 2: Visions of Eternity, ArenaNet, NCSOFT, the Interlocking NC Logo, and all associated logos and designs are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners.</p>
<h2 id="licencias">Data sources and licenses</h2>
<ul>
<li><strong>Official Guild Wars 2 API</strong> (api.guildwars2.com): items, recipes, trading post prices, achievements, professions and the map. Icons and map tiles are loaded directly from ArenaNet's official servers (render.guildwars2.com and tiles.guildwars2.com) and are not modified.</li>
<li><strong>Guild Wars 2 Wiki</strong> (wiki.guildwars2.com): Mystic Forge recipes, vendors, containers and event schedules come from the official wiki (archived copy on web.archive.org). That content is published under the <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" rel="noopener license">GNU Free Documentation License 1.2</a>; we redistribute it under the same license, with attribution and a link to the original page on every item page. No wiki images are used.</li>
<li><strong>Container contents, hand-written guides and items and achievements removed from the game</strong>: compiled by this site's previous project (Bazar GW2). Achievement guides come from the Guild Wars 2 Wiki (GFDL 1.2).</li>
<li><strong>Up-to-date container contents, removed items and Mystic Forge recipes missing from the wiki</strong>: gw2treasures.com public API.</li>
<li><strong>Typeface</strong>: Cinzel by Natanael Gama, under the <a href="https://openfontlicense.org/" rel="noopener license">SIL Open Font License 1.1</a>.</li>
<li><strong>Map</strong>: <a href="https://leafletjs.com/" rel="noopener">Leaflet</a> (BSD-2-Clause license).</li>
<li><strong>Site code</strong>: MIT license. The code contains no ArenaNet content; data is downloaded at build time.</li>
</ul>
<h2 id="exactitud">Accuracy</h2>
<p>Data is updated automatically from the official API and may contain errors or delays. Trading post prices change constantly and are shown for reference only: they are not buying or selling advice.</p>
<h2 id="contacto">Contact and takedown requests</h2>
<p>If you are a rights holder and believe some content should not be here, write to <a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a> and we will review it right away.</p>`);
}

function privacy(lang) {
  return prose(lang, 'privacy.title', `
<p class="muted small">Última revisión: 29 de octubre de 2026.</p>
<p>Bazaar Ledger no tiene cuentas de usuario, formularios ni publicidad personalizada, y <strong>no usa cookies</strong>.</p>
<h2>Qué se guarda en tu navegador</h2>
<p>Solo preferencias que nunca salen de tu dispositivo: el tema claro u oscuro, tus ítems favoritos y una copia en caché del índice de ítems para que la búsqueda sea rápida. Podés borrarlas cuando quieras limpiando los datos del sitio en tu navegador.</p>
<h2>Conexiones a terceros</h2>
<p>Para mostrar precios y datos en vivo, tu navegador se conecta directamente a la API oficial de Guild Wars 2 (api.guildwars2.com) y carga íconos y mosaicos de render.guildwars2.com y tiles.guildwars2.com, servidores de ArenaNet. ArenaNet recibe tu dirección IP como en cualquier conexión web; consultá su <a href="https://www.arena.net/en/legal/privacy-policy" rel="noopener">política de privacidad</a>.</p>
<h2>Alojamiento</h2>
<p>El sitio está alojado en Cloudflare, que procesa datos técnicos (IP, navegador, página visitada) para servirlo y protegerlo de ataques, según su <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">política de privacidad</a>. No usamos esos datos para identificarte.</p>
<h2>Estadísticas</h2>
<p>Si activamos estadísticas de visitas, serán agregadas y sin cookies (Cloudflare Web Analytics), y lo vamos a indicar en esta página.</p>
<h2>Contacto</h2>
<p><a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a></p>`, `
<p class="muted small">Last revised: 29 October 2026.</p>
<p>Bazaar Ledger has no user accounts, forms or personalized advertising, and <strong>does not use cookies</strong>.</p>
<h2>What is stored in your browser</h2>
<p>Only preferences that never leave your device: light or dark theme, your favorite items and a cached copy of the item index so search is fast. You can delete them at any time by clearing this site's data in your browser.</p>
<h2>Third-party connections</h2>
<p>To show live prices and data, your browser connects directly to the official Guild Wars 2 API (api.guildwars2.com) and loads icons and map tiles from render.guildwars2.com and tiles.guildwars2.com, which are ArenaNet servers. ArenaNet receives your IP address as with any web request; see their <a href="https://www.arena.net/en/legal/privacy-policy" rel="noopener">privacy policy</a>.</p>
<h2>Hosting</h2>
<p>The site is hosted on Cloudflare, which processes technical data (IP, browser, page visited) to serve it and protect it from attacks, under its <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">privacy policy</a>. We do not use that data to identify you.</p>
<h2>Analytics</h2>
<p>If we enable visit statistics, they will be aggregated and cookie-free (Cloudflare Web Analytics), and this page will say so.</p>
<h2>Contact</h2>
<p><a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a></p>`);
}

function about(lang) {
  return prose(lang, 'about.title', `
<p>Bazaar Ledger es una base de datos de Guild Wars 2 hecha por y para la comunidad: todos los ítems del juego, sus recetas, la Forja Mística y el bazar en vivo, en español y en inglés.</p>
<h2>Cómo funciona</h2>
<ul><li>Varias veces por día, el sitio descarga los datos de la API oficial y regenera todas las fichas.</li><li>Los precios que ves en la ficha de un ítem y en el bazar se piden en vivo a la API cuando abrís la página.</li><li>No hay cuentas ni rastreo: lo que guardás (favoritos, tema) queda solo en tu navegador.</li></ul>
<h2>Qué viene</h2>
<p>Recomendaciones de venta, crafteo rentable, historial de precios y planificador de legendarias.</p>
<p>¿Encontraste un error? Escribinos a <a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a>.</p>`, `
<p>Bazaar Ledger is a Guild Wars 2 database made by and for the community: every item in the game, its recipes, the Mystic Forge and the live trading post, in English and Spanish.</p>
<h2>How it works</h2>
<ul><li>Several times a day the site downloads the official API data and rebuilds every item page.</li><li>Prices on item pages and on the trading post are requested live from the API when you open the page.</li><li>No accounts and no tracking: what you save (favorites, theme) stays in your browser.</li></ul>
<h2>Coming next</h2>
<p>Selling recommendations, profitable crafting, price history and a legendary planner.</p>
<p>Found a mistake? Write to <a href="mailto:contact@bazaarledger.com">contact@bazaarledger.com</a>.</p>`);
}

function notFound(lang) {
  return `<section class="empty-state"><h1>${esc(t(lang, 'notfound.title'))}</h1><p class="lead">${esc(t(lang, 'notfound.lead'))}</p><p><a class="btn btn-primary" href="${pagePath(lang, 'home')}">${esc(t(lang, 'notfound.back'))}</a></p></section>`;
}

export function renderStaticPages(meta, { popular = [] } = {}) {
  const out = {};
  for (const lang of LANGS) {
    const base = { lang, meta };
    const P = (page, body, extra = {}) => {
      out[pagePath(lang, page)] = layout({ ...base, page, alternates: alternatesFor(page), title: extra.title ?? t(lang, `nav.${page}`), description: extra.description || t(lang, `${extra.lead || page}`), body, scripts: extra.scripts, styles: extra.styles, jsonLd: extra.jsonLd, noindex: extra.noindex });
    };
    P('events', events(lang), {
      title: '', description: t(lang, 'ev.lead'), scripts: ['events'],
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Bazaar Ledger', url: `${meta.siteUrl}/${lang}/`, inLanguage: lang, potentialAction: { '@type': 'SearchAction', target: `${meta.siteUrl}${pagePath(lang, 'items')}?q={query}`, 'query-input': 'required name=query' } },
    });
    P('items', items(lang, meta, popular), { title: t(lang, 'items.title'), description: t(lang, 'items.lead'), scripts: ['items'] });
    P('bazaar', bazaar(lang), { title: t(lang, 'bazaar.title'), description: t(lang, 'bazaar.lead'), scripts: ['bazaar'] });
    P('achievements', achievements(lang), { title: t(lang, 'ach.title'), description: t(lang, 'ach.lead'), scripts: ['achievements'] });
    P('professions', professions(lang), { title: t(lang, 'prof.title'), description: t(lang, 'prof.lead'), scripts: ['professions'] });
    P('gear', gear(lang), { title: t(lang, 'gear.title'), description: t(lang, 'gear.lead'), scripts: ['gear'] });
    P('vendors', vendors(lang), { title: t(lang, 'vendors.title'), description: t(lang, 'vendors.lead'), scripts: ['vendors'] });
    P('map', map(lang), { title: t(lang, 'map.title'), description: t(lang, 'map.lead'), scripts: ['map'], styles: ['map'] });
    P('calculator', calculator(lang), { title: t(lang, 'calc.title'), description: t(lang, 'calc.lead'), scripts: ['calculator'] });
    P('favorites', favorites(lang), { title: t(lang, 'fav.title'), description: t(lang, 'fav.lead'), scripts: ['home'], noindex: true });
    P('legal', legal(lang, meta), { title: t(lang, 'legal.title'), description: t(lang, 'footerDisclaimer') });
    P('privacy', privacy(lang), { title: t(lang, 'privacy.title'), description: lang === 'es' ? 'Bazaar Ledger no usa cookies ni cuentas de usuario.' : 'Bazaar Ledger uses no cookies and no user accounts.' });
    P('about', about(lang), { title: t(lang, 'about.title'), description: t(lang, 'home.lead') });
    out[`/${lang}/404`] = layout({ ...base, page: '', alternates: { es: '/es/', en: '/en/' }, title: t(lang, 'notfound.title'), description: t(lang, 'notfound.lead'), body: notFound(lang), noindex: true });
  }
  return out;
}
