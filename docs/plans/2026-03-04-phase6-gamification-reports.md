# Phase 6: Gamification & Monthly Reports — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a family-wide gamification system (points, rewards, challenges) and automated monthly email reports, all driven by a single Cloudflare Worker cron job.

**Architecture:** 5 new DB tables replace the thin `gamification` table. A Cloudflare Worker (`arsa-monthly-worker`) runs on the 1st of each month to evaluate point rules and send detailed HTML email reports via Resend API. SvelteKit pages provide UI for leaderboards, reward catalog, and point history.

**Tech Stack:** Supabase PostgreSQL (RLS), Cloudflare Workers (cron), Resend API, SvelteKit (Svelte 5 runes), daisyUI v5, TypeScript

**Design doc:** `docs/plans/2026-03-04-phase6-gamification-reports-design.md`

**Prerequisites:** Phases 1-5 must be complete (auth, transactions, categories, investments, market_rates all exist).

---

### Task 1: Database Migration — Drop Old Gamification Table

**Files:**
- Create: `supabase/migrations/006_phase6_drop_old_gamification.sql`

**Step 1: Write the migration**

```sql
-- Phase 6: Drop the old single-row gamification table
-- It will be replaced by the new per-user gamification + supporting tables

drop policy if exists "family access" on gamification;
alter table gamification disable row level security;
drop table if exists gamification;
```

**Step 2: Run the migration**

Run in Supabase Dashboard → SQL Editor, or:
```bash
supabase db push
```

Expected: Old `gamification` table dropped. No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/006_phase6_drop_old_gamification.sql
git commit -m "chore: drop old gamification table for Phase 6 rebuild"
```

---

### Task 2: Database Migration — Create Gamification Tables

**Files:**
- Create: `supabase/migrations/007_phase6_gamification_tables.sql`

**Step 1: Write the migration**

```sql
-- Phase 6: Gamification tables

-- point_rules: defines how points are earned
create table point_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  rule_type text not null check (rule_type in ('budget_discipline', 'daily_logging', 'savings_milestone', 'custom_challenge')),
  name text not null,
  description text,
  points_value integer not null default 10,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references users on delete cascade,
  created_at timestamptz default now()
);

-- point_events: audit log of every point change
create table point_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references users on delete cascade,
  rule_id uuid references point_rules on delete set null,
  points integer not null,
  description text not null,
  month date not null,
  created_at timestamptz default now()
);

-- rewards: catalog with approval workflow
create table rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  description text,
  point_cost integer not null,
  proposed_by uuid not null references users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references users on delete set null,
  created_at timestamptz default now()
);

-- reward_redemptions: tracks who redeemed what
create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  reward_id uuid not null references rewards on delete cascade,
  redeemed_by uuid not null references users on delete cascade,
  points_spent integer not null,
  redeemed_at timestamptz default now(),
  fulfilled boolean not null default false
);

-- gamification: per-user running totals and streaks
create table gamification (
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references users on delete cascade,
  current_points integer not null default 0,
  streak_days integer not null default 0,
  last_log_date date,
  primary key (family_id, user_id)
);

-- indexes for common queries
create index idx_point_events_family_month on point_events (family_id, month);
create index idx_point_events_user_month on point_events (user_id, month);
create index idx_point_rules_family on point_rules (family_id);
create index idx_rewards_family_status on rewards (family_id, status);
create index idx_reward_redemptions_family on reward_redemptions (family_id);

-- unique constraint: prevent duplicate point awards for same rule+user+month
create unique index idx_point_events_dedup on point_events (rule_id, user_id, month) where rule_id is not null;
```

**Step 2: Run the migration**

Run in Supabase Dashboard → SQL Editor.

Expected: 5 tables + 6 indexes created. No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/007_phase6_gamification_tables.sql
git commit -m "feat: create Phase 6 gamification tables"
```

---

### Task 3: Database Migration — RLS Policies for Gamification Tables

**Files:**
- Create: `supabase/migrations/008_phase6_rls.sql`

**Step 1: Write the RLS migration**

```sql
-- Phase 6: RLS policies for gamification tables

-- Enable RLS
alter table point_rules enable row level security;
alter table point_events enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table gamification enable row level security;

-- point_rules: family members can read, admin can write
create policy "family can view point_rules"
  on point_rules for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "admin can manage point_rules"
  on point_rules for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

create policy "admin can update point_rules"
  on point_rules for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

create policy "admin can delete point_rules"
  on point_rules for delete
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- point_events: family can read (Worker writes via SERVICE_ROLE_KEY)
create policy "family can view point_events"
  on point_events for select
  using (family_id = (select family_id from users where id = auth.uid()));

-- rewards: family can read, anyone can propose, admin can update status
create policy "family can view rewards"
  on rewards for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "family members can propose rewards"
  on rewards for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and proposed_by = auth.uid()
  );

create policy "admin can update rewards"
  on rewards for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- reward_redemptions: family can read, members can insert own redemptions
create policy "family can view redemptions"
  on reward_redemptions for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "members can redeem rewards"
  on reward_redemptions for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and redeemed_by = auth.uid()
  );

create policy "admin can update redemptions"
  on reward_redemptions for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- gamification: family can read (Worker writes via SERVICE_ROLE_KEY)
create policy "family can view gamification"
  on gamification for select
  using (family_id = (select family_id from users where id = auth.uid()));
```

**Step 2: Run the migration**

Run in Supabase Dashboard → SQL Editor.

Expected: All policies created. No errors.

**Step 3: Commit**

```bash
git add supabase/migrations/008_phase6_rls.sql
git commit -m "feat: add RLS policies for Phase 6 gamification tables"
```

---

### Task 4: TypeScript Types for Gamification

**Files:**
- Create: `arsa-app/src/lib/types/gamification.ts`

**Step 1: Write the type definitions**

```typescript
export type RuleType = 'budget_discipline' | 'daily_logging' | 'savings_milestone' | 'custom_challenge';
export type RewardStatus = 'pending' | 'approved' | 'rejected';

export interface PointRule {
  id: string;
  family_id: string;
  rule_type: RuleType;
  name: string;
  description: string | null;
  points_value: number;
  config: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface PointEvent {
  id: string;
  family_id: string;
  user_id: string;
  rule_id: string | null;
  points: number;
  description: string;
  month: string;
  created_at: string;
}

export interface Reward {
  id: string;
  family_id: string;
  name: string;
  description: string | null;
  point_cost: number;
  proposed_by: string;
  status: RewardStatus;
  approved_by: string | null;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  family_id: string;
  reward_id: string;
  redeemed_by: string;
  points_spent: number;
  redeemed_at: string;
  fulfilled: boolean;
}

export interface GamificationProfile {
  family_id: string;
  user_id: string;
  current_points: number;
  streak_days: number;
  last_log_date: string | null;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  current_points: number;
  streak_days: number;
  points_this_month: number;
}
```

