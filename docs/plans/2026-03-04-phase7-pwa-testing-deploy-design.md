# Phase 7 Design: PWA, Testing & Deployment

**Date:** 2026-03-04
**Status:** Approved
**Approach:** Workbox + IndexedDB offline queue (Approach A)

---

## Overview

Phase 7 makes Arsa installable, offline-capable, fully tested, and production-deployed. A Workbox-powered service worker handles caching and push notifications. IndexedDB provides an offline write queue with sync-on-reconnect. A full test pyramid (unit + integration + E2E) ensures quality. Cloudflare Pages Git integration handles deployment, with GitHub Actions for CI.

---

## PWA Manifest

**File:** `arsa-app/static/manifest.json`

| Field | Value |
|-------|-------|
| name | Arsa — Family Wealth Manager |
| short_name | Arsa |
| start_url | / |
| display | standalone |
| orientation | portrait |
| theme_color | #1a1a2e |
| background_color | #1a1a2e |
| icons | 192x192 PNG, 512x512 PNG (generated from favicon.svg) |

Link tag added to `app.html`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1a1a2e" />
```

---

## Service Worker (Workbox)

**File:** `arsa-app/src/service-worker.ts`

### Caching Strategies

| Resource | Strategy | Details |
|----------|----------|---------|
| App shell (HTML, JS, CSS) | Precache | Build-time manifest, instant load, update on new deploy |
| Font files | Cache-first | 30-day expiry |
| Supabase API responses | Network-first | Fallback to cache for offline reads |
| Images (receipts from R2) | Cache-first | 7-day expiry |

### Registration

In `+layout.svelte` on mount:
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
```

### Offline Detection

Listen to `navigator.onLine` + `online`/`offline` events. Show toast banner when offline. Hide when back online + queue drains.

---

## Offline Queue System

### IndexedDB Database: `arsa-offline`

**Object store: `pending_actions`**

| Field | Type | Notes |
|-------|------|-------|
| id | auto-increment | |
| action_type | string | `add_transaction`, `propose_reward` |
| payload | object | Serialized form data |
| created_at | ISO string | For last-write-wins ordering |
| retries | number | default 0, max 3 |

**Object store: `cached_data`**

| Key | Data | Refreshed |
|-----|------|-----------|
| dashboard | Stats, balances, recent transactions | Every dashboard visit |
| accounts | Account list with balances | Every accounts page visit |
| gamification | Points, streak, leaderboard | Every gamification visit |

### Write Flow

1. User submits form (e.g., add transaction)
2. Check `navigator.onLine`
3. **Online:** Normal form action → Supabase → done
4. **Offline:** Serialize → IndexedDB `pending_actions` → success toast with "Queued offline" → optimistic local cache update

### Sync Flow

1. `online` event fires (or app regains focus while online)
2. Read all `pending_actions` ordered by `created_at`
3. For each: POST to corresponding SvelteKit form action endpoint
4. **Success:** Delete from IndexedDB, update cache
5. **Network failure:** Increment retries, retry next sync
6. **Server error + retries >= 3:** Mark failed, surface in UI for user to retry/discard
7. Toast: "Synced X items" or "Y items failed to sync"

### Conflict Resolution

Last-write-wins with timestamp. Transactions and reward proposals are append-only — no merge conflicts possible. Sufficient for a low-concurrency family app.

### Client-Side Offline Fallback

When offline, `+page.server.ts` won't run. Client-side fallback in `+page.svelte` reads from IndexedDB `cached_data` and renders with a "Cached data" badge.

### Utility Module

**File:** `arsa-app/src/lib/offline.ts`

Exports:
- `queueAction(type, payload)` — write to IndexedDB
- `syncPendingActions()` — drain the queue
- `getCachedData(key)` / `setCachedData(key, data)` — cached reads/writes
- `getPendingCount()` — for UI badge

---

## Push Notifications

### New Table: `push_subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| endpoint | text | Push service URL |
| keys | JSONB | `{ p256dh, auth }` |
| created_at | timestamptz | |

**RLS:** Users can read/write their own subscriptions only (`user_id = auth.uid()`).

### Push Events

| Event | Trigger Location | Recipients |
|-------|------------------|------------|
| Budget exceeded | `add_transaction` form action — after insert, check category vs limit | All family admins |
| Reward approved | `approve` form action — after status update | Proposer |
| Monthly report ready | Monthly Worker — final step after email sent | All family members |

### VAPID Keys

- `VAPID_PUBLIC_KEY` — in `.env` (client needs it for subscription)
- `VAPID_PRIVATE_KEY` — Worker secret (never exposed to client)
- Generated once via `web-push generate-vapid-keys`

### Client Flow

1. First login prompt: "Enable notifications?"
2. If accepted: `Notification.requestPermission()` → `pushManager.subscribe()` → POST subscription to Supabase
3. Permission state stored in localStorage (avoid re-prompting)
4. Settings page toggle to enable/disable (deletes subscription from DB)

