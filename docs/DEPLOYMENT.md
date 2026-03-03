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

**Current state:** Only Cloudflare Pages + Supabase are active. R2, Workers AI, Rust Worker, and Resend are future phases.

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

### Preview Deployments

Every push to a non-`main` branch automatically creates a preview deployment at `https://<hash>.arsa-app.pages.dev`. No additional configuration needed — Cloudflare Pages does this by default.

## Environment Variables (Production)

Set in Cloudflare Pages → your project → Settings → Environment Variables:

| Variable | Scope | Description |
|----------|-------|-------------|
| `PUBLIC_SUPABASE_URL` | Production + Preview | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Server-side only (Phase 5+) |

**Important:** Use separate Supabase projects for production and preview if you want data isolation. Otherwise, preview deployments will share the production database.

## Supabase Production Setup

### New Production Project

1. Create a new Supabase project for production (or reuse your dev project for MVP).
2. Run all migrations from `supabase/migrations/` in order via SQL Editor.
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

## Cloudflare R2 (Phase 3+)

*Not yet implemented. Setup instructions for when Phase 3 begins.*

### Bucket Setup

1. R2 → Create Bucket → name: `arsa-receipts`.
2. Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["https://arsa-app.pages.dev"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Bind R2 to your Pages project in `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "RECEIPTS", "bucket_name": "arsa-receipts" }
]
```

### Presigned URLs

Receipt uploads use presigned PUT URLs generated server-side. The client never gets direct R2 credentials.

## Cloudflare Workers — Market Scraper (Phase 5+)

*Not yet implemented. Setup instructions for when Phase 5 begins.*

### Deployment

The market scraper is a separate Rust/Wasm Cloudflare Worker:

```bash
cd workers/market-scraper
wrangler deploy
```

### Cron Triggers

Configure in the worker's `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *", "0 6 * * *"]  # 09:00 & 13:00 WIB (UTC+7)
```

### Secrets

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Only use in server-side workers. Never expose to clients.

## Cloudflare Workers AI — OCR (Phase 4+)

*Not yet implemented.* Workers AI is available automatically on the Cloudflare free plan. No additional setup beyond binding in `wrangler.jsonc`:

```jsonc
"ai": { "binding": "AI" }
```

## Resend Email (Phase 6+)

*Not yet implemented.* Monthly auto-report emails via Resend API.

1. Sign up at [resend.com](https://resend.com/) (free: 3,000 emails/month).
2. Add and verify your sending domain.
3. Get API key → set as `RESEND_API_KEY` in Workers secrets.

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
