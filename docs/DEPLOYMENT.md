# Arsa — Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▶│  Cloudflare      │────▶│   Supabase      │
│   (PWA)      │     │  Pages           │     │   PostgreSQL    │
│              │     │  (SvelteKit SSR) │     │   + Auth        │
└─────────────┘     └──────┬───────────┘     └─────────────────┘
                           │
                    ┌──────┴───────────┐
                    │                  │
              ┌─────▼─────┐    ┌──────▼──────┐
              │ R2 Storage │    │ Workers AI  │
              │ (receipts) │    │ (OCR)       │
              └────────────┘    └─────────────┘

              ┌─────────────────┐    ┌─────────────┐
              │ Rust/Wasm Worker│    │ Resend API  │
              │ (market scraper)│    │ (email)     │
              │ Cron: 09:00,   │    │ Cron: 1st   │
              │ 13:00 WIB      │    │ of month    │
              └─────────────────┘    └─────────────┘
```

**Current state:** All services are implemented through Phase 7. Cloudflare Pages (SvelteKit), Supabase (DB + Auth), R2 (receipts), Workers AI (OCR), Rust Worker (market scraper), TypeScript Worker (monthly reports), Resend (email), PWA with offline support, push notifications, and CI/CD via GitHub Actions are all active.

## Manual Deployment

### 1. Build

```bash
cd arsa-app
npm run build
```

This produces `.svelte-kit/cloudflare/` with the worker and static assets.

### 2. Deploy to Cloudflare Pages

**First time — create the project:**

```bash
wrangler pages project create arsa-app
```

**Deploy:**

```bash
wrangler pages deploy .svelte-kit/cloudflare
```

The CLI will output your production URL (e.g., `https://arsa-app.pages.dev`).

### 3. Verify