### Push Sending

Utility function `sendPushNotification(subscription, payload)` — raw Web Push protocol via `fetch` with VAPID headers. No external library needed in Cloudflare Workers.

### Notification Payload

```json
{
  "title": "Budget Alert",
  "body": "Groceries exceeded Rp2.000.000 this month",
  "icon": "/icons/icon-192.png",
  "url": "/history"
}
```

Service worker handles `push` event → `showNotification()`. Handles `notificationclick` → `clients.openWindow(url)`.

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────┐
        │   E2E   │  Playwright (5-8 tests)
        ├─────────┤
        │ Integr. │  Vitest + SvelteKit (10-15 tests)
        ├─────────┤
        │  Unit   │  Vitest (20-30 tests)
        └─────────┘
```

### Unit Tests (Vitest)

**Location:** `arsa-app/tests/unit/`, `workers/arsa-monthly/tests/`

| Module | Tests |
|--------|-------|
| `workers/arsa-monthly/src/evaluate.ts` | Budget discipline calc, streak counting, milestone dedup, challenge verification |
| `workers/arsa-monthly/src/email.ts` | `formatRp()`, `changeIndicator()`, `progressBar()`, HTML structure |
| `arsa-app/src/lib/offline.ts` | Queue add/drain, cached data read/write, pending count |
| `arsa-app/src/lib/theme.svelte.ts` | Theme toggle, persistence |
| Utility helpers | Date formatting, currency formatting, CSV parsing |

### Integration Tests (Vitest + @testing-library/svelte)

**Location:** `arsa-app/tests/integration/`

| Flow | Tests |
|------|-------|
| Gamification load | Mock Supabase → verify leaderboard shape, event ordering |
| Reward propose action | Mock insert → verify success/failure |
| Reward redeem action | Mock insufficient points → error. Mock sufficient → point_event created |
| Transaction add action | Mock insert + budget check → verify push trigger on over-limit |
| Auth guards | Mock no session → verify redirect to /login |
| Offline fallback | Mock offline → verify cached data renders with badge |

**Supabase mock:** `arsa-app/tests/mocks/supabase.ts` — factory returning chainable `.from().select().eq()` stubs.

### E2E Tests (Playwright)

**Location:** `arsa-app/tests/e2e/`

| Test | Flow |
|------|------|
| Auth flow | Register → onboarding → create family → dashboard |
| Transaction CRUD | Login → add → verify history → verify dashboard |
| Reward lifecycle | Propose → admin approve → member redeem |
| Offline mode | Go offline → add transaction → queued toast → online → synced |
| PWA install | Verify manifest loads, service worker registers |
| Responsive | 375px viewport → bottom nav, no scroll, numpad on number inputs |
| Budget alert | Exceed limit → verify push payload (mock endpoint) |
| Monthly report | Trigger worker → verify email via Resend test mode |

**Setup:** `tests/e2e/setup.ts` — seed test user in Supabase, clean up after suite.

### Test Config Files

- `arsa-app/vitest.config.ts` — jsdom environment, @testing-library/svelte
- `arsa-app/vitest.integration.config.ts` — separate config for integration tests
- `arsa-app/playwright.config.ts` — Chromium, mobile viewport 375x812, base URL localhost:5173
- `workers/arsa-monthly/vitest.config.ts` — miniflare environment

---

## Deployment

### Cloudflare Pages Git Integration

| Setting | Value |
|---------|-------|
| Production branch | `main` |
| Build command | `cd arsa-app && npm run build` |
| Build output | `arsa-app/.svelte-kit/cloudflare` |
| Root directory | `/` |
| Node.js version | 20 |

**Environment variables (Pages dashboard):**
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `VAPID_PUBLIC_KEY`

Preview deployments on PRs (same Supabase project).

### GitHub Actions CI

**File:** `.github/workflows/ci.yml`

```
Trigger: push + PR

Jobs (parallel):
  1. lint-and-typecheck  → npm run lint && npm run check
  2. unit-tests          → npx vitest run
  3. integration-tests   → npx vitest run --config vitest.integration.config.ts
  4. worker-tests        → cd workers/arsa-monthly && npx vitest run

Job (sequential, after 1-4 pass):
  5. e2e-tests           → playwright install chromium → build → preview → playwright test
```

No deploy step — Cloudflare Pages handles deployment.

### Domain & SSL

- Default: `arsa-app.pages.dev` (auto-provisioned)
- Custom domain: configure in Pages dashboard when ready (Cloudflare SSL)
- Resend: verify custom domain for `arsa@yourdomain.com`

### One-Time Deploy Checklist

1. Connect GitHub repo to Cloudflare Pages
2. Set environment variables in Pages dashboard
3. Set Worker secrets for `arsa-monthly-worker` and `market-scraper`
4. Generate VAPID key pair → public in env, private as Worker secret
5. Verify Resend sender domain
6. Push to `main` → first production deploy
7. Test Add to Home Screen on Android Chrome + iOS Safari
