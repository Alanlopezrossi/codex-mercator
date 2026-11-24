// Downloads the event timer from the official Guild Wars 2 Wiki on every build, so the Events page follows the wiki:
//   - Widget:Event_timer/data.json → schedules, segment names, waypoints and colors.
//   - Event_timers (the wiki's own timer page) → which festivals are switched off right now: the wiki hides finished
//     festivals with {{Event timer|exclude=festival-ha,...}}, and we hide exactly the same ones.
// Output: .cache/raw/event-timers.json (same format as data/event-timers.json, plus "off").
// If the wiki cannot be reached or returns something odd, nothing is written and the build uses data/event-timers.json.
import fs from 'node:fs';
import path from 'node:path';

const WIKI = 'https://wiki.guildwars2.com/index.php';
const OUT = path.resolve('.cache/raw/event-timers.json');
const PREV = path.resolve('data/event-timers.json');
const UA = 'BazaarLedger/1.0 (+https://bazaarledger.net; build script)';

async function raw(title) {
  const r = await fetch(`${WIKI}?title=${encodeURIComponent(title)}&action=raw`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${title}: HTTP ${r.status}`);
  return r.text();
}

// Wiki format → repo format. Keeps, per segment, the extra fields the repo adds (map position, etc.), matched by index
// and name, so a renamed or moved segment never inherits the wrong position.
export function convert(wiki, prev) {
  const events = {};
  for (const [key, e] of Object.entries(wiki.events || {})) {
    if (!e || !e.segments || !e.sequences || !e.name) continue; // "t" is the wiki's empty tick row
    const old = prev?.events?.[key];
    const s = {};
    for (const [i, g] of Object.entries(e.segments)) {
      const name = g.name || '';
      const o = old ? (old.s[i]?.[0] === name ? old.s[i] : Object.values(old.s).find((x) => name && x[0] === name)) : null;
      const row = [name, g.link || '', String(g.chatlink || '').trim(), g.bg];
      if (o && o.length > 4) for (let j = 4; j < o.length; j++) row[j] = o[j];
      s[i] = row;
    }
    events[key] = {
      c: e.category || '',
      n: e.name,
      l: e.link || '',
      s,
      p: (e.sequences.partial || []).map((x) => [x.r, x.d]),
      q: (e.sequences.pattern || []).map((x) => [x.r, x.d]),
    };
  }
  return events;
}

// {{Event timer|exclude=festival-lc,festival-ha}} → ['festival-lc', 'festival-ha']
export function excludedFrom(pageText) {
  const call = String(pageText).match(/\{\{\s*Event timer\s*\|([^}]*)\}\}/i);
  if (!call) return [];
  const ex = call[1].split('|').map((p) => p.split('=')).find(([k]) => k.trim().toLowerCase() === 'exclude');
  return ex ? ex.slice(1).join('=').split(',').map((x) => x.trim()).filter(Boolean) : [];
}

async function main() {
  try {
    const prev = fs.existsSync(PREV) ? JSON.parse(fs.readFileSync(PREV, 'utf8')) : null;
    const [dataText, pageText] = await Promise.all([raw('Widget:Event timer/data.json'), raw('Event timers')]);
    const wiki = JSON.parse(dataText);
    const events = convert(wiki, prev);
    const n = Object.keys(events).length;
    const broken = Object.entries(events).filter(([, e]) => !e.q.length && !e.p.length).map(([k]) => k);
    if (n < 30 || broken.length) throw new Error(`unexpected data (${n} events, without schedule: ${broken.join(', ') || '—'})`);
    const off = excludedFrom(pageText).filter((k) => events[k]);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
      source: 'Guild Wars 2 Wiki — Widget:Event timer/data.json + Event timers',
      at: new Date().toISOString().slice(0, 10),
      v: wiki.config?.version || '',
      off,
      events,
    }));
    console.log(`[wiki-events] ${n} events from the wiki (${wiki.config?.version || '?'}); switched off by the wiki: ${off.join(', ') || 'none'}`);
  } catch (e) {
    console.warn(`[wiki-events] could not update from the wiki (${e.message}); using data/event-timers.json`);
    if (fs.existsSync(OUT)) fs.rmSync(OUT);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
