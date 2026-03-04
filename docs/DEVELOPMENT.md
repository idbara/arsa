# Arsa — Development Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org/) |
| npm | >= 9 | Bundled with Node.js |
| Git | any | [git-scm.com](https://git-scm.com/) |
| Supabase CLI | latest | `npm install -g supabase` |
| Wrangler CLI | latest | `npm install -g wrangler` |

| Rust toolchain | latest | [rustup.rs](https://rustup.rs/) (Phase 5 market scraper) |
| cargo-install worker-build | latest | `cargo install worker-build` (Phase 5) |

## Supabase Setup

1. Go to [supabase.com](https://supabase.com/) → create a new project (free tier).
2. Note your **Project URL** and **Anon Key** from Settings → API.
3. In Authentication → Providers, enable **Email/Password** (enabled by default).
4. In Authentication → URL Configuration, set Site URL to `http://localhost:5173`.
5. Run the database migrations in order via the SQL Editor (Dashboard → SQL Editor → New Query):
   - Paste and run `supabase/migrations/001_schema.sql` — creates all tables.
   - Paste and run `supabase/migrations/002_rls.sql` — enables Row Level Security policies.
   - Paste and run `supabase/migrations/003_fix_rls_recursion.sql` — fixes RLS infinite recursion with `SECURITY DEFINER` helper functions.
   - Paste and run `supabase/migrations/004_add_group_id.sql` — adds `group_id` column to transactions.
   - Paste and run `supabase/migrations/006_phase6_drop_old_gamification.sql` — drops old gamification table.
   - Paste and run `supabase/migrations/007_phase6_gamification_tables.sql` — creates 5 gamification tables.
   - Paste and run `supabase/migrations/008_phase6_rls.sql` — RLS policies for gamification tables.
   - Paste and run `supabase/migrations/009_push_subscriptions.sql` — creates `push_subscriptions` table for push notifications.
6. Verify: go to Table Editor, confirm 15 tables exist (`families`, `users`, `accounts`, `categories`, `transactions`, `market_rates`, `investments`, `invites`, `point_rules`, `point_events`, `rewards`, `reward_redemptions`, `gamification`, `push_subscriptions`).

**Alternative (Supabase CLI):**

```bash
supabase init
supabase link --project-ref <your-project-ref>
supabase db push
```

## Cloudflare Setup

1. Create a [Cloudflare](https://dash.cloudflare.com/) account (free plan).
2. **R2 Storage** (Phase 3+): Create a bucket named `arsa-receipts` in R2 → Overview → Create Bucket.
3. **Workers AI** (Phase 4+): Available on free plan. You must accept the Meta Llama 3.2 Vision model license in the Cloudflare dashboard (Workers AI → Models → Llama 3.2 Vision → Accept). Get your AI API token from Workers AI → Overview → Use REST API → Get API Token.
4. **Wrangler auth**: Run `wrangler login` to authenticate your local CLI.
5. **R2 CORS** (Phase 3+): Run `node scripts/setup-r2-cors.mjs` after configuring R2 env vars in `.env` to enable browser uploads.

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
│       ├── 001_schema.sql               # Table definitions
│       ├── 002_rls.sql                  # Row Level Security policies
│       ├── 003_fix_rls_recursion.sql    # RLS helper functions
│       ├── 004_add_group_id.sql         # Transaction group_id column
│       ├── 006_phase6_drop_old_gamification.sql  # Drop old gamification
│       ├── 007_phase6_gamification_tables.sql    # 5 new gamification tables
│       ├── 008_phase6_rls.sql           # Gamification RLS policies
│       └── 009_push_subscriptions.sql  # Push notification subscriptions
├── workers/
│   ├── market-scraper/          # Rust/Wasm Cloudflare Worker (Phase 5)
│   │   ├── Cargo.toml
│   │   ├── wrangler.toml
│   │   └── src/lib.rs           # Gold + stock scrapers
│   └── arsa-monthly/            # TypeScript Cloudflare Worker (Phase 6)
│       ├── wrangler.jsonc
│       ├── package.json
│       └── src/
│           ├── index.ts         # Entry point + cron handler
│           ├── evaluate.ts      # Gamification rule evaluation
│           └── email.ts         # Monthly report builder + Resend
├── scripts/
│   └── setup-r2-cors.mjs       # One-time R2 CORS configuration
└── arsa-app/                    # SvelteKit application
    ├── package.json
    ├── svelte.config.js         # Cloudflare adapter config
    ├── vite.config.ts
    ├── wrangler.jsonc           # Cloudflare Workers config
    ├── .env.example
    ├── src/
    │   ├── app.html             # HTML shell
    │   ├── app.css              # Tailwind + daisyUI setup
    │   ├── app.d.ts             # TypeScript ambient types
    │   ├── hooks.server.ts      # Auth middleware & route guards
    │   ├── lib/
    │   │   ├── components/      # Shared Svelte components
    │   │   │   ├── AddTransaction.svelte   # Transaction entry modal
    │   │   │   ├── BottomNav.svelte        # Bottom navigation dock
    │   │   │   ├── Reconcile.svelte        # Bank reconciliation UI
    │   │   │   ├── ReceiptUpload.svelte    # Camera/gallery receipt upload
    │   │   │   ├── ReceiptViewer.svelte    # Receipt image viewer
    │   │   │   ├── WealthTab.svelte        # Portfolio holdings view
    │   │   │   ├── InvestmentModal.svelte  # Buy/sell asset modal
    │   │   │   ├── LeaderboardTable.svelte # Gamification leaderboard
    │   │   │   ├── PointsBadge.svelte      # Points display badge
    │   │   │   ├── PointEventItem.svelte   # Point event row
    │   │   │   ├── StreakIndicator.svelte   # Streak display
    │   │   │   ├── RewardCard.svelte       # Reward with redeem button
    │   │   │   └── RewardProposalModal.svelte  # Propose reward form
    │   │   ├── offline.ts       # IndexedDB offline queue (idb)
    │   │   ├── sync.ts          # Sync engine with retry logic
    │   │   ├── online-status.svelte.ts  # Online/offline reactive state
    │   │   ├── push.ts          # VAPID push subscription client
    │   │   ├── server/
    │   │   │   ├── r2.ts        # Lazy-initialized R2 S3 client
    │   │   │   └── push.ts      # Server-side push notification sending
    │   │   ├── types/
    │   │   │   └── gamification.ts  # Gamification TypeScript types
    │   │   ├── bank-parsers.ts  # BCA + Mandiri CSV parsers
    │   │   ├── reconcile.ts     # Reconciliation matching logic
    │   │   ├── compress-image.ts # Client-side image compression
    │   │   ├── theme.svelte.ts  # Theme state (dim/cupcake)
    │   │   └── index.ts         # Lib barrel export
    │   └── routes/
    │       ├── +layout.svelte    # App shell (nav, header)
    │       ├── +layout.server.ts # Session + accounts + categories
    │       ├── +layout.ts        # Browser/server Supabase client
    │       ├── +page.svelte      # Home (Cash Flow / Wealth tabs)
    │       ├── +page.server.ts   # Dashboard data loader
    │       ├── login/            # Email/password login
    │       ├── register/         # Registration + profile creation
    │       ├── logout/           # Session clear
    │       ├── onboarding/       # Family creation & invite
    │       ├── invite/[token]/   # Join family via invite link
    │       ├── history/          # Transaction history + reconciliation
    │       ├── plan/             # Child expenses + education calculator
    │       ├── settings/         # Accounts, categories, sign out
    │       ├── gamification/     # Gamification dashboard
    │       │   ├── rewards/      # Rewards catalog + propose/redeem
    │       │   └── history/      # Point event history with filters
    │       └── api/
    │           ├── transactions/ # Transaction CRUD
    │           ├── investments/  # Buy/sell investments
    │           ├── ocr/          # Receipt OCR via Workers AI
    │           ├── receipts/     # R2 presigned URLs
    │           └── reconcile/    # Mark transactions reconciled
    ├── static/                   # Static assets
    │   ├── manifest.json         # PWA manifest
    │   ├── service-worker.js     # Service worker (Workbox caching)
    │   └── icons/                # PWA icons (192x192, 512x512)
    └── tests/                    # Test suites
        ├── setup.ts              # Test setup & global mocks
        ├── unit/                 # Vitest unit tests
        ├── integration/          # Vitest integration tests
        ├── mocks/                # Shared test mocks
        └── e2e/                  # Playwright E2E tests
```

**CI/CD:**

```
.github/
└── workflows/
    └── ci.yml                    # GitHub Actions (lint, test, deploy)
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
| `npx vitest run` | Run unit tests |
| `npx vitest run --config vitest.integration.config.ts` | Run integration tests |
| `npx playwright test` | Run E2E tests |

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

1. Create `supabase/migrations/010_<description>.sql` (use the next sequential number).
2. Write idempotent SQL (use `IF NOT EXISTS`, `OR REPLACE` where possible).
3. Apply via Supabase SQL Editor or `supabase db push`.
4. Commit the migration file.

**RLS conventions:**

- All family-scoped tables must have RLS enabled.
- Use `SECURITY DEFINER` helper functions to avoid RLS infinite recursion: `get_my_family_id()` and `get_my_role()`.
- Default policy: `using (family_id = get_my_family_id())`.
- `market_rates` is the only global table (public read for authenticated users).
- Admin-only operations check `get_my_role() = 'admin'`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers | Server-only key for market scraper & monthly worker |
| `R2_ACCOUNT_ID` | Yes (Phase 3+) | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | Yes (Phase 3+) | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes (Phase 3+) | R2 secret key |
| `R2_BUCKET_NAME` | Yes (Phase 3+) | R2 bucket name (`arsa-receipts`) |
| `CLOUDFLARE_AI_TOKEN` | Yes (Phase 4+) | Cloudflare Workers AI API token for OCR |
| `PUBLIC_VAPID_PUBLIC_KEY` | Yes (Phase 7+) | VAPID public key for push notification subscriptions |
| `VAPID_PRIVATE_KEY` | Yes (Phase 7+) | VAPID private key for server-side push sending |
| `RESEND_API_KEY` | Workers (Phase 6+) | Resend API key for monthly email reports |

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
