# Development & Deployment Documentation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create two comprehensive docs (`docs/DEVELOPMENT.md` and `docs/DEPLOYMENT.md`) that enable a new contributor to go from zero to running/deploying Arsa.

**Architecture:** Two standalone Markdown files. DEVELOPMENT.md covers local setup and dev workflow. DEPLOYMENT.md covers production deploy and CI/CD. Both reference actual project state and mark future-phase items clearly.

**Tech Stack:** Markdown documentation referencing SvelteKit, Cloudflare Pages, Supabase, R2, Workers AI, GitHub Actions.

---

### Task 1: Create `docs/DEVELOPMENT.md`

**Files:**
- Create: `docs/DEVELOPMENT.md`

**Step 1: Write the full DEVELOPMENT.md file**

Write the following content to `docs/DEVELOPMENT.md`:

```markdown
# Arsa — Development Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org/) |
| npm | >= 9 | Bundled with Node.js |
| Git | any | [git-scm.com](https://git-scm.com/) |
| Supabase CLI | latest | `npm install -g supabase` |
| Wrangler CLI | latest | `npm install -g wrangler` |

**Future (Phase 5+):** Rust toolchain + `wasm-pack` for the market scraper worker.

## Supabase Setup

1. Go to [supabase.com](https://supabase.com/) → create a new project (free tier).
2. Note your **Project URL** and **Anon Key** from Settings → API.
3. In Authentication → Providers, enable **Email/Password** (enabled by default).
4. In Authentication → URL Configuration, set Site URL to `http://localhost:5173`.
5. Run the database migrations in order via the SQL Editor (Dashboard → SQL Editor → New Query):
   - Paste and run `supabase/migrations/001_schema.sql` — creates all tables.
   - Paste and run `supabase/migrations/002_rls.sql` — enables Row Level Security policies.
6. Verify: go to Table Editor, confirm 9 tables exist (`families`, `users`, `accounts`, `categories`, `transactions`, `market_rates`, `investments`, `gamification`, `invites`).

**Alternative (Supabase CLI):**

```bash
supabase init
supabase link --project-ref <your-project-ref>
supabase db push
```

## Cloudflare Setup

