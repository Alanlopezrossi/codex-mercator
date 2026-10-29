# Codex Mercator

**Codex Mercator** is an unofficial Guild Wars 2 fan site, in Spanish and English: the full item database (about 74,000 items), recipes, Mystic Forge, acquisition info, a live trading post, achievements, professions, events, a map of Tyria and a calculator. It runs entirely on **Cloudflare Workers (free plan)**.

> Unofficial fan site. Not affiliated with ArenaNet or NCSOFT. See [Legal](#legal).

## What it has

| Section | Data | Where it comes from |
|---|---|---|
| Items (`/es/items`, `/en/items`) | Search by Spanish or English name, ID or chat code; filters by type, rarity, level and tradable | Index generated at build time |
| Item page (`/es/item/19721-...`) | Live price, recipes with ingredient cost, Mystic Forge, how to get it, what it is used for, stats | Rendered by the Worker from the data; price live from the API |
| Trading post (`/es/bazar`, `/en/trading-post`) | 28,000 prices, sortable and filterable; visible rows refresh every minute | Build snapshot + live API |
| Achievements, Professions | By category, with rewards / specializations and traits | Official API, live from the browser |
| Events | World bosses and metas in local time, copyable waypoint | Wiki timer (versioned in `data/`) |
| Map | Official tiles + every waypoint | API (`/v2/continents`) |
| Calculator | Coins and trading post fees | — |
| Favorites | Stored in the browser only | — |
| Legal, Privacy, About | Notices required by ArenaNet, licenses, no cookies | — |

## Architecture

```
Cloudflare Workers (free)
├── Static Assets (dist/)            ← static pages, JS/CSS, data in JSON/TSV
│   ├── /es/*, /en/*                 ← 26 HTML pages
│   ├── /assets/<hash>/              ← bundles (cached for 1 year, immutable)
│   └── /data/<version>/items/*.json ← 74k items in 3,000 shards (32 IDs each)
└── Worker (src/worker/index.js)     ← item pages, language redirect, 404, security headers
    └── Cron every 6 h → deploy hook → new build with fresh data
```

- **No servers, no database, no cookies.** Live prices go from the user's browser to the official API (which allows CORS).
- **Build** (`scripts/build.mjs`): downloads the API (~950 requests, ~3 min, under the API rate limit), **validates** the totals (if something comes back incomplete the build fails and the previous version stays online) and generates everything.
- **Item SEO**: real URLs per language with `hreflang`, canonical, JSON-LD, Open Graph and a sitemap of ~148,000 URLs.
- **Free plan limits** it stays within: 20,000 files per version (it uses ~3,100), 25 MiB per file, 10 ms of CPU per request (each item page parses one ~50 KB shard), 100,000 Worker requests per day (only item pages count, everything static is free), 3,000 build minutes per month (it uses ~600).

## Security

- Strict CSP: only scripts and styles from the site itself; connections only to `api.guildwars2.com`; images only from ArenaNet's official servers. No inline scripts.
- HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- The Worker only accepts `GET`/`HEAD`; IDs are validated with a regex; every piece of data that reaches HTML goes through `esc()`.
- No API keys, accounts or forms: there is nothing sensitive to store. The only secret is `DEPLOY_HOOK_URL`.
- The e2e test checks the headers and that the CSP blocks inline scripts.

## Accessibility and performance

- WCAG 2.1 AA: skip link, landmarks, visible focus, combobox/tabs/sorting with ARIA, contrast checked with axe in both themes, `prefers-reduced-motion`.
- Mobile-first, no horizontal scroll at 390 px. Dark theme by default, light theme optional.
- Static HTML, ~25 KB of CSS, small JS per page; the search index (~1 MB compressed) only downloads when you search and is cached by hash.

## Development

Requirements: Node 20+.

```bash
npm install
npm run build          # downloads the official API data and generates dist/ (~3 min)
npm run dev            # http://localhost:8787
npm test               # unit tests
npm run test:e2e       # with dev running: Playwright + axe + screenshots in tests/e2e/screenshots
```

On Windows: double-click **`ver-local.bat`**.

To build without internet from a snapshot of the old `gw2-bazar` project:
`SNAPSHOT_DIR=../gw2-bazar npm run build:snapshot`.

## Deploy

Step by step in **[docs/DEPLOY.md](docs/DEPLOY.md)** (Cloudflare connected to GitHub, automatic builds, domain and cron).

## Legal

- Unofficial fan site; the notice appears in the footer, in the title of every page ("fansite") and on `/es/legal`.
- ArenaNet/NCSOFT copyright and trademark notice on every page, as their Content Terms of Use require.
- Nothing behind a paywall or a sign-up. If ads are added, they must be non-intrusive.
- Content from the Guild Wars 2 Wiki (Mystic Forge, vendors, timers) under **GNU FDL 1.2**, with attribution and a link to the original page. See `data/README.md`.
- Icons and tiles are loaded from ArenaNet's servers without modification. No wiki images or third-party scraping are used (gw2treasures, GW2BLTC and the wiki are links only).
- Code under the MIT license (it does not cover game content).

## Roadmap

1. Cloudflare Web Analytics (cookie-free) + donations (Ko-fi/Cafecito).
2. Recommendations, flipping and profitable crafting (reusing `analysis.js` from gw2-bazar).
3. Price history (Workers KV or a separate cron).
4. Legendary planner, skins, minis and mounts.
