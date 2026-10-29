# Deploying to Cloudflare (free plan)

Total time: ~20 minutes. Cost: USD 0 (the domain is optional, ~USD 10/year).

## 1. GitHub repository

```bash
cd codex-mercator
git remote add origin https://github.com/cuentamir4plus-bit/codex-mercator.git
git push -u origin main
```

(First create the empty repository on github.com, without a README.)

## 2. Create the Worker connected to the repo

1. Go to **dash.cloudflare.com → Workers & Pages → Create → Import a repository**.
2. Pick `codex-mercator`. Configure:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
3. Under **Build variables** add:
   - `SITE_URL` = `https://codexmercator.com` (or the `*.workers.dev` URL while you have no domain)
   - `CONTACT_EMAIL` = the email for takedown requests and contact
4. **Deploy.** The first build takes ~4 minutes (it downloads the whole API).

From then on, every `git push` to `main` deploys on its own.

## 3. Automatic data refresh (every 6 hours)

1. In the Worker: **Settings → Build → Deploy Hooks → Create**, branch `main`. Copy the URL.
2. Save it as a secret:
   ```bash
   npx wrangler secret put DEPLOY_HOOK_URL
   ```
   (or in **Settings → Variables and Secrets → Add → Secret**).
3. The cron in `wrangler.jsonc` (`17 */6 * * *`) calls that hook: new build, fresh data. Item prices and visible trading post rows are already live; the cron refreshes the rest (new items, the trading post snapshot).

If a build fails validation (the API came back incomplete), it does not deploy: the previous version stays online.

## 4. Custom domain (recommended for SEO)

1. Buy the domain (in Cloudflare Registrar it costs what the registry charges, no markup). Avoid names with "guildwars" or "gw2" (ArenaNet trademarks).
2. In the Worker: **Settings → Domains & Routes → Add → Custom domain**.
3. Update `SITE_URL` and redeploy.
4. In **Google Search Console**, add the domain and submit `https://your-domain/sitemap.xml`.

## 5. Recommended Cloudflare settings (all free)

- **Security → Settings:** Bot Fight Mode on.
- **SSL/TLS:** "Full (strict)" mode, "Always Use HTTPS" on.
- **Web Analytics** (optional, cookie-free): turn it on from the dashboard for the domain (automatic injection). It does not need cookies or a banner. If you turn it on, add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in `src/shared/security.js`, and update the privacy page.

## 6. Checks after deploying

```bash
curl -I https://your-domain/es/                  # 200 + security headers
curl -I https://your-domain/es/item/19721        # 301 to the URL with the slug
curl -I https://your-domain/                     # 302 to /es/ or /en/ based on the browser
```

And with the site running locally: `npm run test:e2e`.

## Limits it stays within

| Free plan limit | Usage |
|---|---|
| 100,000 Worker requests/day | Only item pages (static files do not count) |
| 10 ms of CPU per request | One ~50 KB shard parsed per item page (with cache) |
| 20,000 files per version | ~3,100 |
| 25 MiB per file | The largest is ~5 MB (search index) |
| 3,000 build minutes/month | ~4 min × 4 per day × 30 = ~480 |

If one day it goes past 100k item visits per day, the Workers Paid plan (USD 5/month) raises everything to 10 million.