1. Create a [Cloudflare](https://dash.cloudflare.com/) account (free plan).
2. **R2 Storage** (Phase 3+): Create a bucket named `arsa-receipts` in R2 → Overview → Create Bucket.
3. **Workers AI** (Phase 4+): No setup needed — available automatically on free plan.
4. **Wrangler auth**: Run `wrangler login` to authenticate your local CLI.

## Local Development

```bash
# Clone the repo
git clone <repo-url>
cd arsa/arsa-app

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in your Supabase credentials:
#   PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
#   PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Start dev server
npm run dev
# App runs at http://localhost:5173
```

## Project Structure

```
arsa/
├── CLAUDE.md                    # AI assistant instructions
├── docs/
│   ├── PRD.md                   # Product requirements (Indonesian)
│   ├── TSD.md                   # Technical spec (Indonesian)
│   ├── Development Stages.md    # 8-phase roadmap
│   ├── DEVELOPMENT.md           # ← You are here
│   ├── DEPLOYMENT.md            # Production deploy guide
│   └── plans/                   # Phase design & implementation plans
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql       # Table definitions
│       └── 002_rls.sql          # Row Level Security policies
└── arsa-app/                    # SvelteKit application
    ├── package.json
    ├── svelte.config.js         # Cloudflare adapter config
    ├── vite.config.ts
    ├── wrangler.jsonc            # Cloudflare Workers config
    ├── .env.example
    ├── src/
    │   ├── app.html              # HTML shell
    │   ├── app.css               # Tailwind + daisyUI setup
    │   ├── app.d.ts              # TypeScript ambient types
    │   ├── hooks.server.ts       # Auth middleware & route guards
    │   ├── lib/
    │   │   ├── components/       # Shared Svelte components
    │   │   ├── theme.svelte.ts   # Theme state (dim/cupcake)
    │   │   └── index.ts          # Lib barrel export
    │   └── routes/
    │       ├── +layout.svelte    # App shell (nav, header)
    │       ├── +layout.server.ts # Session loading
    │       ├── +page.svelte      # Home page
    │       ├── login/            # Email/password login
    │       ├── register/         # Registration + profile creation
    │       ├── logout/           # Session clear
    │       ├── onboarding/       # Family creation & invite join
    │       └── invite/[token]/   # Join family via invite link
    └── static/                   # Static assets
```

## Available Scripts

Run from `arsa-app/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (localhost:5173) |
| `npm run build` | Production build for Cloudflare |
| `npm run preview` | Preview production build locally |
| `npm run check` | TypeScript + Svelte type checking |
| `npm run check:watch` | Type checking in watch mode |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | Auto-format with Prettier |

## Code Conventions

- **Svelte 5** — use runes (`$state`, `$derived`, `$effect`, `$props`)
- **TypeScript** — strict mode, no `any` unless unavoidable
- **Styling** — daisyUI semantic classes (`card`, `btn`, `input`, `modal`, `stat`, `btm-nav`). Avoid custom CSS.
- **Themes** — `dim` (dark, default) and `cupcake` (light). Toggle via `ThemeToggle.svelte`.
- **Auth** — SSR via `@supabase/ssr`. Session managed in `hooks.server.ts`. All protected routes require session + `family_id`.
- **Data isolation** — every family-scoped query filters by `family_id` via Supabase RLS. Never bypass RLS from client code.

## Database Migrations

Migrations live in `supabase/migrations/` with sequential numbering.

**Adding a new migration:**

1. Create `supabase/migrations/003_<description>.sql`.
2. Write idempotent SQL (use `IF NOT EXISTS`, `OR REPLACE` where possible).
3. Apply via Supabase SQL Editor or `supabase db push`.
4. Commit the migration file.

**RLS conventions:**

- All family-scoped tables must have RLS enabled.
- Default policy: `using (family_id = (select family_id from users where id = auth.uid()))`.
- `market_rates` is the only global table (public read for authenticated users).
- Admin-only operations check `(select role from users where id = auth.uid()) = 'admin'`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 5+ | Server-only key for market scraper worker |
| `R2_ACCOUNT_ID` | Phase 3+ | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | Phase 3+ | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Phase 3+ | R2 secret key |
| `R2_BUCKET_NAME` | Phase 3+ | R2 bucket name (`arsa-receipts`) |
| `RESEND_API_KEY` | Phase 6+ | Resend API key for email reports |

Variables prefixed with `PUBLIC_` are exposed to the client. All others must only be used server-side.

## Troubleshooting

### Auth cookie header too large

The Supabase auth cookie can exceed default header limits. The dev script already includes `--max-http-header-size=65536`:

```json
"dev": "node --max-http-header-size=65536 node_modules/vite/bin/vite.js dev"
```

If you get header-related errors in preview mode, the same flag is applied there too.

### Wrangler compatibility flags

`wrangler.jsonc` requires `nodejs_als` compatibility flag. If you see errors about AsyncLocalStorage, verify:

```jsonc
"compatibility_flags": ["nodejs_als"]
```

### daisyUI v5 theme config

daisyUI v5 uses a Tailwind v4 plugin syntax in `app.css`:

```css
@import 'tailwindcss';
@plugin "daisyui" {
  themes: dim --default, cupcake;
}
```

This is NOT `tailwind.config.js` — there is no Tailwind config file in this project.

### Supabase RLS blocking queries

If queries return empty results unexpectedly, check:
1. The user is authenticated (session exists).
2. The user has a `family_id` set in the `users` table.
3. The target table's RLS policy matches the user's `family_id`.

Use Supabase Dashboard → SQL Editor to test queries with `auth.uid()` context.
```

**Step 2: Verify the file renders correctly**

Run: `npm run lint` (from `arsa-app/`) to ensure no formatting issues in the broader project. Open the markdown file in a previewer to verify headings, tables, and code blocks render properly.

**Step 3: Commit**

```bash
git add docs/DEVELOPMENT.md
git commit -m "docs: add development setup guide"
```

---

### Task 2: Create `docs/DEPLOYMENT.md`

**Files:**
- Create: `docs/DEPLOYMENT.md`

**Step 1: Write the full DEPLOYMENT.md file**

Write the following content to `docs/DEPLOYMENT.md`:

```markdown
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
```

**Step 2: Verify the file renders correctly**

Open the markdown file in a previewer. Verify the ASCII architecture diagram, tables, and code blocks render properly.

**Step 3: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add deployment and CI/CD guide"
```

---

### Task 3: Update `.env.example` with all documented variables

**Files:**
- Modify: `arsa-app/.env.example`

**Step 1: Update `.env.example`**

Add comments and future variables:

```env
# Supabase (required)
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase server-only (Phase 5+ — market scraper worker)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2 (Phase 3+ — receipt storage)
# R2_ACCOUNT_ID=your-cloudflare-account-id
# R2_ACCESS_KEY_ID=your-r2-access-key
# R2_SECRET_ACCESS_KEY=your-r2-secret-key
# R2_BUCKET_NAME=arsa-receipts

# Resend (Phase 6+ — email reports)
# RESEND_API_KEY=your-resend-api-key
```

**Step 2: Commit**

```bash
git add arsa-app/.env.example
git commit -m "docs: expand .env.example with all future env vars"
```

---

### Task 4: Create GitHub Actions workflow file

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create directory and workflow file**

```bash
mkdir -p .github/workflows
```

Write the workflow YAML as documented in `docs/DEPLOYMENT.md` (the CI/CD section) to `.github/workflows/deploy.yml`.

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for Cloudflare Pages deploy"
```

---

### Task 5: Final verification

**Step 1: Verify all docs are consistent**

- Cross-check env var names between `DEVELOPMENT.md`, `DEPLOYMENT.md`, and `.env.example`.
- Verify file paths in project structure match actual files.
- Confirm all npm scripts listed match `package.json`.

**Step 2: Final commit (if any fixes needed)**

```bash
git add docs/DEVELOPMENT.md docs/DEPLOYMENT.md
git commit -m "docs: fix consistency across dev and deploy guides"
```
