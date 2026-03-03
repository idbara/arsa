# Design: Development & Deployment Documentation

**Date:** 2026-03-04
**Audience:** Project owner + future contributors
**Output:** Two files — `docs/DEVELOPMENT.md` and `docs/DEPLOYMENT.md`

## Context

Arsa has no developer onboarding or deployment docs. The project uses SvelteKit on Cloudflare Pages, Supabase (PostgreSQL + Auth), Cloudflare R2, Workers AI, and a future Rust/Wasm market scraper worker. All services target free-tier (Rp0 infrastructure).

Current state: Phase 1 ~80% complete. Existing docs cover product requirements (PRD), technical spec (TSD), and phase plans — but nothing about how to set up, run, or deploy the project.

## File 1: `docs/DEVELOPMENT.md`

Local setup and dev workflow guide.

### Sections

1. **Prerequisites** — Node.js (>=18), npm, Supabase CLI, Wrangler CLI, Git. Rust/wasm-pack noted as future requirement for Phase 5+.

2. **Supabase Setup (from scratch)** — Create Supabase project, get API keys (anon, service role), run migrations from `supabase/migrations/`, configure Email/Password auth provider, verify RLS policies.

3. **Cloudflare Setup** — Create Cloudflare account, create R2 bucket (`arsa-receipts`), enable Workers AI access.

4. **Local Development** — Clone repo, `cd arsa-app`, `npm install`, copy `.env.example` to `.env`, fill in Supabase credentials, `npm run dev`.

5. **Project Structure** — Directory tree with descriptions of: `arsa-app/src/routes/` (pages), `arsa-app/src/lib/` (shared code/components), `supabase/migrations/` (DB schema), `docs/` (specs & plans).

6. **Dev Workflow** — Available npm scripts (`dev`, `build`, `preview`, `check`, `lint`, `format`), code conventions (Svelte 5 runes, TypeScript, daisyUI semantic classes).

7. **Database** — How to add new migrations (sequential numbering), RLS policy conventions (family_id scoping), how to apply migrations via Supabase CLI or dashboard SQL editor.

8. **Environment Variables** — Full table of current vars (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) plus future vars needed by later phases (R2 credentials, Workers AI binding, Resend API key, `SUPABASE_SERVICE_ROLE_KEY`).

9. **Troubleshooting** — Common issues: Supabase auth cookie size (max-http-header-size flag), Wrangler compatibility flags, daisyUI v5 theme config syntax, Svelte 5 migration gotchas.

## File 2: `docs/DEPLOYMENT.md`

Production deployment and CI/CD guide.

### Sections

1. **Architecture Overview** — Text diagram showing: Browser → Cloudflare Pages (SvelteKit) → Supabase (DB + Auth) + R2 (receipts) + Workers AI (OCR) + Rust Worker (market scraper) + Resend (email).

2. **Manual Deployment** — Build locally (`npm run build`), deploy via `wrangler pages deploy .svelte-kit/cloudflare`. Verify with production URL.

3. **CI/CD with GitHub Actions** — Complete workflow YAML: trigger on push to `main`, install deps, build, deploy to Cloudflare Pages using `cloudflare/wrangler-action`. Secrets setup instructions.

4. **Environment Variables (Production)** — What to configure in Cloudflare Pages dashboard (Settings → Environment Variables). Separation of build-time vs runtime vars.

5. **Supabase Production** — Production project setup, applying migrations, verifying RLS, auth redirect URLs configuration.

6. **Cloudflare R2** — Bucket creation, CORS policy for presigned uploads, binding to Pages project.

7. **Cloudflare Workers** — Market scraper worker deployment (Rust/Wasm), cron trigger configuration (09:00 & 13:00 WIB), environment secrets (SERVICE_ROLE_KEY).

8. **Domain & DNS** — Optional custom domain via Cloudflare DNS, SSL configuration (automatic).

9. **Monitoring & Logs** — Cloudflare Analytics dashboard, Supabase logs & metrics, Workers logs via `wrangler tail`.

10. **Rollback** — Cloudflare Pages deployment history, rolling back via dashboard or `wrangler pages deployment rollback`.

## Constraints

- Docs must reflect actual project state (what exists now vs what's planned for future phases)
- Future-phase sections (R2, Workers AI, Rust worker, Resend) clearly marked as "Phase X — not yet implemented"
- No sensitive values in docs — reference `.env.example` and dashboard settings
- Keep concise — action-oriented steps, not prose