**Step 2: Commit**

```bash
git add arsa-app/src/lib/types/gamification.ts
git commit -m "feat: add TypeScript types for gamification"
```

---

### Task 5: Gamification Dashboard Page — Server Load

**Files:**
- Create: `arsa-app/src/routes/gamification/+page.server.ts`

**Depends on:** Phase 1 auth (hooks.server.ts, session in locals) must be working.

**Step 1: Write the load function**

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.safeGetSession();
  if (!session.session) redirect(303, '/login');

  const supabase = locals.supabase;
  const userId = session.session.user.id;

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, display_name')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) redirect(303, '/onboarding');

  const familyId = profile.family_id;
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const [gamificationRes, leaderboardRes, recentEventsRes] = await Promise.all([
    supabase
      .from('gamification')
      .select('*')
      .eq('family_id', familyId)
      .eq('user_id', userId)
      .single(),

    supabase
      .from('gamification')
      .select('user_id, current_points, streak_days, users!inner(display_name)')
      .eq('family_id', familyId)
      .order('current_points', { ascending: false }),

    supabase
      .from('point_events')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const pointsThisMonthRes = await supabase
    .from('point_events')
    .select('user_id, points')
    .eq('family_id', familyId)
    .eq('month', firstOfMonth);

  const pointsByUser: Record<string, number> = {};
  for (const evt of pointsThisMonthRes.data ?? []) {
    pointsByUser[evt.user_id] = (pointsByUser[evt.user_id] ?? 0) + evt.points;
  }

  const leaderboard = (leaderboardRes.data ?? []).map((row: any) => ({
    user_id: row.user_id,
    display_name: row.users?.display_name ?? 'Unknown',
    current_points: row.current_points,
    streak_days: row.streak_days,
    points_this_month: pointsByUser[row.user_id] ?? 0,
  }));

  return {
    myProfile: gamificationRes.data,
    leaderboard,
    recentEvents: recentEventsRes.data ?? [],
    userId,
  };
};
```

**Step 2: Commit**

```bash
git add arsa-app/src/routes/gamification/+page.server.ts
git commit -m "feat: add gamification dashboard server load"
```

---

### Task 6: Gamification Dashboard Page — UI

**Files:**
- Create: `arsa-app/src/routes/gamification/+page.svelte`
- Create: `arsa-app/src/lib/components/LeaderboardTable.svelte`
- Create: `arsa-app/src/lib/components/PointEventItem.svelte`
- Create: `arsa-app/src/lib/components/StreakIndicator.svelte`
- Create: `arsa-app/src/lib/components/PointsBadge.svelte`

**Step 1: Create PointsBadge component**

`arsa-app/src/lib/components/PointsBadge.svelte`:
```svelte
<script lang="ts">
  let { points }: { points: number } = $props();
</script>

<span class="badge badge-primary badge-sm">{points} pts</span>
```

**Step 2: Create StreakIndicator component**

`arsa-app/src/lib/components/StreakIndicator.svelte`:
```svelte
<script lang="ts">
  let { days }: { days: number } = $props();
</script>

{#if days > 0}
  <span class="text-warning font-bold">{days}d streak</span>
{:else}
  <span class="text-base-content/40">No streak</span>
{/if}
```

**Step 3: Create PointEventItem component**

`arsa-app/src/lib/components/PointEventItem.svelte`:
```svelte
<script lang="ts">
  import type { PointEvent } from '$lib/types/gamification';

  let { event }: { event: PointEvent } = $props();

  const dateStr = new Date(event.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
</script>

<div class="flex items-center justify-between py-2">
  <div>
    <p class="text-sm">{event.description}</p>
    <p class="text-xs text-base-content/50">{dateStr}</p>
  </div>
  <span class={event.points > 0 ? 'text-success font-bold' : 'text-error font-bold'}>
    {event.points > 0 ? '+' : ''}{event.points}
  </span>
</div>
```

**Step 4: Create LeaderboardTable component**

`arsa-app/src/lib/components/LeaderboardTable.svelte`:
```svelte
<script lang="ts">
  import type { LeaderboardEntry } from '$lib/types/gamification';

  let { entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string } = $props();
</script>

<div class="overflow-x-auto">
  <table class="table table-sm">
    <thead>
      <tr>
        <th>#</th>
        <th>Member</th>
        <th>This Month</th>
        <th>Total</th>
        <th>Streak</th>
      </tr>
    </thead>
    <tbody>
      {#each entries as entry, i}
        <tr class={entry.user_id === currentUserId ? 'bg-primary/10' : ''}>
          <td>{i + 1}</td>
          <td>{entry.display_name}</td>
          <td class="text-success">{entry.points_this_month}</td>
          <td>{entry.current_points}</td>
          <td>{entry.streak_days > 0 ? `${entry.streak_days}d` : '-'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

**Step 5: Create the gamification page**

`arsa-app/src/routes/gamification/+page.svelte`:
```svelte
<script lang="ts">
  import LeaderboardTable from '$lib/components/LeaderboardTable.svelte';
  import PointEventItem from '$lib/components/PointEventItem.svelte';
  import StreakIndicator from '$lib/components/StreakIndicator.svelte';

  let { data } = $props();
</script>

<div class="flex flex-col gap-4">
  <h2 class="text-xl font-bold">Gamification</h2>

  <!-- Stats row -->
  <div class="stats stats-horizontal w-full shadow">
    <div class="stat">
      <div class="stat-title">Your Points</div>
      <div class="stat-value text-primary">{data.myProfile?.current_points ?? 0}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Streak</div>
      <div class="stat-value">
        <StreakIndicator days={data.myProfile?.streak_days ?? 0} />
      </div>
    </div>
  </div>

  <!-- Leaderboard -->
  <div class="card bg-base-200">
    <div class="card-body p-4">
      <h3 class="card-title text-base">Leaderboard</h3>
      <LeaderboardTable entries={data.leaderboard} currentUserId={data.userId} />
    </div>
  </div>

  <!-- Recent activity -->
  <div class="card bg-base-200">
    <div class="card-body p-4">
      <h3 class="card-title text-base">Recent Activity</h3>
      {#if data.recentEvents.length === 0}
        <p class="text-sm text-base-content/50">No point events yet.</p>
      {:else}
        <div class="divide-y divide-base-300">
          {#each data.recentEvents as event}
            <PointEventItem {event} />
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Navigation links -->
  <div class="flex gap-2">
    <a href="/gamification/rewards" class="btn btn-outline btn-sm flex-1">Rewards</a>
    <a href="/gamification/history" class="btn btn-outline btn-sm flex-1">History</a>
  </div>
</div>
```

**Step 6: Commit**

```bash
git add arsa-app/src/lib/components/PointsBadge.svelte arsa-app/src/lib/components/StreakIndicator.svelte arsa-app/src/lib/components/PointEventItem.svelte arsa-app/src/lib/components/LeaderboardTable.svelte arsa-app/src/routes/gamification/+page.svelte
git commit -m "feat: add gamification dashboard page and components"
```

---

### Task 7: Rewards Catalog Page — Server Load & Actions

**Files:**
- Create: `arsa-app/src/routes/gamification/rewards/+page.server.ts`

**Step 1: Write the load function and form actions**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.safeGetSession();
  if (!session.session) redirect(303, '/login');

  const supabase = locals.supabase;
  const userId = session.session.user.id;

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) redirect(303, '/onboarding');

  const [approvedRes, pendingRes, myPointsRes] = await Promise.all([
    supabase
      .from('rewards')
      .select('*')
      .eq('family_id', profile.family_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),

    supabase
      .from('rewards')
      .select('*, users!proposed_by(display_name)')
      .eq('family_id', profile.family_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    supabase
      .from('gamification')
      .select('current_points')
      .eq('family_id', profile.family_id)
      .eq('user_id', userId)
      .single(),
  ]);

  return {
    approvedRewards: approvedRes.data ?? [],
    pendingRewards: pendingRes.data ?? [],
    myPoints: myPointsRes.data?.current_points ?? 0,
    isAdmin: profile.role === 'admin',
    userId,
    familyId: profile.family_id,
  };
};

export const actions: Actions = {
  propose: async ({ request, locals }) => {
    const session = await locals.safeGetSession();
    if (!session.session) return fail(401, { error: 'Not authenticated' });

    const supabase = locals.supabase;
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const pointCost = parseInt(formData.get('point_cost') as string, 10);

    if (!name || !pointCost || pointCost < 1) {
      return fail(400, { error: 'Name and valid point cost required.' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', session.session.user.id)
      .single();

    if (!profile?.family_id) return fail(400, { error: 'No family.' });

    const { error } = await supabase.from('rewards').insert({
      family_id: profile.family_id,
      name,
      description: description || null,
      point_cost: pointCost,
      proposed_by: session.session.user.id,
    });

    if (error) return fail(500, { error: error.message });
    return { success: true };
  },

  approve: async ({ request, locals }) => {
    const session = await locals.safeGetSession();
    if (!session.session) return fail(401, { error: 'Not authenticated' });

    const supabase = locals.supabase;
    const formData = await request.formData();
    const rewardId = formData.get('reward_id') as string;
    const pointCost = parseInt(formData.get('point_cost') as string, 10);

    const { error } = await supabase
      .from('rewards')
      .update({
        status: 'approved',
        approved_by: session.session.user.id,
        point_cost: pointCost,
      })
      .eq('id', rewardId);

    if (error) return fail(500, { error: error.message });
    return { success: true };
  },

  reject: async ({ request, locals }) => {
    const session = await locals.safeGetSession();
    if (!session.session) return fail(401, { error: 'Not authenticated' });

    const supabase = locals.supabase;
    const formData = await request.formData();
    const rewardId = formData.get('reward_id') as string;

    const { error } = await supabase
      .from('rewards')
      .update({ status: 'rejected', approved_by: session.session.user.id })
      .eq('id', rewardId);

    if (error) return fail(500, { error: error.message });
    return { success: true };
  },

  redeem: async ({ request, locals }) => {
    const session = await locals.safeGetSession();
    if (!session.session) return fail(401, { error: 'Not authenticated' });

    const supabase = locals.supabase;
    const userId = session.session.user.id;
    const formData = await request.formData();
    const rewardId = formData.get('reward_id') as string;

    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (!profile?.family_id) return fail(400, { error: 'No family.' });

    const { data: reward } = await supabase
      .from('rewards')
      .select('point_cost')
      .eq('id', rewardId)
      .eq('status', 'approved')
      .single();

    if (!reward) return fail(404, { error: 'Reward not found.' });

    const { data: gam } = await supabase
      .from('gamification')
      .select('current_points')
      .eq('family_id', profile.family_id)
      .eq('user_id', userId)
      .single();

    if (!gam || gam.current_points < reward.point_cost) {
      return fail(400, { error: `Need ${reward.point_cost} points. You have ${gam?.current_points ?? 0}.` });
    }

    const { error: redeemError } = await supabase.from('reward_redemptions').insert({
      family_id: profile.family_id,
      reward_id: rewardId,
      redeemed_by: userId,
      points_spent: reward.point_cost,
    });

    if (redeemError) return fail(500, { error: redeemError.message });

    const { error: eventError } = await supabase.from('point_events').insert({
      family_id: profile.family_id,
      user_id: userId,
      points: -reward.point_cost,
      description: `Redeemed: ${rewardId}`,
      month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    });

    if (eventError) return fail(500, { error: eventError.message });

    await supabase
      .from('gamification')
      .update({ current_points: gam.current_points - reward.point_cost })
      .eq('family_id', profile.family_id)
      .eq('user_id', userId);

    return { success: true };
  },
};
```

**Step 2: Commit**

```bash
git add arsa-app/src/routes/gamification/rewards/+page.server.ts
git commit -m "feat: add rewards catalog server load and form actions"
```

---

### Task 8: Rewards Catalog Page — UI

**Files:**
- Create: `arsa-app/src/routes/gamification/rewards/+page.svelte`
- Create: `arsa-app/src/lib/components/RewardCard.svelte`
- Create: `arsa-app/src/lib/components/RewardProposalModal.svelte`

**Step 1: Create RewardCard component**

`arsa-app/src/lib/components/RewardCard.svelte`:
```svelte
<script lang="ts">
  import type { Reward } from '$lib/types/gamification';

  let { reward, myPoints, canRedeem = true }: { reward: Reward; myPoints: number; canRedeem?: boolean } = $props();

  const affordable = myPoints >= reward.point_cost;
</script>

<div class="card bg-base-100 shadow-sm">
  <div class="card-body p-4">
    <h3 class="card-title text-sm">{reward.name}</h3>
    {#if reward.description}
      <p class="text-xs text-base-content/60">{reward.description}</p>
    {/if}
    <div class="card-actions mt-2 items-center justify-between">
      <span class="badge badge-secondary">{reward.point_cost} pts</span>
      {#if canRedeem}
        <form method="POST" action="?/redeem">
          <input type="hidden" name="reward_id" value={reward.id} />
          <button class="btn btn-primary btn-xs" disabled={!affordable}>
            {affordable ? 'Redeem' : `Need ${reward.point_cost - myPoints} more`}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
```

**Step 2: Create RewardProposalModal component**

`arsa-app/src/lib/components/RewardProposalModal.svelte`:
```svelte
<script lang="ts">
  let { open = $bindable(false) }: { open: boolean } = $props();
</script>

<dialog class="modal" class:modal-open={open}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">Propose a Reward</h3>
    <form method="POST" action="?/propose" class="flex flex-col gap-3 pt-4">
      <label class="floating-label">
        <span>Reward Name</span>
        <input name="name" type="text" placeholder="Reward Name" class="input input-bordered w-full" required />
      </label>
      <label class="floating-label">
        <span>Description</span>
        <textarea name="description" placeholder="Description" class="textarea textarea-bordered w-full"></textarea>
      </label>
      <label class="floating-label">
        <span>Point Cost</span>
        <input name="point_cost" type="number" min="1" placeholder="Point Cost" class="input input-bordered w-full" required />
      </label>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Cancel</button>
        <button type="submit" class="btn btn-primary">Propose</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={() => (open = false)}>close</button>
  </form>
</dialog>
```

**Step 3: Create the rewards page**

`arsa-app/src/routes/gamification/rewards/+page.svelte`:
```svelte
<script lang="ts">
  import RewardCard from '$lib/components/RewardCard.svelte';
  import RewardProposalModal from '$lib/components/RewardProposalModal.svelte';
  import PointsBadge from '$lib/components/PointsBadge.svelte';

  let { data } = $props();
  let activeTab: 'catalog' | 'pending' = $state('catalog');
  let showProposalModal = $state(false);
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Rewards</h2>
    <PointsBadge points={data.myPoints} />
  </div>

  <!-- Tabs -->
  <div role="tablist" class="tabs tabs-bordered">
    <button role="tab" class="tab" class:tab-active={activeTab === 'catalog'} onclick={() => (activeTab = 'catalog')}>
      Catalog
    </button>
    {#if data.isAdmin}
      <button role="tab" class="tab" class:tab-active={activeTab === 'pending'} onclick={() => (activeTab = 'pending')}>
        Pending
        {#if data.pendingRewards.length > 0}
          <span class="badge badge-warning badge-xs ml-1">{data.pendingRewards.length}</span>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Catalog tab -->
  {#if activeTab === 'catalog'}
    {#if data.approvedRewards.length === 0}
      <p class="text-sm text-base-content/50">No rewards yet. Propose one!</p>
    {:else}
      <div class="grid grid-cols-1 gap-3">
        {#each data.approvedRewards as reward}
          <RewardCard {reward} myPoints={data.myPoints} />
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Pending tab (admin only) -->
  {#if activeTab === 'pending' && data.isAdmin}
    {#if data.pendingRewards.length === 0}
      <p class="text-sm text-base-content/50">No pending proposals.</p>
    {:else}
      <div class="flex flex-col gap-3">
        {#each data.pendingRewards as reward}
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="text-sm font-bold">{reward.name}</h3>
              {#if reward.description}
                <p class="text-xs text-base-content/60">{reward.description}</p>
              {/if}
              <p class="text-xs text-base-content/50">
                Proposed by {reward.users?.display_name ?? 'Unknown'}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <form method="POST" action="?/approve" class="flex items-center gap-1">
                  <input type="hidden" name="reward_id" value={reward.id} />
                  <input name="point_cost" type="number" value={reward.point_cost} min="1"
                    class="input input-bordered input-xs w-20" />
                  <button class="btn btn-success btn-xs">Approve</button>
                </form>
                <form method="POST" action="?/reject">
                  <input type="hidden" name="reward_id" value={reward.id} />
                  <button class="btn btn-error btn-xs">Reject</button>
                </form>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Propose button -->
  <button class="btn btn-primary btn-sm" onclick={() => (showProposalModal = true)}>
    Propose Reward
  </button>

  <RewardProposalModal bind:open={showProposalModal} />

  <a href="/gamification" class="btn btn-ghost btn-sm">Back to Dashboard</a>
</div>
```

**Step 4: Commit**

```bash
git add arsa-app/src/lib/components/RewardCard.svelte arsa-app/src/lib/components/RewardProposalModal.svelte arsa-app/src/routes/gamification/rewards/+page.svelte
git commit -m "feat: add rewards catalog page with proposal and redemption UI"
```

---

### Task 9: Point History Page

**Files:**
- Create: `arsa-app/src/routes/gamification/history/+page.server.ts`
- Create: `arsa-app/src/routes/gamification/history/+page.svelte`

**Step 1: Write the server load function**

`arsa-app/src/routes/gamification/history/+page.server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals.safeGetSession();
  if (!session.session) redirect(303, '/login');

  const supabase = locals.supabase;
  const userId = session.session.user.id;

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) redirect(303, '/onboarding');

  const filterUser = url.searchParams.get('user') || null;
  const filterMonth = url.searchParams.get('month') || null;

  let query = supabase
    .from('point_events')
    .select('*, users!user_id(display_name)')
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (filterUser) query = query.eq('user_id', filterUser);
  if (filterMonth) query = query.eq('month', filterMonth);

  const [eventsRes, membersRes] = await Promise.all([
    query,
    supabase
      .from('users')
      .select('id, display_name')
      .eq('family_id', profile.family_id),
  ]);

  return {
    events: eventsRes.data ?? [],
    members: membersRes.data ?? [],
    filterUser,
    filterMonth,
  };
};
```

**Step 2: Write the page UI**

`arsa-app/src/routes/gamification/history/+page.svelte`:
```svelte
<script lang="ts">
  import PointEventItem from '$lib/components/PointEventItem.svelte';

  let { data } = $props();
</script>

<div class="flex flex-col gap-4">
  <h2 class="text-xl font-bold">Point History</h2>

  <!-- Filters -->
  <form method="GET" class="flex gap-2">
    <select name="user" class="select select-bordered select-sm flex-1">
      <option value="">All members</option>
      {#each data.members as member}
        <option value={member.id} selected={data.filterUser === member.id}>
          {member.display_name}
        </option>
      {/each}
    </select>
    <input
      name="month"
      type="month"
      class="input input-bordered input-sm flex-1"
      value={data.filterMonth ?? ''}
    />
    <button class="btn btn-primary btn-sm">Filter</button>
  </form>

  <!-- Events list -->
  {#if data.events.length === 0}
    <p class="text-sm text-base-content/50">No events found.</p>
  {:else}
    <div class="divide-y divide-base-300">
      {#each data.events as event}
        <div class="flex items-center gap-2">
          <span class="badge badge-ghost badge-xs">{event.users?.display_name ?? ''}</span>
          <div class="flex-1">
            <PointEventItem {event} />
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <a href="/gamification" class="btn btn-ghost btn-sm">Back to Dashboard</a>
</div>
```

**Step 3: Commit**

```bash
git add arsa-app/src/routes/gamification/history/+page.server.ts arsa-app/src/routes/gamification/history/+page.svelte
git commit -m "feat: add point history page with user and month filters"
```

---

### Task 10: Dashboard Widget Integration

**Files:**
- Modify: `arsa-app/src/routes/+page.svelte`
- Modify: `arsa-app/src/routes/+page.server.ts` (if exists from Phase 2, otherwise create)

**Step 1: Add gamification data to the home page load function**

If `+page.server.ts` already exists from Phase 2, add this to the existing load function. Otherwise create:

`arsa-app/src/routes/+page.server.ts`:
```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.safeGetSession();
  if (!session.session) return { gamification: null };

  const supabase = locals.supabase;
  const userId = session.session.user.id;

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) return { gamification: null };

  const { data } = await supabase
    .from('gamification')
    .select('current_points, streak_days')
    .eq('family_id', profile.family_id)
    .eq('user_id', userId)
    .single();

  return { gamification: data };
};
```

**Step 2: Add the widget to the home page**

Add to `arsa-app/src/routes/+page.svelte` (integrate with existing Phase 2 dashboard content):

```svelte
<script lang="ts">
  import StreakIndicator from '$lib/components/StreakIndicator.svelte';

  let { data } = $props();
</script>

<!-- existing dashboard content above -->

{#if data.gamification}
  <a href="/gamification" class="card bg-base-200 mt-4">
    <div class="card-body flex-row items-center justify-between p-4">
      <div>
        <p class="text-sm font-bold">Points</p>
        <p class="text-2xl font-bold text-primary">{data.gamification.current_points}</p>
      </div>
      <StreakIndicator days={data.gamification.streak_days} />
    </div>
  </a>
{/if}
```

**Step 3: Commit**

```bash
git add arsa-app/src/routes/+page.server.ts arsa-app/src/routes/+page.svelte
git commit -m "feat: add gamification widget to dashboard"
```

---

### Task 11: Cloudflare Worker — Project Scaffold

**Files:**
- Create: `workers/arsa-monthly/wrangler.jsonc`
- Create: `workers/arsa-monthly/package.json`
- Create: `workers/arsa-monthly/tsconfig.json`
- Create: `workers/arsa-monthly/src/index.ts` (entry point stub)

**Step 1: Create the worker project directory and files**

`workers/arsa-monthly/wrangler.jsonc`:
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

`workers/arsa-monthly/package.json`:
```json
{
  "name": "arsa-monthly-worker",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "wrangler": "^4.0.0",
    "typescript": "^5.9.3"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.98.0"
  }
}
```

`workers/arsa-monthly/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

`workers/arsa-monthly/src/index.ts`:
```typescript
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  WORKER_SECRET: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMonthlyJob(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = request.headers.get('X-Worker-Secret');
    if (secret !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
    await runMonthlyJob(env);
    return new Response('OK');
  },
};

async function runMonthlyJob(env: Env): Promise<void> {
  // implemented in subsequent tasks
  console.log('Monthly job triggered');
}
```

**Step 2: Install dependencies**

```bash
cd workers/arsa-monthly && npm install
```

**Step 3: Commit**

```bash
git add workers/arsa-monthly/
git commit -m "feat: scaffold arsa-monthly Cloudflare Worker"
```

---

### Task 12: Cloudflare Worker — Gamification Evaluation Logic

**Files:**
- Create: `workers/arsa-monthly/src/evaluate.ts`
- Modify: `workers/arsa-monthly/src/index.ts`

**Step 1: Write the evaluation module**

`workers/arsa-monthly/src/evaluate.ts`:
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface Family {
  id: string;
  name: string;
}

interface User {
  id: string;
  family_id: string;
  display_name: string;
}

interface PointRule {
  id: string;
  family_id: string;
  rule_type: string;
  points_value: number;
  config: Record<string, any>;
  is_active: boolean;
}

export async function evaluateFamily(
  supabase: SupabaseClient,
  family: Family,
  targetMonth: Date
): Promise<{ pointsAwarded: number; errors: string[] }> {
  const errors: string[] = [];
  let pointsAwarded = 0;

  const monthStr = targetMonth.toISOString().split('T')[0];
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  const { data: users } = await supabase
    .from('users')
    .select('id, family_id, display_name')
    .eq('family_id', family.id);

  if (!users || users.length === 0) return { pointsAwarded, errors };

  const { data: rules } = await supabase
    .from('point_rules')
    .select('*')
    .eq('family_id', family.id)
    .eq('is_active', true);

  if (!rules || rules.length === 0) return { pointsAwarded, errors };

  for (const rule of rules as PointRule[]) {
    try {
      const awarded = await evaluateRule(supabase, rule, users, family.id, monthStr, monthStart, monthEnd);
      pointsAwarded += awarded;
    } catch (e: any) {
      errors.push(`Rule ${rule.id}: ${e.message}`);
    }
  }

  // update running totals
  for (const user of users) {
    const { data: totalData } = await supabase
      .from('point_events')
      .select('points')
      .eq('family_id', family.id)
      .eq('user_id', user.id);

    const total = (totalData ?? []).reduce((sum: number, e: any) => sum + e.points, 0);

    await supabase
      .from('gamification')
      .upsert({
        family_id: family.id,
        user_id: user.id,
        current_points: total,
      }, { onConflict: 'family_id,user_id' });
  }

  // update streaks
  await updateStreaks(supabase, family.id, users, monthEnd);

  return { pointsAwarded, errors };
}

async function evaluateRule(
  supabase: SupabaseClient,
  rule: PointRule,
  users: User[],
  familyId: string,
  monthStr: string,
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  let awarded = 0;

  switch (rule.rule_type) {
    case 'budget_discipline': {
      const categoryId = rule.config.category_id as string;
      if (!categoryId) break;

      const { data: category } = await supabase
        .from('categories')
        .select('monthly_limit')
        .eq('id', categoryId)
        .single();

      if (!category?.monthly_limit) break;

      const { data: txns } = await supabase
        .from('transactions')
        .select('amount')
        .eq('family_id', familyId)
        .eq('category_id', categoryId)
        .eq('type', 'out')
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      const totalSpend = (txns ?? []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      if (totalSpend < Number(category.monthly_limit)) {
        for (const user of users) {
          const inserted = await insertPointEvent(supabase, {
            family_id: familyId,
            user_id: user.id,
            rule_id: rule.id,
            points: rule.points_value,
            description: `Budget discipline: stayed under limit`,
            month: monthStr,
          });
          if (inserted) awarded += rule.points_value;
        }
      }
      break;
    }

    case 'daily_logging': {
      const milestones = (rule.config.streak_milestones as number[]) ?? [7, 14, 30];
      for (const user of users) {
        const { data: txns } = await supabase
          .from('transactions')
          .select('date')
          .eq('user_id', user.id)
          .eq('family_id', familyId)
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', monthEnd.toISOString().split('T')[0]);

        const uniqueDays = new Set((txns ?? []).map((t: any) => t.date));
        const logDays = uniqueDays.size;

        for (const milestone of milestones) {
          if (logDays >= milestone) {
            const inserted = await insertPointEvent(supabase, {
              family_id: familyId,
              user_id: user.id,
              rule_id: rule.id,
              points: rule.points_value * (milestone / 7),
              description: `Logging streak: ${milestone} days`,
              month: monthStr,
            });
            if (inserted) awarded += rule.points_value * (milestone / 7);
          }
        }
      }
      break;
    }

    case 'savings_milestone': {
      const accountId = rule.config.account_id as string;
      const targetBalance = rule.config.target_balance as number;
      if (!accountId || !targetBalance) break;

      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .single();

      if (account && Number(account.balance) >= targetBalance) {
        for (const user of users) {
          const inserted = await insertPointEvent(supabase, {
            family_id: familyId,
            user_id: user.id,
            rule_id: rule.id,
            points: rule.points_value,
            description: `Savings milestone reached`,
            month: monthStr,
          });
          if (inserted) awarded += rule.points_value;
        }
      }
      break;
    }

    case 'custom_challenge': {
      const verify = rule.config.verify as string;
      if (verify === 'auto_category') {
        const categoryId = rule.config.category_id as string;
        const deadline = rule.config.deadline as string;
        if (!categoryId || !deadline) break;

        const { data: txns } = await supabase
          .from('transactions')
          .select('id')
          .eq('family_id', familyId)
          .eq('category_id', categoryId)
          .eq('type', 'out')
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', deadline);

        if (!txns || txns.length === 0) {
          for (const user of users) {
            const inserted = await insertPointEvent(supabase, {
              family_id: familyId,
              user_id: user.id,
              rule_id: rule.id,
              points: rule.points_value,
              description: `Challenge completed: ${rule.name}`,
              month: monthStr,
            });
            if (inserted) awarded += rule.points_value;
          }
        }
      }
      // manual challenges: points inserted via UI, not by worker
      break;
    }
  }

  return awarded;
}

async function insertPointEvent(
  supabase: SupabaseClient,
  event: {
    family_id: string;
    user_id: string;
    rule_id: string;
    points: number;
    description: string;
    month: string;
  }
): Promise<boolean> {
  const { error } = await supabase.from('point_events').insert(event);
  // unique constraint violation = already awarded, skip
  if (error?.code === '23505') return false;
  if (error) throw new Error(error.message);
  return true;
}

async function updateStreaks(
  supabase: SupabaseClient,
  familyId: string,
  users: User[],
  monthEnd: Date
): Promise<void> {
  for (const user of users) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', user.id)
      .eq('family_id', familyId)
      .order('date', { ascending: false })
      .limit(60);

    if (!txns || txns.length === 0) {
      await supabase
        .from('gamification')
        .update({ streak_days: 0, last_log_date: null })
        .eq('family_id', familyId)
        .eq('user_id', user.id);
      continue;
    }

    const dates = [...new Set(txns.map((t: any) => t.date))].sort().reverse();
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const curr = new Date(dates[i - 1]);
      const prev = new Date(dates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    await supabase
      .from('gamification')
      .update({ streak_days: streak, last_log_date: dates[0] })
      .eq('family_id', familyId)
      .eq('user_id', user.id);
  }
}
```

**Step 2: Commit**

```bash
git add workers/arsa-monthly/src/evaluate.ts
git commit -m "feat: add gamification evaluation logic for monthly worker"
```

---

### Task 13: Cloudflare Worker — Email Report Builder

**Files:**
- Create: `workers/arsa-monthly/src/email.ts`

**Step 1: Write the email template builder**

`workers/arsa-monthly/src/email.ts`:
```typescript
import { SupabaseClient } from '@supabase/supabase-js';

interface ReportData {
  familyName: string;
  month: string;
  year: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  prevMonthExpense: number;
  categories: { name: string; limit: number | null; spent: number }[];
  memberSpending: { name: string; spent: number }[];
  investments: { asset_code: string; asset_type: string; qty: number; avg_buy_price: number; current_price: number }[];
  leaderboard: { name: string; points_this_month: number; total_points: number; streak: number }[];
  redemptions: { name: string; reward_name: string }[];
  highlights: string[];
}

export async function buildReportData(
  supabase: SupabaseClient,
  familyId: string,
  targetMonth: Date
): Promise<ReportData> {
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  const prevMonthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
  const prevMonthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0);
  const monthStr = monthStart.toISOString().split('T')[0];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const { data: family } = await supabase
    .from('families')
    .select('name')
    .eq('id', familyId)
    .single();

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, type, category_id, user_id, merchant, is_private')
    .eq('family_id', familyId)
    .gte('date', monthStart.toISOString().split('T')[0])
    .lte('date', monthEnd.toISOString().split('T')[0]);

  const { data: prevTxns } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('family_id', familyId)
    .gte('date', prevMonthStart.toISOString().split('T')[0])
    .lte('date', prevMonthEnd.toISOString().split('T')[0]);

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, monthly_limit')
    .eq('family_id', familyId);

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('family_id', familyId);

  const { data: investments } = await supabase
    .from('investments')
    .select('asset_code, qty, avg_buy_price')
    .eq('family_id', familyId);

  const { data: marketRates } = await supabase
    .from('market_rates')
    .select('asset_code, asset_type, buy_price, sell_price');

  const { data: gamData } = await supabase
    .from('gamification')
    .select('user_id, current_points, streak_days')
    .eq('family_id', familyId);

  const { data: pointEvents } = await supabase
    .from('point_events')
    .select('user_id, points')
    .eq('family_id', familyId)
    .eq('month', monthStr);

  const { data: redemptions } = await supabase
    .from('reward_redemptions')
    .select('redeemed_by, rewards(name)')
    .eq('family_id', familyId)
    .gte('redeemed_at', monthStart.toISOString())
    .lte('redeemed_at', monthEnd.toISOString());

  const allTxns = txns ?? [];
  const totalIncome = allTxns.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = allTxns.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
  const prevMonthExpense = (prevTxns ?? []).filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);

  const catMap = new Map((categories ?? []).map(c => [c.id, c]));
  const catSpend: Record<string, number> = {};
  for (const t of allTxns.filter(t => t.type === 'out' && t.category_id)) {
    catSpend[t.category_id] = (catSpend[t.category_id] ?? 0) + Number(t.amount);
  }

  const categoryReport = (categories ?? []).map(c => ({
    name: c.name,
    limit: c.monthly_limit ? Number(c.monthly_limit) : null,
    spent: catSpend[c.id] ?? 0,
  })).sort((a, b) => b.spent - a.spent);

  const userMap = new Map((users ?? []).map(u => [u.id, u.display_name]));
  const memberSpend: Record<string, number> = {};
  for (const t of allTxns.filter(t => t.type === 'out')) {
    memberSpend[t.user_id] = (memberSpend[t.user_id] ?? 0) + Number(t.amount);
  }
  const memberSpending = (users ?? []).map(u => ({
    name: u.display_name,
    spent: memberSpend[u.id] ?? 0,
  }));

  const rateMap = new Map((marketRates ?? []).map(r => [r.asset_code, r]));
  const investmentReport = (investments ?? []).map(inv => {
    const rate = rateMap.get(inv.asset_code);
    return {
      asset_code: inv.asset_code,
      asset_type: rate?.asset_type ?? 'unknown',
      qty: Number(inv.qty),
      avg_buy_price: Number(inv.avg_buy_price),
      current_price: rate ? Number(rate.sell_price) : 0,
    };
  });

  const pointsByUser: Record<string, number> = {};
  for (const pe of pointEvents ?? []) {
    pointsByUser[pe.user_id] = (pointsByUser[pe.user_id] ?? 0) + pe.points;
  }

  const leaderboard = (gamData ?? []).map(g => ({
    name: userMap.get(g.user_id) ?? 'Unknown',
    points_this_month: pointsByUser[g.user_id] ?? 0,
    total_points: g.current_points,
    streak: g.streak_days,
  })).sort((a, b) => b.points_this_month - a.points_this_month);

  const redemptionReport = (redemptions ?? []).map((r: any) => ({
    name: userMap.get(r.redeemed_by) ?? 'Unknown',
    reward_name: r.rewards?.name ?? 'Unknown reward',
  }));

  // highlights
  const highlights: string[] = [];
  const biggestExpense = allTxns
    .filter(t => t.type === 'out')
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  if (biggestExpense) {
    const merchant = biggestExpense.is_private ? 'Private' : (biggestExpense.merchant ?? 'Unknown');
    highlights.push(`Pengeluaran terbesar: Rp${Number(biggestExpense.amount).toLocaleString('id-ID')} (${merchant})`);
  }

  const bestCategory = categoryReport.find(c => c.limit && c.spent < c.limit);
  if (bestCategory) {
    highlights.push(`Kategori terbaik: ${bestCategory.name} (${Math.round((bestCategory.spent / bestCategory.limit!) * 100)}% dari budget)`);
  }

  const topStreak = leaderboard.sort((a, b) => b.streak - a.streak)[0];
  if (topStreak && topStreak.streak > 0) {
    highlights.push(`Streak terpanjang: ${topStreak.name} (${topStreak.streak} hari)`);
  }

  return {
    familyName: family?.name ?? 'Keluarga',
    month: monthNames[targetMonth.getMonth()],
    year: targetMonth.getFullYear(),
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    prevMonthExpense,
    categories: categoryReport,
    memberSpending,
    investments: investmentReport,
    leaderboard: leaderboard.sort((a, b) => b.points_this_month - a.points_this_month),
    redemptions: redemptionReport,
    highlights,
  };
}

function formatRp(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

function changeIndicator(current: number, previous: number): string {
  if (previous === 0) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct > 0 ? ` ↑${pct}%` : pct < 0 ? ` ↓${Math.abs(pct)}%` : '';
}

function progressBar(pct: number): string {
  const filled = Math.min(Math.round(pct / 10), 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function buildEmailHtml(data: ReportData): string {
  const investmentRows = data.investments.map(inv => {
    const value = inv.qty * inv.current_price;
    const cost = inv.qty * inv.avg_buy_price;
    const pl = value - cost;
    const plColor = pl >= 0 ? '#22c55e' : '#ef4444';
    return `<tr>
      <td style="padding:4px 8px">${inv.asset_code}</td>
      <td style="padding:4px 8px">${inv.qty}</td>
      <td style="padding:4px 8px">${formatRp(inv.current_price)}</td>
      <td style="padding:4px 8px;color:${plColor}">${pl >= 0 ? '+' : ''}${formatRp(pl)}</td>
    </tr>`;
  }).join('');

  const categoryRows = data.categories.map(c => {
    const pct = c.limit ? Math.round((c.spent / c.limit) * 100) : 0;
    const status = c.limit ? (c.spent > c.limit ? '🔴' : '🟢') : '-';
    return `<tr>
      <td style="padding:4px 8px">${c.name}</td>
      <td style="padding:4px 8px">${c.limit ? formatRp(c.limit) : '-'}</td>
      <td style="padding:4px 8px">${formatRp(c.spent)}</td>
      <td style="padding:4px 8px">${c.limit ? `${progressBar(pct)} ${pct}%` : '-'}</td>
      <td style="padding:4px 8px">${status}</td>
    </tr>`;
  }).join('');

  const memberRows = data.memberSpending.map(m =>
    `<tr><td style="padding:4px 8px">${m.name}</td><td style="padding:4px 8px">${formatRp(m.spent)}</td></tr>`
  ).join('');

  const leaderboardRows = data.leaderboard.map((l, i) =>
    `<tr>
      <td style="padding:4px 8px">${i + 1}</td>
      <td style="padding:4px 8px">${l.name}</td>
      <td style="padding:4px 8px;color:#22c55e">+${l.points_this_month}</td>
      <td style="padding:4px 8px">${l.total_points}</td>
      <td style="padding:4px 8px">${l.streak > 0 ? `${l.streak}d` : '-'}</td>
    </tr>`
  ).join('');

  const redemptionItems = data.redemptions.length > 0
    ? data.redemptions.map(r => `<li>${r.name} → ${r.reward_name}</li>`).join('')
    : '<li>Tidak ada reward ditukar bulan ini</li>';

  const highlightItems = data.highlights.map(h => `<li>${h}</li>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">

  <!-- Header -->
  <tr><td style="background:#1a1a2e;color:#fff;padding:24px;text-align:center">
    <h1 style="margin:0;font-size:22px">Laporan Keluarga ${data.familyName}</h1>
    <p style="margin:4px 0 0;opacity:0.8">${data.month} ${data.year}</p>
  </td></tr>

  <!-- Cashflow Summary -->
  <tr><td style="padding:20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Ringkasan Cashflow</h2>
    <table width="100%">
      <tr><td>Pemasukan</td><td style="text-align:right;color:#22c55e;font-weight:bold">${formatRp(data.totalIncome)}</td></tr>
      <tr><td>Pengeluaran</td><td style="text-align:right;color:#ef4444;font-weight:bold">${formatRp(data.totalExpense)}${changeIndicator(data.totalExpense, data.prevMonthExpense)}</td></tr>
      <tr><td style="border-top:1px solid #eee;padding-top:8px"><strong>Tabungan Bersih</strong></td>
        <td style="text-align:right;border-top:1px solid #eee;padding-top:8px;font-weight:bold;color:${data.netSavings >= 0 ? '#22c55e' : '#ef4444'}">${formatRp(data.netSavings)}</td></tr>
    </table>
  </td></tr>

  <!-- Category Breakdown -->
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Pengeluaran per Kategori</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Kategori</th><th style="padding:4px 8px;text-align:left">Budget</th><th style="padding:4px 8px;text-align:left">Aktual</th><th style="padding:4px 8px;text-align:left">Progress</th><th style="padding:4px 8px">Status</th></tr>
      ${categoryRows}
    </table>
  </td></tr>

  <!-- Per-Member Spending -->
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Pengeluaran per Anggota</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Anggota</th><th style="padding:4px 8px;text-align:left">Total</th></tr>
      ${memberRows}
    </table>
  </td></tr>

  <!-- Investment Performance -->
  ${data.investments.length > 0 ? `
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Performa Investasi</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Aset</th><th style="padding:4px 8px;text-align:left">Qty</th><th style="padding:4px 8px;text-align:left">Harga</th><th style="padding:4px 8px;text-align:left">P/L</th></tr>
      ${investmentRows}
    </table>
  </td></tr>` : ''}

  <!-- Gamification Leaderboard -->
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Leaderboard Gamifikasi</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px">#</th><th style="padding:4px 8px;text-align:left">Anggota</th><th style="padding:4px 8px">Bulan Ini</th><th style="padding:4px 8px">Total</th><th style="padding:4px 8px">Streak</th></tr>
      ${leaderboardRows}
    </table>
    <p style="font-size:12px;color:#888;margin:8px 0 0">Reward ditukar:</p>
    <ul style="font-size:12px;color:#666;margin:4px 0 0;padding-left:20px">${redemptionItems}</ul>
  </td></tr>

  <!-- Highlights -->
  ${data.highlights.length > 0 ? `
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Highlights</h2>
    <ul style="font-size:13px;color:#333;padding-left:20px">${highlightItems}</ul>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#888">
    Generated by Arsa — Family Wealth & Lifestyle Manager
  </td></tr>

</table>
</body>
</html>`;
}

export async function sendReport(
  resendApiKey: string,
  to: string[],
  subject: string,
  html: string
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Arsa <arsa@resend.dev>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
```

**Step 2: Commit**

```bash
git add workers/arsa-monthly/src/email.ts
git commit -m "feat: add email report builder and Resend integration"
```

---

### Task 14: Cloudflare Worker — Wire Up Main Entry Point

**Files:**
- Modify: `workers/arsa-monthly/src/index.ts`

**Step 1: Update index.ts to wire evaluation + email together**

Replace the stub `runMonthlyJob` in `workers/arsa-monthly/src/index.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { evaluateFamily } from './evaluate';
import { buildReportData, buildEmailHtml, sendReport } from './email';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  WORKER_SECRET: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMonthlyJob(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = request.headers.get('X-Worker-Secret');
    if (secret !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await runMonthlyJob(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function runMonthlyJob(env: Env): Promise<Record<string, unknown>> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const { data: families, error: famError } = await supabase
    .from('families')
    .select('id, name');

  if (famError || !families) {
    return { error: `Failed to fetch families: ${famError?.message}` };
  }

  const results: Record<string, unknown> = {};

  for (const family of families) {
    try {
      // evaluate gamification
      const evalResult = await evaluateFamily(supabase, family, targetMonth);

      // build report
      const reportData = await buildReportData(supabase, family.id, targetMonth);
      const html = buildEmailHtml(reportData);

      // get family member emails
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', family.id);

      const emails: string[] = [];
      for (const user of users ?? []) {
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        if (authUser?.user?.email) emails.push(authUser.user.email);
      }

      if (emails.length > 0) {
        const subject = `Laporan Keluarga ${family.name} — ${monthNames[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`;
        await sendReport(env.RESEND_API_KEY, emails, subject, html);
      }

      results[family.id] = {
        name: family.name,
        pointsAwarded: evalResult.pointsAwarded,
        errors: evalResult.errors,
        emailsSent: emails.length,
      };
    } catch (e: any) {
      results[family.id] = {
        name: family.name,
        error: e.message,
      };
    }
  }

  return { processed: families.length, results };
}
```

**Step 2: Commit**

```bash
git add workers/arsa-monthly/src/index.ts
git commit -m "feat: wire up monthly worker entry point with evaluation and email"
```

---

### Task 15: Configure Worker Secrets and Deploy

**Step 1: Set secrets**

```bash
cd workers/arsa-monthly
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put WORKER_SECRET
```

Enter values when prompted.

**Step 2: Deploy**

```bash
npx wrangler deploy
```

Expected: Worker deployed with cron trigger `0 1 1 * *`.

**Step 3: Test manual trigger**

```bash
curl -H "X-Worker-Secret: YOUR_SECRET" https://arsa-monthly-worker.<your-subdomain>.workers.dev
```

Expected: JSON response with processing results.

**Step 4: Commit any config changes**

```bash
git add workers/arsa-monthly/
git commit -m "chore: deploy arsa-monthly worker"
```

---

### Task 16: Smoke Test — Full Flow Verification

**Step 1: Verify database tables**

In Supabase Dashboard → Table Editor, confirm these tables exist with correct columns:
- `point_rules`
- `point_events`
- `rewards`
- `reward_redemptions`
- `gamification`

**Step 2: Test gamification UI (dev server)**

```bash
cd arsa-app && npm run dev
```

1. Log in → navigate to `/gamification`
2. Verify stats show 0 points, no streak
3. Navigate to `/gamification/rewards` → propose a reward
4. As admin: approve the reward
5. Navigate to `/gamification/history` → verify empty state

**Step 3: Test worker manually**

Trigger the worker via HTTP with the secret header. Check:
- Supabase `point_events` table for new entries
- Email inbox for the monthly report
- Worker logs in Cloudflare dashboard for any errors

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: smoke test fixes for Phase 6"
```

---

Plan complete and saved to `docs/plans/2026-03-04-phase6-gamification-reports.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints

Which approach?