- Open the production URL.
- Confirm the login page loads.
- Test login/register flow against your Supabase project.

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: arsa-app/package-lock.json

      - name: Install dependencies
        working-directory: arsa-app
        run: npm ci

      - name: Build
        working-directory: arsa-app
        run: npm run build
        env:
          PUBLIC_SUPABASE_URL: ${{ secrets.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PUBLIC_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: arsa-app
          command: pages deploy .svelte-kit/cloudflare --project-name=arsa-app
```

### GitHub Secrets Required

Set these in your repo → Settings → Secrets and variables → Actions:

| Secret | Where to find it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create Token (use "Edit Cloudflare Workers" template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → any domain → Overview → right sidebar |
| `PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Project API Keys → `anon` `public` |
| `PUBLIC_VAPID_PUBLIC_KEY` | Generated via `npx web-push generate-vapid-keys` (public key) |

### Preview Deployments

Every push to a non-`main` branch automatically creates a preview deployment at `https://<hash>.arsa-app.pages.dev`. No additional configuration needed — Cloudflare Pages does this by default.

## Environment Variables (Production)

Set in Cloudflare Pages → your project → Settings → Environment Variables:

| Variable | Scope | Description |
|----------|-------|-------------|
| `PUBLIC_SUPABASE_URL` | Production + Preview | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Server-side only |
| `R2_ACCOUNT_ID` | Production + Preview | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | Production + Preview | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Production + Preview | R2 secret key |
| `R2_BUCKET_NAME` | Production + Preview | R2 bucket name (`arsa-receipts`) |
| `CLOUDFLARE_AI_TOKEN` | Production + Preview | Workers AI token for OCR |
| `PUBLIC_VAPID_PUBLIC_KEY` | Production + Preview | VAPID public key for push notifications |

**Important:** Use separate Supabase projects for production and preview if you want data isolation. Otherwise, preview deployments will share the production database.

## Supabase Production Setup

### New Production Project

1. Create a new Supabase project for production (or reuse your dev project for MVP).
2. Run all migrations from `supabase/migrations/` in order (001 → 002 → 003 → 004 → 006 → 007 → 008 → 009) via SQL Editor.
3. Verify RLS is enabled on all tables: Database → Tables → check "RLS Enabled" column.

### Auth Configuration

1. Authentication → URL Configuration:
   - **Site URL:** `https://arsa-app.pages.dev` (or your custom domain)
   - **Redirect URLs:** add `https://arsa-app.pages.dev/**`
2. Authentication → Providers: verify Email/Password is enabled.
3. Authentication → Email Templates: customize if desired (reset password, confirm email).

### RLS Verification

Run in SQL Editor to confirm all family-scoped tables have RLS:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables except `market_rates` should show `rowsecurity = true`. (`market_rates` also has RLS but with a public read policy.)

## Cloudflare R2 (Receipts)

### Bucket Setup

1. R2 → Create Bucket → name: `arsa-receipts`.
2. Configure CORS by running the setup script locally (requires `.env` with R2 credentials):
   ```bash
   node scripts/setup-r2-cors.mjs
   ```
   This sets `AllowedOrigins: ['*']`, `AllowedMethods: ['PUT', 'GET']`.
3. Set R2 env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) in Cloudflare Pages settings.

### How It Works

- Receipt uploads use presigned PUT URLs generated server-side (`/api/receipts/presign`).
- Images are compressed client-side via Canvas API (~150KB) before upload.
- R2 client uses `$env/dynamic/private` with lazy initialization (`getR2()`) so builds succeed without R2 credentials.

## Cloudflare Workers AI — OCR

### Setup

1. In Cloudflare Dashboard → Workers AI → Models, accept the **Meta Llama 3.2 11B Vision Instruct** model license.
2. Get your AI API token: Workers AI → Overview → Use REST API → Get API Token.
3. Set `CLOUDFLARE_AI_TOKEN` in Cloudflare Pages env vars (or `.env` for local dev).

### How It Works

- SvelteKit endpoint `/api/ocr` fetches receipt from R2, sends to Workers AI REST API.
- Model extracts `{ nominal, tanggal, merchant }` as JSON.
- Results auto-fill the transaction form; user must review before saving (human-in-the-loop).

## Cloudflare Workers — Market Scraper

### Deployment

```bash
cd workers/market-scraper
cargo install worker-build   # one-time
wrangler deploy
```

### Cron Triggers

Configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *", "0 6 * * *"]  # 09:00 & 13:00 WIB (UTC+7)
```

### Secrets

```bash
cd workers/market-scraper
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### What It Scrapes

- **Gold**: Logam Mulia HTML pages for 1gr buy/sell prices.
- **Stocks**: IDX JSON API for BBCA, BBRI, TLKM, BMRI close prices.
- Upserts to Supabase `market_rates` table via PostgREST.

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Only use in server-side workers. Never expose to clients.

## Cloudflare Workers — Monthly Report & Gamification

### Deployment

```bash
cd workers/arsa-monthly
npm install
wrangler deploy
```

### Cron Trigger

Runs on the 1st of every month at 01:00 UTC (`0 1 1 * *`).

### Secrets

```bash
cd workers/arsa-monthly
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put WORKER_SECRET
```

### Manual Trigger

```bash
curl -H "X-Worker-Secret: YOUR_SECRET" https://arsa-monthly-worker.<subdomain>.workers.dev
```

### What It Does

1. **Gamification evaluation**: Evaluates point rules (budget discipline, daily logging, savings milestones, custom challenges) for all families. Awards points, updates streaks.
2. **Email report**: Builds an HTML report with cashflow summary, category breakdown, investment performance, gamification leaderboard. Sends via Resend API to all family members.

## Resend Email

1. Sign up at [resend.com](https://resend.com/) (free: 3,000 emails/month).
2. Add and verify your sending domain (or use `arsa@resend.dev` for testing).
3. Get API key → set as `RESEND_API_KEY` in the `arsa-monthly` worker secrets.

## Push Notifications

### VAPID Key Generation

Push notifications use the Web Push protocol with VAPID (Voluntary Application Server Identification) keys.

**Generate keys (one-time):**

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and a private key. Store them securely.

### Setup

1. Set `PUBLIC_VAPID_PUBLIC_KEY` in Cloudflare Pages environment variables (Production + Preview).
2. Set `VAPID_PRIVATE_KEY` in Cloudflare Pages environment variables (Production only — server-side secret).
3. Run migration `009_push_subscriptions.sql` on your Supabase project to create the `push_subscriptions` table.
4. Users subscribe to push notifications from the app's Settings page. The browser's Push API registers the subscription, which is stored in Supabase.

### Notification Triggers

| Trigger | Condition | Recipients |
|---------|-----------|------------|
| Budget alert | Category spending exceeds 80% of `monthly_limit` | Transaction creator |
| Reward approved | Admin approves a proposed reward | Reward proposer |
| Monthly report ready | Monthly report email sent | All family members |

## Testing

Run all test commands from `arsa-app/`:

| Command | Description |
|---------|-------------|
| `npx vitest run` | Run unit tests (offline queue, worker helpers) |
| `npx vitest run --config vitest.integration.config.ts` | Run integration tests (gamification) |
| `cd workers/arsa-monthly && npx vitest run` | Run monthly worker unit tests |
| `npx playwright test` | Run E2E tests (auth, PWA, responsive) |

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs 5 jobs on every push to `main` and on pull requests:

1. **Lint** — ESLint + Prettier + TypeScript type checking
2. **Unit tests** — Vitest unit tests
3. **Integration tests** — Vitest integration tests
4. **E2E tests** — Playwright tests with Chromium
5. **Deploy** — Build and deploy to Cloudflare Pages (only on `main` branch)

## Domain & DNS (Optional)

1. In Cloudflare Pages → your project → Custom Domains → Add.
2. Enter your domain (e.g., `arsa.yourdomain.com`).
3. If domain is on Cloudflare DNS: CNAME record is created automatically.
4. If domain is elsewhere: add CNAME record pointing to `arsa-app.pages.dev`.
5. SSL is automatic — no configuration needed.

## Monitoring & Logs

### Cloudflare

- **Pages → Deployments:** build logs, deploy history, rollback options.
- **Analytics:** Web Analytics → add the JS snippet for real user metrics (optional).
- **Workers logs:** `wrangler pages deployment tail` for live SSR logs.

### Supabase

- **Dashboard → Logs:** API logs, auth logs, Postgres logs.
- **Dashboard → Reports:** Database performance, API usage, auth metrics.
- **Dashboard → Database → Roles:** monitor connection pool usage.

### Quick Debugging

```bash
# Live logs from Cloudflare Pages (SSR/Workers)
wrangler pages deployment tail --project-name=arsa-app

# Check Supabase API health
curl https://<project>.supabase.co/rest/v1/ \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

## Rollback

### Via Cloudflare Dashboard

1. Pages → arsa-app → Deployments.
2. Find the last known good deployment.
3. Click "..." → "Rollback to this deployment".
4. Takes effect immediately (< 30 seconds).

### Via CLI

```bash
# List recent deployments
wrangler pages deployment list --project-name=arsa-app

# Rollback (note: use dashboard for easiest rollback)
# Re-deploy a previous build by checking out that commit and deploying:
git checkout <good-commit-hash>
cd arsa-app && npm ci && npm run build
wrangler pages deploy .svelte-kit/cloudflare --project-name=arsa-app
git checkout main
```

### Supabase Migrations Rollback

Supabase doesn't auto-rollback migrations. If a migration breaks something:
1. Write a new migration that reverses the change.
2. Apply it via SQL Editor.
3. Commit the rollback migration.
