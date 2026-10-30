// HTML for an item page. Rendered by the Worker from the data shard; the browser then adds the live price.
import { esc, coin, coinText, iconUrl, num } from './format.js';
import { LANGS, pagePath, t, tr, itemPath, SHOWN_FLAGS } from './i18n.js';
import { ICONS } from './layout.js';

const L = (lang) => LANGS.indexOf(lang);

// Item link: icon, then a text column (name and an optional second line), then the quantity.
function refLink(lang, id, ref, count, sub = '') {
  const li = L(lang);
  const name = ref ? ref[li] || ref[1 - li] : `#${id}`;
  const img = ref?.[3] ? `<img src="${esc(iconUrl(ref[3]))}" alt="" width="32" height="32" loading="lazy" class="ic r-${esc(ref[2])}">` : '<span class="ic ic-ph" aria-hidden="true"></span>';
  return `<a class="ref" href="${itemPath(lang, id, name)}">${img}<span class="ref-body"><span class="ref-name r-txt-${esc(ref?.[2] || 'Basic')}">${esc(name)}</span>${sub ? `<span class="ref-sub">${esc(sub)}</span>` : ''}</span>${count ? `<span class="ref-count">×${num(count, lang)}</span>` : ''}</a>`;
}

function textBlock(s) {
  return esc(s).replace(/\n/g, '<br>');
}

export function itemTitle(lang, it) {
  const li = L(lang);
  return it.n[li] || it.n[1 - li] || `${t(lang, 'item.unknownItem')} ${it.id}`;
}

export function itemDescription(lang, it) {
  const name = itemTitle(lang, it);
  const kind = [tr.rarity(lang, it.r), tr.type(lang, it.t).toLowerCase()].filter(Boolean).join(' ');
  const lvl = it.l ? (lang === 'es' ? ` de nivel ${it.l}` : ` level ${it.l}`) : '';
  const parts = lang === 'es'
    ? [`${name}: ${kind}${lvl} de Guild Wars 2.`, it.tp ? 'Precio en vivo en el bazar.' : '', it.rc?.length ? 'Receta e ingredientes.' : '', it.w?.forge ? 'Receta de la Forja Mística.' : '', 'Cómo conseguirlo y para qué sirve.']
    : [`${name}: ${kind}${lvl} in Guild Wars 2.`, it.tp ? 'Live trading post price.' : '', it.rc?.length ? 'Recipe and ingredients.' : '', it.w?.forge ? 'Mystic Forge recipe.' : '', 'How to get it and what it is used for.'];
  return parts.filter(Boolean).join(' ').slice(0, 300);
}

