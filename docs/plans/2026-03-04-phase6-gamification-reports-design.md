# Phase 6 Design: Gamification & Monthly Reports

**Date:** 2026-03-04
**Status:** Approved
**Approach:** Monolithic Cloudflare Worker (Approach A)

---

## Overview

Phase 6 adds two cohesive systems: a family-wide gamification engine (points, rewards, challenges) and automated monthly email reports via Resend API. Both are evaluated and triggered by a single Cloudflare Worker on a monthly cron.

**Audience:** Whole family — spouses and kids all participate in earning points and redeeming rewards.

---

## Database Schema

### `point_rules` — defines how points are earned

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| family_id | UUID FK → families | RLS-scoped |
| rule_type | text | `budget_discipline`, `daily_logging`, `savings_milestone`, `custom_challenge` |
| name | text | e.g. "Stay under grocery budget" |
| description | text | |
| points_value | integer | Points awarded on completion |
| config | JSONB | Rule-specific params (see below) |
| is_active | boolean | default true |
| created_by | UUID FK → users | |
| created_at | timestamptz | default now() |

**Config examples by rule_type:**
- `budget_discipline`: `{ "category_id": "uuid" }`
- `daily_logging`: `{ "streak_milestones": [7, 14, 30] }`
- `savings_milestone`: `{ "account_id": "uuid", "target_balance": 10000000 }`
- `custom_challenge`: `{ "deadline": "2026-03-07", "verify": "manual" }` or `{ "deadline": "...", "verify": "auto_category", "category_id": "uuid" }`

### `point_events` — audit log of every point change

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| family_id | UUID FK → families | RLS-scoped |
| user_id | UUID FK → users | Who earned/spent |
| rule_id | UUID FK → point_rules | nullable (null for redemptions) |
| points | integer | positive = earned, negative = spent |
| description | text | Human-readable reason |
| month | date | First of month this applies to |
| created_at | timestamptz | default now() |

### `rewards` — catalog with approval workflow

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| family_id | UUID FK → families | RLS-scoped |
| name | text | e.g. "No dish duty for 3 days" |
| description | text | |
| point_cost | integer | |
| proposed_by | UUID FK → users | |
| status | text | `pending`, `approved`, `rejected` |
| approved_by | UUID FK → users | nullable |
| created_at | timestamptz | default now() |

### `reward_redemptions` — tracks who redeemed what

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| family_id | UUID FK → families | RLS-scoped |
| reward_id | UUID FK → rewards | |
| redeemed_by | UUID FK → users | |
| points_spent | integer | Snapshot of cost at redemption time |
| redeemed_at | timestamptz | default now() |
| fulfilled | boolean | default false, admin marks done |

### `gamification` (modified) — per-user running totals

| Column | Type | Notes |
|--------|------|-------|
| family_id | UUID | composite PK |
| user_id | UUID | composite PK |
| current_points | integer | default 0 |
| streak_days | integer | consecutive logging days |
| last_log_date | date | for streak tracking |

**Key change from original spec:** Now per-user (composite PK: family_id + user_id) instead of per-family only.

### RLS Policies

All 5 tables use the standard family-scoped RLS pattern:
```sql
family_id = (SELECT family_id FROM users WHERE id = auth.uid())
```

Additional policy on `rewards`: members can INSERT (propose) but only admins can UPDATE status (approve/reject).

---

## Point-Earning Rules Engine

### 1. Budget Discipline (month-end evaluation)

- Worker checks each category's `monthly_limit` vs actual spend for the month
- If family total spend in a category < limit → points awarded to all family members equally
- 100% of `points_value` if under budget, 0 if over. No partial credit.
- Default rule auto-created per category when family sets a budget limit

### 2. Daily Logging Streaks (month-end evaluation)

- Worker checks each user's transaction logging pattern for the month
- A "log day" = at least 1 transaction recorded that day
- Streak milestones: 7 consecutive days → bonus, 14 → more, 30 → jackpot
- `streak_days` and `last_log_date` on `gamification` track running streak
- Worker resets streak if gap detected, awards milestone points if thresholds crossed

### 3. Savings Milestones (month-end evaluation)

