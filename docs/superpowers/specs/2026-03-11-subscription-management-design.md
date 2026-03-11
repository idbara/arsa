# Subscription Management — Design Spec

## Overview

Add subscription/recurring payment tracking to the Arsa family finance app. Users can record services like Netflix, Spotify, Vidio.com with billing cycle, amount, and category. The system sends push reminders on due dates — no auto-transaction creation.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Due date handling | Reminder only (push notification) | Simpler, lightweight daily cron |
| Navigation placement | Plan page summary + `/plan/subscriptions` sub-page | Clean separation, Plan = financial planning hub |
| Permissions | Members CRUD own, admin can CRUD all | Members manage own subscriptions, admin has family oversight |
| Category system | Existing `categories` table FK | Integrates with budget tracking |

## Database

### Table: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','semi_annual','annual')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  next_due_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS Policies

Uses `get_my_family_id()` and `get_my_role()` security-definer functions from migration 003 to avoid infinite recursion.

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can read subscriptions"
  ON subscriptions FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can insert subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (family_id = get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Owner or admin can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR get_my_role() = 'admin'));

CREATE POLICY "Owner or admin can delete subscriptions"
  ON subscriptions FOR DELETE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR get_my_role() = 'admin'));
```

### Indexes

```sql
CREATE INDEX idx_subscriptions_family ON subscriptions(family_id);
CREATE INDEX idx_subscriptions_due ON subscriptions(next_due_date) WHERE is_active = true;
```

## Frequency Options

| Value | Label | Period |
|-------|-------|--------|
| `daily` | Harian | 1 day |
| `weekly` | Mingguan | 7 days |
| `monthly` | Bulanan | 1 month |
| `quarterly` | 3 Bulanan | 3 months |
| `semi_annual` | 6 Bulanan | 6 months |
| `annual` | Tahunan | 12 months |

### Next Due Date Computation

Given `current_due_date` and `frequency`, advance to next cycle:

```
daily        → +1 day
weekly       → +7 days
monthly      → +1 month (same day)
quarterly    → +3 months
semi_annual  → +6 months
annual       → +12 months
```

On creation, `next_due_date` = `start_date`. If `start_date` is in the past, advance until `next_due_date >= today`.

### Monthly Cost Normalization (approximate)

For the summary card, normalize all frequencies to monthly equivalent:

```
daily        → amount × 30  (approximate)
weekly       → amount × 4.33
monthly      → amount
quarterly    → amount / 3
semi_annual  → amount / 6
annual       → amount / 12
```

## TypeScript Type

```typescript
// src/lib/types/subscription.ts
export interface Subscription {
  id: string;
  family_id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  category_id: string | null;
  account_id: string | null;
  start_date: string;
  next_due_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const FREQUENCY_LABELS: Record<Subscription['frequency'], string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  quarterly: '3 Bulanan',
  semi_annual: '6 Bulanan',
  annual: 'Tahunan'
};