function detailsList(lang, it) {
  const li = L(lang);
  const x = it.x || {};
  const rows = [];
  if (x.def) rows.push([t(lang, 'item.defense'), num(x.def, lang)]);
  if (x.pw) rows.push([t(lang, 'item.power'), `${num(x.pw[0], lang)}–${num(x.pw[1], lang)}`]);
  if (x.w) rows.push([t(lang, 'item.weight'), esc(tr.weight(lang, x.w))]);
  if (x.inf) rows.push([t(lang, 'item.slots'), `${x.inf} ${lang === 'es' ? 'de infusión' : 'infusion'}`]);
  if (x.size) rows.push([lang === 'es' ? 'Espacios de bolsa' : 'Bag slots', num(x.size, lang)]);
  if (x.dur) rows.push([t(lang, 'item.duration'), `${Math.round(x.dur / 60000)} min`]);
  if (x.ch) rows.push([lang === 'es' ? 'Cargas' : 'Charges', num(x.ch, lang)]);
  let html = '';
  if (x.at?.length) {
    html += `<h3 class="h-sub">${esc(t(lang, 'item.stats'))}</h3><ul class="stat-list">${x.at.map(([a, m]) => `<li><span class="stat-v">+${num(m, lang)}</span> ${esc(tr.attr(lang, a))}</li>`).join('')}</ul>`;
  }
  const buff = x.buff?.[li] || x.buff?.[1 - li];
  if (buff) html += `<p class="effect">${textBlock(buff)}</p>`;
  const bon = x.bon?.[li]?.length ? x.bon[li] : x.bon?.[1 - li];
  if (bon?.length) html += `<h3 class="h-sub">${esc(t(lang, 'item.bonuses'))}</h3><ol class="bonus-list">${bon.map((b) => `<li>${textBlock(b)}</li>`).join('')}</ol>`;
  const eff = x.eff?.[li] || x.eff?.[1 - li];
  if (eff) html += `<p class="effect">${textBlock(eff)}</p>`;
  if (rows.length) html += `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (x.sfx && it.refs?.[x.sfx]) html += `<p class="small">${lang === 'es' ? 'Mejora incluida' : 'Built-in upgrade'}: ${refLink(lang, x.sfx, it.refs[x.sfx])}</p>`;
  const flags = (it.f || []).filter((f) => SHOWN_FLAGS.includes(f));
  if (flags.length) html += `<ul class="tags" aria-label="${esc(t(lang, 'item.flags'))}">${flags.map((f) => `<li class="tag">${esc(tr.flag(lang, f))}</li>`).join('')}</ul>`;
  if (it.g?.length) html += `<p class="small muted">${it.g.map((g) => esc(g === 'Pve' ? 'PvE' : g === 'Pvp' ? 'PvP' : g === 'Wvw' ? (lang === 'es' ? 'McM' : 'WvW') : g)).filter((g) => !/Lobby|Activity|Dungeon/.test(g)).join(' · ')}</p>`;
  return html;
}

function recipesHtml(lang, it) {
  if (!it.rc?.length) return '';
  const head = it.rc.length > 1 ? t(lang, 'item.recipesOther') : t(lang, 'item.recipes');
  const blocks = it.rc.map((r) => `<div class="recipe card-inner" data-recipe="${r.id}">
    <p class="recipe-meta">${r.d.length ? r.d.map((d) => `<span class="tag">${esc(tr.discipline(lang, d))}</span>`).join(' ') : ''} <span class="muted">${esc(t(lang, 'item.rating'))} ${r.m}</span>${r.q > 1 ? ` · ${esc(t(lang, 'item.makes'))} ×${r.q}` : ''} · <span class="muted small">${esc(t(lang, r.lf ? 'item.learned' : 'item.autoLearned'))}</span></p>
    <ul class="ref-list">${r.i.map(([id, n]) => `<li data-ing="${id}" data-count="${n}">${refLink(lang, id, it.refs?.[id], n)}</li>`).join('')}</ul>
    <p class="recipe-cost small muted" data-cost-for="${r.id}" data-out="${r.q}"></p>
  </div>`).join('');
  return `<section class="card" aria-labelledby="rec-h"><h2 id="rec-h">${esc(head)}</h2>${blocks}</section>`;
}

function forgeHtml(lang, it) {
  const f = it.w?.forge;
  if (!f?.length) return '';
  const blocks = f.map((r) => `<div class="recipe card-inner"><p class="recipe-meta"><span class="tag tag-forge">${esc(t(lang, 'item.forge'))}</span>${r.q > 1 ? ` · ${esc(t(lang, 'item.makes'))} ×${r.q}` : ''}</p>
    <ul class="ref-list">${r.i.map(([id, n, title]) => `<li>${id ? refLink(lang, id, it.refs?.[id], n) : `<span class="ref"><span class="ic ic-ph" aria-hidden="true"></span><span class="ref-name"${lang === 'es' ? ' lang="en"' : ''}>${esc(title)}</span><span class="ref-count">×${num(n, lang)}</span></span>`}</li>`).join('')}</ul></div>`).join('');
  return `<section class="card" aria-labelledby="forge-h"><h2 id="forge-h">${esc(t(lang, 'item.forge'))}</h2>${blocks}${wikiCredit(lang, it)}</section>`;
}

function wikiCredit(lang, it) {
  const title = it.w?.title || it.n[1];
  const url = `https://wiki.guildwars2.com/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
  return `<p class="credit small muted">${esc(t(lang, 'item.wikiNote'))} <a href="${esc(url)}" rel="noopener">${esc(t(lang, 'item.wikiSource'))}</a> · <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" rel="noopener license">GFDL 1.2</a></p>`;
}

