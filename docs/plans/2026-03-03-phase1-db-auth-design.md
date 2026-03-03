# Phase 1: Database Schema & Authentication Design

**Date:** 2026-03-03
**Scope:** Full database schema, SSR auth with Supabase, family workspace onboarding, magic link invites

## Auth Method

Email/Password only (MVP). Google OAuth deferred.

## Auth Architecture

SSR with `@supabase/ssr` + SvelteKit form actions. Cookie-based sessions via `hooks.server.ts`. Protected routes check session in `+layout.server.ts`.

## Database Schema

8 tables total (7 from TSD + `invites`). SQL stored in `supabase/migrations/`.

| Table | Key Columns | RLS |
|-------|------------|-----|
| `families` | id, name, created_at | Yes |
| `users` | id (FK auth.users), family_id, role, display_name | Yes |
| `accounts` | id, family_id, name, type, balance | Yes |
| `categories` | id, family_id, name, monthly_limit, is_child_related | Yes |
| `transactions` | id, family_id, account_id, category_id, user_id, amount, type, receipt_url, is_reconciled, is_private, date, merchant, notes | Yes |
| `market_rates` | asset_code (PK), asset_type, buy_price, sell_price, updated_at | No (global) |
| `investments` | id, family_id, asset_code, qty, avg_buy_price | Yes |
| `gamification` | family_id (PK), current_points, rewards_catalog (JSONB) | Yes |
| `invites` | id, family_id, created_by, token (unique), expires_at, used_at | Yes |

RLS pattern on all family-scoped tables:
```sql
family_id = (SELECT family_id FROM users WHERE id = auth.uid())
```

## Auth Infrastructure

- `@supabase/ssr` — new dependency, replaces Phase 0 simple client
- `src/hooks.server.ts` — server-side Supabase client per request via cookies, exposes `event.locals.supabase` and `event.locals.safeGetSession()`
- `src/routes/+layout.server.ts` — calls `safeGetSession()`, passes session/user to pages, enforces route guards
- `src/routes/+layout.ts` — creates browser/server client via `@supabase/ssr`, re-exports supabase/session/user

## Auth Pages

- `/login` — email + password form action → `signInWithPassword()` → redirect to `/` or `/onboarding`
- `/register` — email + password + display name → `signUp()` → insert `users` row (no family yet) → redirect to `/onboarding`
- `/logout` — POST-only form action → `signOut()` → redirect to `/login`

All pages use daisyUI `card`, `input`, `btn`, `alert` classes.

## Onboarding & Invite Flow

Mandatory onboarding — users without a `family_id` are redirected to `/onboarding`.

**Create a Family (`/onboarding`):**
- Form: family name
- Action: insert `families`, update `users.family_id` + `users.role = 'admin'`
- Redirects to `/onboarding/invite` — shows shareable magic link

**Join a Family (`/invite/[token]`):**
- Validates token: exists, not expired (7 days), not used
- Updates `users.family_id` + `users.role = 'member'`, marks invite used
- Redirects to `/`

Invite mechanics: UUID token, 7-day expiry, single use, admin-only generation.

## Route Guard Logic

In `+layout.server.ts`:
- Not authenticated → redirect `/login`
- Authenticated + no family_id → redirect `/onboarding`
- Authenticated + has family_id → allow app access
- Public routes (no guard): `/login`, `/register`, `/invite/[token]`

## Out of Scope

Account/category CRUD, transaction entry, business logic. Deferred to Phase 2.