export const MONTHLY_MULTIPLIER: Record<Subscription['frequency'], number> = {
  daily: 30,
  weekly: 4.33,
  monthly: 1,
  quarterly: 1 / 3,
  semi_annual: 1 / 6,
  annual: 1 / 12
};
```

## Pages & Components

All internal links use `resolve()` from `$app/paths`.

### 1. Plan Page Summary Card (`/plan`)

**Changes to**: `src/routes/plan/+page.server.ts` and `+page.svelte`

Server loader adds:
- `subscriptions`: all active subscriptions for the family
- `subscriptionSummary`: `{ monthlyTotal, activeCount, upcoming }` where upcoming = due within 7 days

UI: A card between the divider and Education link:
- Card style: `rounded-2xl border border-primary/10 bg-primary/5 p-4` (matches existing Plan page pattern)
- Shows total normalized monthly cost + active count
- Upcoming due badges (warning color for ≤3 days, neutral for ≤7 days)
- Tap navigates to `/plan/subscriptions`
- Hidden if no active subscriptions

### 2. Subscription List (`/plan/subscriptions`)

**New files**: `src/routes/plan/subscriptions/+page.server.ts` and `+page.svelte`

Server loader: Query all subscriptions for the family, join `categories(name)` and `accounts(name)`.

UI sections:
- Header: "Langganan" + "+ Tambah" button (links to `/plan/subscriptions/new`)
- Tab filter: Aktif / Nonaktif (client-side filter)
- List items, each showing:
  - Category color circle with first letter of subscription name
  - Subscription name
  - Frequency badge (pill): `text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary`
  - Next due date (warning color if ≤3 days)
  - Amount
- Tap item → `/plan/subscriptions/[id]`
- Empty state: "Belum ada langganan. Tap + untuk menambah."

### 3. Create Subscription (`/plan/subscriptions/new`)

**New files**: `src/routes/plan/subscriptions/new/+page.server.ts` and `+page.svelte`

Server loader: Not needed — `categories` and `accounts` available from parent `+layout.server.ts`.

Form fields:
- `name` — text input, required
- `amount` — number input, required
- `frequency` — select with 6 options
- `category_id` — select from family categories (optional)
- `account_id` — select from family accounts (optional)
- `start_date` — date input, required, defaults to today
- `notes` — textarea (optional)

Form action (`default`):
1. Validate required fields
2. Compute `next_due_date` from `start_date` (advance if past)
3. Insert into `subscriptions` with `user_id = user.id`
4. Redirect to `/plan/subscriptions`

### 4. Edit/Delete Subscription (`/plan/subscriptions/[id]`)

**New files**: `src/routes/plan/subscriptions/[id]/+page.server.ts` and `+page.svelte`

Server loader: Fetch subscription by id (verify family ownership via RLS).

Form actions:
- `?/update` — Update all fields + toggle `is_active`. Recompute `next_due_date` only when `frequency` or `start_date` is modified.
- `?/delete` — Delete with confirmation modal

Same form fields as create, plus:
- Active/inactive toggle (daisyUI toggle)
- Delete button at bottom (opens confirmation modal)

### 5. Push Notification Reminder

**New worker**: `workers/arsa-subscriptions/` — separate lightweight Cloudflare Worker with daily cron.

Rationale: The existing `arsa-monthly` worker runs `0 1 1 * *` (1st of month). Adding a daily cron would require branching logic in `scheduled()`. A separate worker is cleaner and independently deployable.

**Wrangler config** (`workers/arsa-subscriptions/wrangler.jsonc`):
```jsonc
{
  "name": "arsa-subscriptions",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "triggers": {
    "crons": ["0 0 * * *"]  // 07:00 WIB (UTC+7) daily
  }
}
```

**Environment secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`

**Worker logic**:
1. Query: `SELECT * FROM subscriptions WHERE is_active = true AND next_due_date <= CURRENT_DATE`
   - Uses `<=` instead of `=` to catch missed days (worker downtime)
2. For each due subscription:
   a. Look up `push_subscriptions` for the subscription's `user_id`
   b. Send push notification with VAPID auth: "Langganan {name} jatuh tempo hari ini — Rp {amount}"
   c. Advance `next_due_date` to next cycle using frequency logic
   d. Update `updated_at`
3. Uses `SERVICE_ROLE_KEY` to bypass RLS for both read and write

**Date advance SQL** (per subscription):
```sql
UPDATE subscriptions
SET next_due_date = CASE frequency
  WHEN 'daily' THEN next_due_date + INTERVAL '1 day'
  WHEN 'weekly' THEN next_due_date + INTERVAL '7 days'
  WHEN 'monthly' THEN next_due_date + INTERVAL '1 month'
  WHEN 'quarterly' THEN next_due_date + INTERVAL '3 months'
  WHEN 'semi_annual' THEN next_due_date + INTERVAL '6 months'
  WHEN 'annual' THEN next_due_date + INTERVAL '1 year'
END,
updated_at = now()
WHERE id = $1;
```

If the advanced `next_due_date` is still `<= today` (e.g., daily subscription missed 3 days), loop the advance until future.

## Edge Cases

- **Past start_date**: Auto-advance `next_due_date` until it's today or future
- **Inactive subscriptions**: Excluded from summary card and worker query, shown in "Nonaktif" tab on list page
- **No subscriptions**: Summary card hidden on Plan page, empty state on list page
- **Deleted category/account**: FK SET NULL, subscription persists with null references
- **Frequency/start_date change on edit**: Recompute `next_due_date` only when `frequency` or `start_date` is modified
- **Worker downtime**: Query uses `<= CURRENT_DATE` to catch all past-due subscriptions, loop-advance to future
- **Admin override**: Admin can edit/delete any family member's subscription; members can only edit/delete their own