function acquisitionHtml(lang, it) {
  const w = it.w;
  // The wiki sometimes lists the item inside its own containers: those entries are dropped.
  const cont = (w?.cont || []).filter((e) => e.id !== it.id);
  const gath = (w?.gath || []).filter((e) => e.id !== it.id);
  if (!w || (!w.sold?.length && !cont.length && !gath.length)) return '';
  const li = L(lang);
  const isEs = lang === 'es';
  let html = '';
  if (w.sold?.length) {
    const head = isEs ? ['Vendedor', 'Zona', 'Costo', 'Notas'] : ['Vendor', 'Area', 'Cost', 'Notes'];
    const rows = w.sold.map((r) => {
      // Rows whose cost or note could not be translated keep the English text, marked as such.
      const raw = isEs && r.en ? ' lang="en"' : '';
      const where = [r.a?.[li], r.z?.[li]].filter(Boolean).join(', ');
      return `<tr><td class="left">${esc(r.v[li])}</td><td class="left">${esc(where)}</td><td class="left"${raw}>${esc(r.c[li])}</td><td class="left small muted"${raw}>${esc(r.n[li])}</td></tr>`;
    }).join('');
    html += `<h3 class="h-sub">${esc(t(lang, 'item.soldBy'))}</h3><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t(lang, 'item.soldBy'))}"><table class="data-table compact"><thead><tr>${head.map((h) => `<th scope="col" class="left">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const entries = (list) => `<ul class="ref-grid">${list.map((e) => {
    const name = e.n[li] || e.n[1];
    const sub = (e.s?.[li] || '').replace(/^\((.*)\)$/, '$1').replace(/\) \(/g, ' · ');
    if (e.id && e.id !== it.id && it.refs?.[e.id]) return `<li>${refLink(lang, e.id, it.refs[e.id], 0, sub)}</li>`;
    return `<li><span class="ref"><span class="ic ic-ph" aria-hidden="true"></span><span class="ref-body"><span class="ref-name"${isEs && !e.ok ? ' lang="en"' : ''}>${esc(name)}</span>${sub ? `<span class="ref-sub">${esc(sub)}</span>` : ''}</span></span></li>`;
  }).join('')}</ul>`;
  if (cont.length) html += `<h3 class="h-sub">${esc(t(lang, 'item.containedIn'))}</h3>${entries(cont)}`;
  if (gath.length) html += `<h3 class="h-sub">${esc(t(lang, 'item.gathered'))}</h3>${entries(gath)}`;
  return `<section class="card" aria-labelledby="acq-h"><h2 id="acq-h">${esc(t(lang, 'item.acquisition'))}</h2>${html}${wikiCredit(lang, it)}</section>`;
}

function achHtml(lang, it) {
  if (!it.ach?.length) return '';
  const li = L(lang);
  const kind = (k) => (k === 'r' ? (lang === 'es' ? 'recompensa' : 'reward') : (lang === 'es' ? 'parte de la colección' : 'collection part'));
  return `<section class="card" aria-labelledby="ach-h"><h2 id="ach-h">${esc(t(lang, 'item.rewardedBy'))}</h2><ul class="plain-list">${it.ach.map(([, es, en, k]) => `<li><strong>${esc(li === 0 ? es : en)}</strong> <span class="small muted">· ${esc(kind(k))}</span></li>`).join('')}</ul><p class="small"><a href="${pagePath(lang, 'achievements')}">${esc(t(lang, 'nav.achievements'))} →</a></p></section>`;
}

function usedInHtml(lang, it) {
  if (!it.u?.length) return '';
  const more = it.uc > it.u.length ? `<p class="small muted">${lang === 'es' ? `y ${num(it.uc - it.u.length, lang)} más` : `and ${num(it.uc - it.u.length, lang)} more`}</p>` : '';
  const li = (id) => `<li>${refLink(lang, id, it.refs?.[id])}</li>`;
  const first = it.u.slice(0, 12).map(li).join('');
  const rest = it.u.slice(12);
  const restHtml = rest.length ? `<details class="more"><summary>${lang === 'es' ? `Ver ${rest.length} más` : `Show ${rest.length} more`}</summary><ul class="ref-grid">${rest.map(li).join('')}</ul>${more}</details>` : more;
  return `<section class="card" aria-labelledby="used-h"><h2 id="used-h">${esc(t(lang, 'item.usedIn'))} <span class="count">${num(it.uc || it.u.length, lang)}</span></h2><ul class="ref-grid">${first}</ul>${restHtml}</section>`;
}

function priceHtml(lang, it) {
  const vendor = it.v && !(it.f || []).includes('NoSell') ? `<p class="small">${esc(t(lang, 'item.vendor'))}: ${coin(it.v, { lang })}</p>` : '';
  if (!it.tp) {
    return `<section class="card price-card" aria-labelledby="price-h"><h2 id="price-h">${esc(t(lang, 'item.price'))}</h2><p class="muted">${esc(t(lang, 'item.notTradable'))}</p>${vendor}</section>`;
  }
  const cell = (k, label) => `<div><dt>${esc(label)}</dt><dd data-p="${k}"><span class="skel" aria-hidden="true"></span><span class="sr-only">${esc(t(lang, 'loading'))}</span></dd></div>`;
  return `<section class="card price-card" id="price" data-id="${it.id}" aria-labelledby="price-h">
    <h2 id="price-h">${esc(t(lang, 'item.price'))} <span class="live-dot" title="${esc(t(lang, 'bazaar.live'))}" aria-hidden="true"></span></h2>
    <dl class="price-grid">${cell('sell', t(lang, 'item.sell'))}${cell('buy', t(lang, 'item.buy'))}${cell('supply', t(lang, 'item.supply'))}${cell('demand', t(lang, 'item.demand'))}</dl>
    <p class="small" data-p="net"></p>
    <p class="small muted" data-p="stamp" aria-live="polite">${esc(t(lang, 'item.liveNote'))}</p>
    ${vendor}
  </section>`;
}

export function renderItemBody(lang, it) {
  const li = L(lang);
  const name = itemTitle(lang, it);
  const otherName = it.n[1 - li] && it.n[1 - li] !== name ? it.n[1 - li] : '';
  const sub = it.st && it.st !== it.t ? tr.sub(lang, it.st) : '';
  const icon = it.ic ? `<img class="item-icon r-${esc(it.r)}" src="${esc(iconUrl(it.ic))}" alt="" width="64" height="64">` : '<span class="item-icon ic-ph" aria-hidden="true"></span>';
  const desc = it.d[li] || it.d[1 - li];
  const links = [
    [`https://wiki.guildwars2.com/wiki/Special:Search/${encodeURIComponent(it.n[1] || name)}`, 'Guild Wars 2 Wiki'],
    [`https://www.gw2bltc.com/${lang === 'es' ? 'es' : 'en'}/item/${it.id}`, 'GW2BLTC'],
    [`https://${lang === 'es' ? 'es' : 'en'}.gw2treasures.com/item/${it.id}`, 'gw2treasures'],
  ];
  return `
<nav class="crumbs" aria-label="${lang === 'es' ? 'Ruta' : 'Breadcrumb'}"><ol>
  <li><a href="${pagePath(lang, 'home')}">${esc(t(lang, 'nav.home'))}</a></li>
  <li><a href="${pagePath(lang, 'items')}">${esc(t(lang, 'nav.items'))}</a></li>
  <li><a href="${pagePath(lang, 'items')}?type=${encodeURIComponent(it.t)}">${esc(tr.type(lang, it.t))}</a></li>
  <li><span aria-current="page">${esc(name)}</span></li>
</ol></nav>
<article class="item" data-item="${it.id}" data-name="${esc(name)}" data-name-es="${esc(it.n[0])}" data-name-en="${esc(it.n[1])}" data-icon="${esc(it.ic)}" data-rarity="${esc(it.r)}">
  <header class="item-head card">
    ${icon}
    <div class="item-title">
      <h1 class="r-txt-${esc(it.r)}">${esc(name)}</h1>
      ${otherName ? `<p class="alt-name muted" lang="${LANGS[1 - li]}">${esc(otherName)}</p>` : ''}
      <p class="item-meta"><span class="tag r-tag-${esc(it.r)}">${esc(tr.rarity(lang, it.r))}</span> <span>${esc(tr.type(lang, it.t))}${sub ? ` · ${esc(sub)}` : ''}</span>${it.l ? ` <span>· ${esc(t(lang, 'level'))} ${it.l}</span>` : ''} <span class="muted small">· ID ${it.id}</span></p>
    </div>
    <div class="item-actions">
      ${it.c ? `<button type="button" class="btn btn-small copy-btn" data-copy="${esc(it.c)}" aria-label="${esc(t(lang, 'copy'))} ${esc(t(lang, 'item.chat'))} ${esc(it.c)}"><code>${esc(it.c)}</code></button>` : ''}
      <button type="button" class="btn btn-small fav-btn js-only" id="favBtn" aria-pressed="false" data-on="${esc(t(lang, 'item.unfavorite'))}" data-off="${esc(t(lang, 'item.favorite'))}">${ICONS.star}<span>${esc(t(lang, 'item.favorite'))}</span></button>
    </div>
  </header>
  <div class="item-grid">
    ${priceHtml(lang, it)}
    <section class="card" aria-labelledby="det-h"><h2 id="det-h">${esc(t(lang, 'item.details'))}</h2>
      ${desc ? `<p class="desc">${textBlock(desc)}</p>` : ''}
      ${detailsList(lang, it)}
    </section>
  </div>
  ${recipesHtml(lang, it)}
  ${forgeHtml(lang, it)}
  ${acquisitionHtml(lang, it)}
  ${achHtml(lang, it)}
  ${usedInHtml(lang, it)}
  <section class="card" aria-labelledby="links-h"><h2 id="links-h">${esc(t(lang, 'item.links'))}</h2>
    <ul class="link-list">${links.map(([u, l]) => `<li><a href="${esc(u)}" rel="noopener nofollow">${esc(l)}</a></li>`).join('')}</ul>
  </section>
</article>`;
}

export function itemJsonLd(lang, it, siteUrl) {
  const name = itemTitle(lang, it);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t(lang, 'nav.home'), item: `${siteUrl}${pagePath(lang, 'home')}` },
      { '@type': 'ListItem', position: 2, name: t(lang, 'nav.items'), item: `${siteUrl}${pagePath(lang, 'items')}` },
      { '@type': 'ListItem', position: 3, name, item: `${siteUrl}${itemPath(lang, it.id, name)}` },
    ],
  };
}

export { coinText };