- Worker compares account balances or investment totals against targets in `point_rules.config`
- Points awarded once per milestone (deduplicated via `point_events` — won't re-award same rule+month)

### 4. Custom Challenges (month-end evaluation)

- Admin creates challenge with deadline and description
- Two verification modes:
  - `manual` — admin marks challenge completed for a user via UI toggle
  - `auto_category` — Worker checks if spend in a specific category = 0 during the period
- Completed challenges award points at month-end

### Idempotency

Worker writes `point_events` with a `month` field. Before writing, checks if events for that rule+user+month already exist. Safe to re-run.

---

## Rewards Catalog & Redemption Flow

### Lifecycle: Propose → Approve → Redeem → Fulfill

1. **Propose:** Any family member taps "Propose Reward" — fills name, description, suggested point cost. Status = `pending`.
2. **Approve:** Admin sees pending proposals, can approve (optionally adjust point cost) or reject. Only `approved` rewards appear in catalog.
3. **Redeem:** User picks reward, taps "Redeem". System checks `current_points >= point_cost`. Creates `reward_redemptions` row + negative `point_events` entry.
4. **Fulfill:** Redeemed rewards appear in "Active Rewards" list. Admin marks `fulfilled` when done. Unfulfilled rewards show as gentle reminder.

### Edge Cases

- Reward deleted while pending redemption: `points_spent` snapshot on `reward_redemptions` protects against this
- Points go negative after correction: Allowed (rare). Admin can add manual correction `point_event`.
- Multiple redemptions of same reward: Allowed — each creates new redemption row.

---

## Monthly Email Report

### Trigger

Cloudflare Worker cron: `0 1 1 * *` (01:00 UTC = 08:00 WIB on 1st of month)

### Email Content (8 sections)

1. **Header** — "Arsa Family Report — [Month Year]", family name
2. **Cashflow Summary** — Total income, total expenses, net savings, vs previous month (↑/↓)
3. **Category Breakdown** — Table: category, budget limit, actual spend, % used, over/under. Sorted by highest spend.
4. **Per-Member Spending** — Each member's total spend. Private transactions: amount counted, merchant hidden ("Private").
5. **Investment Performance** — Portfolio value, monthly change, per-asset breakdown (gold/stocks/mutual funds), floating P/L (green/red text)
6. **Gamification Leaderboard** — Points earned this month per member, total points, streaks, rewards redeemed
7. **Highlights** — Auto-generated: biggest expense, best budget category, longest streak, milestones hit
8. **Footer** — "Generated by Arsa" + link to app

### Template

- Plain TypeScript template function inside the Worker (no framework dependency)
- Inline CSS, table-based layout for email client compatibility
- No images/charts — colored text, unicode arrows (↑↓), bar characters (█░)

### Delivery

- Resend API: `POST https://api.resend.com/emails`
- Recipients: all family members (pulled from Supabase `auth.users` via `users` table)
- From: `arsa@<verified-domain>`
- Subject: "Laporan Keluarga [Family Name] — [Month Year]"
- Same email to all members (no per-recipient customization in MVP)

### Privacy

- Private transactions (`is_private = true`): amount in totals + category breakdown, merchant/notes replaced with "Private" in per-member section

---

## Cloudflare Worker Architecture

### `arsa-monthly-worker`

**Execution flow:**
```
Cron fires
  → Fetch all families from Supabase (SERVICE_ROLE_KEY, bypasses RLS)
  → For each family:
      1. Query transactions for previous month
      2. Query categories + budget limits
      3. Query investments + market_rates
      4. Query users in family
      5. Evaluate point rules:
         a. Budget discipline → award points per category
         b. Logging streaks → check gaps, award milestones
         c. Savings milestones → compare balances vs targets
         d. Custom challenges (auto_category) → verify
         e. Write point_events (idempotent)
         f. Update gamification.current_points
      6. Build email HTML
      7. Send via Resend API
  → Return summary log
```

### Secrets (Worker environment)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

### Error Handling

- Per-family try/catch — one family failing doesn't block others
- Resend failure: log error, continue. No retry in same run.
- Worker execution limit: 30s free tier. Sufficient for ~10 families.

### Manual Trigger

Worker exposes `fetch` handler with shared secret header for testing/re-running missed months.

### Wrangler Config

```jsonc
{
  "name": "arsa-monthly-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "triggers": {
    "crons": ["0 1 1 * *"]
  }
}
```

---

## UI: SvelteKit Pages & Components

### Routes

| Route | Purpose |
|-------|---------|
| `/gamification` | Leaderboard, current streak, recent point events |
| `/gamification/rewards` | Reward catalog, propose new, pending approvals (admin) |
| `/gamification/history` | Full point event log with user/month filters |

### Page Details

**`/gamification` — Main Dashboard**
- daisyUI `stats` row: total family points, your points, your streak (days)
- Leaderboard `table`: rank, member name, points this month, total points
- Recent activity: last 5 `point_events` as timeline
- Links to rewards + history

**`/gamification/rewards` — Catalog**
- Tab bar: "Catalog" | "Pending" (admin only, badge count)
- Catalog: grid of `card` components — name, cost, "Redeem" button
- Pending (admin): proposals with approve/reject + editable point cost
- "Propose Reward" button → bottom sheet modal

**`/gamification/history` — Point Log**
- Filter: user dropdown + month picker
- List: date, description, points (+/-), rule type badge
- Running total at top

### Integration with Existing Pages

- **Dashboard (`/`):** Small `stat` widget — family points + streak
- **Settings:** Link to gamification settings (manage rules, point values)
- **Bottom nav:** No new item. Accessible from dashboard widget tap or Settings.

### New Components

| Component | Purpose |
|-----------|---------|
| `PointsBadge.svelte` | Inline badge showing user's points |
| `StreakIndicator.svelte` | Fire icon + day count |
| `RewardCard.svelte` | Catalog card with redeem action |
| `LeaderboardTable.svelte` | Ranked family members |
| `PointEventItem.svelte` | Timeline entry for point history |
| `RewardProposalModal.svelte` | Bottom sheet form for proposing rewards |

### Data Loading

- All pages use `+page.server.ts` load functions
- Supabase queries with user session (RLS enforced)
- Reward approval/rejection + redemption via SvelteKit form actions
