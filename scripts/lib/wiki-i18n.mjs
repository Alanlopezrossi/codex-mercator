// Turns the wiki data (in English) into Spanish and English using the game's own names:
// items (by English name), currencies, maps/areas, festivals and the most common note patterns.
// Whatever cannot be translated stays in English and is flagged so the page marks it with lang="en".

const SUFFIX = {
  chance: ['probabilidad', 'chance'],
  choice: ['a elección', 'choice'],
  guaranteed: ['garantizado', 'guaranteed'],
  discontinued: ['descatalogado', 'discontinued'],
  historical: ['histórico', 'historical'],
  unimplemented: ['no implementado', 'unimplemented'],
  'in low-level areas': ['en zonas de nivel bajo', 'in low-level areas'],
  'in high-level areas': ['en zonas de nivel alto', 'in high-level areas'],
};

const FESTIVALS = {
  Wintersday: 'Día de Invierno',
  Halloween: 'Halloween',
  'Lunar New Year': 'Año Nuevo Lunar',
  'Dragon Bash': 'Fiesta del Dragón',
  'Super Adventure Festival': 'Festival de Súper Aventura',
  'Festival of the Four Winds': 'Festival de los Cuatro Vientos',
  'Four Winds': 'Cuatro Vientos',
};

const COIN = { 'Gold coin': ['oro', 'gold'], 'Silver coin': ['plata', 'silver'], 'Copper coin': ['cobre', 'copper'] };

export function makeTranslator({ items, currencies = [], places = new Map(), achievements = new Map() }) {
  // English item name -> {id, es}. With duplicates (same name, several IDs) the tradable / most common one wins.
  const itemByEn = new Map();
  for (const it of items.values()) {
    const en = it.n[1];
    if (!en || /^\(\(\d+\)\)$/.test(en)) continue;
    const prev = itemByEn.get(en);
    if (!prev || (!prev.tp && it.tp)) itemByEn.set(en, { id: it.id, es: it.n[0] || en, tp: it.tp });
  }
  const curByEn = new Map(currencies.map((c) => [c.en, c.es]));

  const nameEs = (en) => {
    if (COIN[en]) return COIN[en][0];
    if (curByEn.has(en)) return curByEn.get(en);
    const it = itemByEn.get(en);
    if (it) return it.es;
    if (places.has(en)) return places.get(en);
    return null;
  };

  /** "Bag of Shinies (1-2) (chance)" -> { id?, n: [es, en], s: [suffixEs, suffixEn], ok } */
  function entry(raw) {
    let rest = String(raw).trim();
    const parts = [];
    for (;;) {
      const m = rest.match(/\s*\(([^()]*)\)$/);
      if (!m) break;
      parts.unshift(m[1]);
      rest = rest.slice(0, m.index).trim();
    }
    const it = itemByEn.get(rest);
    const es = it?.es || places.get(rest) || null;
    const suf = parts.map((p) => {
      const tokens = p.split(/,\s*/).map((tk) => {
        if (/^[\d\s–-]+$/.test(tk)) return [tk, tk];
        if (SUFFIX[tk]) return SUFFIX[tk];
        const v = tk.match(/^([A-Z])?([A-Z][a-z]+) (variant|version)$/);
        if (v) return [`variante ${v[2].toLowerCase()}`, tk.replace(/^[A-Z](?=[A-Z])/, '')];
        const y = tk.match(/^(\d+) (variant|version)$/);
        if (y) return [`variante de ${y[1]}`, tk];
        return [tk, tk];
      });
      return [tokens.map((x) => x[0]).join(', '), tokens.map((x) => x[1]).join(', ')];
    });
    return {
      id: it?.id,
      n: [es || rest, rest],
      s: [suf.map((x) => `(${x[0]})`).join(' '), suf.map((x) => `(${x[1]})`).join(' ')],
      ok: !!es,
    };
  }

  /** "10 for 1 Snowflake + 700 Karma" -> ["10 por 1 Copo de nieve + 700 karma", ..., ok] */
  function cost(raw) {
    let ok = true;
    const es = String(raw).split(' + ').map((part) => {
      const m = part.match(/^([\d,.]+(?: for [\d,.]+)?)\s+(.+)$/);
      if (!m) { ok = false; return part; }
      const tr = nameEs(m[2]);
      if (!tr) ok = false;
      return `${m[1].replace(' for ', ' por ')} ${tr || m[2]}`;
    }).join(' + ');
    const en = String(raw).split(' + ').map((part) => {
      const m = part.match(/^([\d,.]+(?: for [\d,.]+)?)\s+(.+)$/);
      return m && COIN[m[2]] ? `${m[1]} ${COIN[m[2]][1]}` : part;
    }).join(' + ');
    return [es, en, ok];
  }

  const SENT = [
    [/^Requires Guild Wars 2: (.+)\.$/, (m) => `Requiere Guild Wars 2: ${m[1]}.`],
    [/^Requires (Heart of Thorns|Path of Fire|End of Dragons)\.$/, (m) => `Requiere ${m[1]}.`],
    [/^Limit (\d+) per week\.$/, (m) => `Límite: ${m[1]} por semana.`],
    [/^Limit (\d+) per day\.$/, (m) => `Límite: ${m[1]} por día.`],
    [/^Limit (\d+) per account\.$/, (m) => `Límite: ${m[1]} por cuenta.`],
    [/^Requires the festival (.+)\.$/, (m) => (FESTIVALS[m[1]] ? `Requiere el festival ${FESTIVALS[m[1]]}.` : null)],
    [/^Requires the achievement "?(.+?)"?( Mastery)?\.$/, (m) => {
      const a = achievements.get(m[1]);
      return a ? `Requiere el logro «${a}»${m[2] ? ' (maestría)' : ''}.` : null;
    }],
    [/^Requires the item (.+)\.$/, (m) => { const e = nameEs(m[1]); return e ? `Requiere el objeto ${e}.` : null; }],
    [/^Requires the skin (.+)\.$/, (m) => { const e = nameEs(m[1]); return e ? `Requiere la apariencia ${e}.` : null; }],
    [/^Requires the mastery (.+)\.$/, (m) => `Requiere la maestría ${m[1]}.`],
    [/^Requires completing the story step (.+)\.$/, (m) => `Requiere completar el paso de historia ${m[1]}.`],
  ];

  /** Notes: translates sentence by sentence; returns [es, en, ok]. */
  function note(raw) {
    const s = String(raw || '').trim();
    if (!s || s === '-') return ['', '', true];
    let ok = true;
    const sentences = s.match(/[^.]+(?:\.|$)/g) || [s];
    const es = sentences.map((x) => {
      const t = x.trim();
      for (const [re, fn] of SENT) {
        const m = t.match(re);
        if (m) { const r = fn(m); if (r) return r; }
      }
      if (/^\d+$/.test(t)) return t;
      ok = false;
      return t;
    }).join(' ');
    return [es, s, ok];
  }

  function vendor(raw) {
    const v = String(raw || '');
    const m = v.match(/^(.*) \(vendor currently unavailable\)$/);
    return m ? [`${m[1]} (vendedor no disponible por ahora)`, `${m[1]} (vendor currently unavailable)`] : [v, v];
  }

  const place = (en) => (en ? [places.get(en) || en, en] : ['', '']);

  return { entry, cost, note, vendor, place, itemByEn };
}
