# Subscription Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription/recurring payment tracking to the Plan page with full CRUD, summary card, and daily push reminders.

**Architecture:** New `subscriptions` table (Supabase, RLS via `get_my_family_id()`). Plan page gets a summary card linking to `/plan/subscriptions` sub-route with list/create/edit/delete pages following the existing accounts CRUD pattern. A separate Cloudflare Worker runs daily cron to send push reminders and advance due dates.

**Tech Stack:** SvelteKit (Svelte 5 runes), Supabase PostgreSQL + RLS, Tailwind + daisyUI, Cloudflare Workers (TypeScript)

**Spec:** `docs/superpowers/specs/2026-03-11-subscription-management-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/010_subscriptions.sql` | Table, RLS policies, indexes |
| `arsa-app/src/lib/types/subscription.ts` | TypeScript interfaces + constants |
| `arsa-app/src/routes/plan/subscriptions/+page.server.ts` | List loader |
| `arsa-app/src/routes/plan/subscriptions/+page.svelte` | List UI with active/inactive tabs |
| `arsa-app/src/routes/plan/subscriptions/new/+page.server.ts` | Create form action |
| `arsa-app/src/routes/plan/subscriptions/new/+page.svelte` | Create form UI |
| `arsa-app/src/routes/plan/subscriptions/[id]/+page.server.ts` | Edit/delete form actions + loader |
| `arsa-app/src/routes/plan/subscriptions/[id]/+page.svelte` | Edit/delete form UI |
| `workers/arsa-subscriptions/wrangler.jsonc` | Worker config with daily cron |
| `workers/arsa-subscriptions/package.json` | Worker dependencies |
| `workers/arsa-subscriptions/tsconfig.json` | Worker TypeScript config |
| `workers/arsa-subscriptions/src/index.ts` | Worker entry: reminder + date advance |

### Modified Files
| File | Change |
|------|--------|
| `arsa-app/src/routes/plan/+page.server.ts` | Add subscriptions query + summary computation |
| `arsa-app/src/routes/plan/+page.svelte` | Add subscription summary card |

---

## Chunk 1: Database & Types

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/010_subscriptions.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Subscription / recurring payment tracking

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

CREATE INDEX idx_subscriptions_family ON subscriptions(family_id);
CREATE INDEX idx_subscriptions_due ON subscriptions(next_due_date) WHERE is_active = true;
```

- [ ] **Step 2: Run migration in Supabase Dashboard SQL Editor**

Copy the SQL and execute it. Verify the table appears in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_subscriptions.sql
git commit -m "feat(db): add subscriptions table with RLS"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `arsa-app/src/lib/types/subscription.ts`

- [ ] **Step 1: Create type definitions**

```typescript
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface Subscription {
	id: string;
	family_id: string;
	user_id: string;
	name: string;
	amount: number;
	frequency: Frequency;
	category_id: string | null;
	account_id: string | null;
	start_date: string;
	next_due_date: string;
	is_active: boolean;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
	daily: 'Harian',
	weekly: 'Mingguan',
	monthly: 'Bulanan',
	quarterly: '3 Bulanan',
	semi_annual: '6 Bulanan',
	annual: 'Tahunan'
};

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
	{ value: 'daily', label: 'Harian' },
	{ value: 'weekly', label: 'Mingguan' },
	{ value: 'monthly', label: 'Bulanan' },
	{ value: 'quarterly', label: '3 Bulanan' },
	{ value: 'semi_annual', label: '6 Bulanan' },
	{ value: 'annual', label: 'Tahunan' }
];

export const MONTHLY_MULTIPLIER: Record<Frequency, number> = {
	daily: 30,
	weekly: 4.33,
	monthly: 1,
	quarterly: 1 / 3,
	semi_annual: 1 / 6,
	annual: 1 / 12
};

export function computeNextDueDate(startDate: string, frequency: Frequency): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let d = new Date(startDate + 'T00:00:00');

	while (d < today) {
		d = advanceDate(d, frequency);
	}
	return d.toISOString().split('T')[0];
}

export function advanceDate(date: Date, frequency: Frequency): Date {
	const d = new Date(date);
	switch (frequency) {
		case 'daily':
			d.setDate(d.getDate() + 1);
			break;
		case 'weekly':
			d.setDate(d.getDate() + 7);
			break;
		case 'monthly':
			d.setMonth(d.getMonth() + 1);
			break;
		case 'quarterly':
			d.setMonth(d.getMonth() + 3);
			break;
		case 'semi_annual':
			d.setMonth(d.getMonth() + 6);
			break;
		case 'annual':
			d.setFullYear(d.getFullYear() + 1);
			break;
	}
	return d;
}

export function monthlyEquivalent(amount: number, frequency: Frequency): number {
	return amount * MONTHLY_MULTIPLIER[frequency];
}
```

- [ ] **Step 2: Verify build**

Run: `cd arsa-app && npx tsc --noEmit`
Expected: No errors related to `subscription.ts`

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/lib/types/subscription.ts
git commit -m "feat(types): add Subscription type and frequency helpers"
```

---

## Chunk 2: Plan Page Summary Card

### Task 3: Plan Page — Server Loader Update

**Files:**
- Modify: `arsa-app/src/routes/plan/+page.server.ts`

- [ ] **Step 1: Add subscriptions query and summary computation**

Replace the full file with:

```typescript
import type { PageServerLoad } from './$types';
import { MONTHLY_MULTIPLIER } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const emptyState = {
		childExpenses: [] as { name: string; spent: number }[],
		totalChildSpending: 0,
		subscriptions: [] as Array<Record<string, unknown>>,
		subscriptionSummary: { monthlyTotal: 0, activeCount: 0, upcoming: [] as Array<{ name: string; next_due_date: string; amount: number; daysUntil: number }> }
	};

	if (!user) return emptyState;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return emptyState;

	const familyId = profile.family_id;

	const [{ data: childCategories }, { data: subscriptions }] = await Promise.all([
		supabase
			.from('categories')
			.select('id, name')
			.eq('family_id', familyId)
			.eq('is_child_related', true),
		supabase
			.from('subscriptions')
			.select('id, name, amount, frequency, next_due_date, is_active, category_id')
			.eq('family_id', familyId)
			.eq('is_active', true)
			.order('next_due_date')
	]);

	// Child expenses (existing logic)
	let childExpenses: { name: string; spent: number }[] = [];
	let totalChildSpending = 0;

	if (childCategories?.length) {
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
		const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
		const childCatIds = childCategories.map((c) => c.id);

		const { data: transactions } = await supabase
			.from('transactions')
			.select('amount, category_id')
			.eq('family_id', familyId)
			.eq('type', 'out')
			.gte('date', monthStart)
			.lte('date', monthEnd)
			.in('category_id', childCatIds);

		const spendingMap = new Map<string, number>();
		for (const tx of transactions ?? []) {
			if (tx.category_id) {
				spendingMap.set(tx.category_id, (spendingMap.get(tx.category_id) ?? 0) + Number(tx.amount));
			}
		}

		childExpenses = childCategories.map((cat) => ({
			name: cat.name,
			spent: spendingMap.get(cat.id) ?? 0
		}));
		totalChildSpending = childExpenses.reduce((sum, e) => sum + e.spent, 0);
	}

	// Subscription summary
	const activeSubs = subscriptions ?? [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	let monthlyTotal = 0;
	const upcoming: { name: string; next_due_date: string; amount: number; daysUntil: number }[] = [];

	for (const sub of activeSubs) {
		const freq = sub.frequency as Frequency;
		monthlyTotal += Number(sub.amount) * (MONTHLY_MULTIPLIER[freq] ?? 1);

		const dueDate = new Date(sub.next_due_date + 'T00:00:00');
		const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		if (daysUntil >= 0 && daysUntil <= 7) {
			upcoming.push({
				name: sub.name,
				next_due_date: sub.next_due_date,
				amount: Number(sub.amount),
				daysUntil
			});
		}
	}

	return {
		childExpenses,
		totalChildSpending,
		subscriptions: activeSubs,
		subscriptionSummary: {
			monthlyTotal: Math.round(monthlyTotal),
			activeCount: activeSubs.length,
			upcoming
		}
	};
};
```

- [ ] **Step 2: Verify build**

Run: `cd arsa-app && npm run build 2>&1 | head -30`
Expected: No TypeScript errors on `plan/+page.server.ts`

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/routes/plan/+page.server.ts
git commit -m "feat(plan): add subscription summary to plan page loader"
```

---

### Task 4: Plan Page — Summary Card UI

**Files:**
- Modify: `arsa-app/src/routes/plan/+page.svelte`

- [ ] **Step 1: Add subscription summary card to Plan page**

Replace the full file with:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
	}

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	function dueBadgeClass(daysUntil: number): string {
		if (daysUntil <= 3) return 'bg-warning text-warning-content';
		return 'bg-base-200 text-base-content/70';
	}

	function dueLabel(daysUntil: number, date: string): string {
		if (daysUntil === 0) return 'Hari ini!';
		if (daysUntil === 1) return 'Besok!';
		const d = new Date(date + 'T00:00:00');
		return `${d.getDate()}/${d.getMonth() + 1}`;
	}
</script>

<h1 class="heading-xl mb-6">Plan</h1>

<div class="mb-6">
	<h2 class="heading-md mb-3">Child Expenses — {monthName}</h2>

	{#if data.childExpenses.length === 0}
		<div class="text-subtle py-6 text-center">
			<p>No child-related categories found.</p>
			<p class="text-sm">Mark categories as "child-related" in Settings.</p>
		</div>
	{:else}
		<div class="mb-4 rounded-2xl border border-secondary/10 bg-secondary/5 p-4">
			<p class="text-subtle text-xs font-medium uppercase tracking-wider">Total Child Spending</p>
			<p class="mt-1 font-mono text-2xl font-bold">
				{formatRp(data.totalChildSpending)}
			</p>
			<p class="text-subtle mt-1 text-xs">This month</p>
		</div>

		<div class="flex flex-col gap-2">
			{#each data.childExpenses as expense (expense.name)}
				<div class="flex items-center justify-between rounded-xl bg-base-200/30 p-3">
					<div class="flex items-center gap-2">
						<span
							class="inline-block size-2.5 rounded-full"
							style="background-color: {getCategoryColor(expense.name)}"
						></span>
						<span class="text-sm font-medium">{expense.name}</span>
					</div>
					<span class="font-mono text-sm">{formatRp(expense.spent)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="divider"></div>

<!-- Subscription summary card -->
{#if data.subscriptionSummary.activeCount > 0}
	<a
		href={resolve('/plan/subscriptions')}
		class="mb-4 block rounded-2xl border border-primary/10 bg-primary/5 p-4 press-scale"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-lg">
					🔄
				</div>
				<div>
					<p class="text-sm font-semibold">Langganan</p>
					<p class="text-subtle text-xs">
						{data.subscriptionSummary.activeCount} aktif · {formatRp(data.subscriptionSummary.monthlyTotal)}/bln
					</p>
				</div>
			</div>
			<span class="text-base-content/30">›</span>
		</div>
		{#if data.subscriptionSummary.upcoming.length > 0}
			<div class="mt-3 flex flex-wrap gap-1.5 border-t border-primary/10 pt-3">
				{#each data.subscriptionSummary.upcoming as item (item.name)}
					<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold {dueBadgeClass(item.daysUntil)}">
						{item.name} {dueLabel(item.daysUntil, item.next_due_date)}
					</span>
				{/each}
			</div>
		{/if}
	</a>
{:else}
	<a
		href={resolve('/plan/subscriptions')}
		class="mb-4 flex items-center gap-3 rounded-xl border border-base-200 p-4 press-scale"
	>
		<span class="text-lg">🔄</span>
		<span class="text-sm font-medium">Kelola Langganan</span>
	</a>
{/if}

<a href={resolve('/plan/education')} class="flex items-center gap-3 rounded-xl border border-base-200 p-4 press-scale">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="size-5 text-primary"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14zm-4 6v-7.5l4-2.222"
		/>
	</svg>
	<span class="text-sm font-medium">Education Cost Projection</span>
</a>
```

- [ ] **Step 2: Verify dev server renders Plan page correctly**

Run: `cd arsa-app && npm run dev`
Navigate to `/plan` on 375px mobile viewport. Verify:
- Summary card shows when subscriptions exist (or "Kelola Langganan" link when none)
- Child expenses section unchanged
- Education link unchanged

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/routes/plan/+page.svelte
git commit -m "feat(plan): add subscription summary card to plan page"
```

---

## Chunk 3: Subscription List Page

### Task 5: Subscription List — Server Loader

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/+page.server.ts`

- [ ] **Step 1: Create list page server loader**

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user!.id)
		.single();

	const { data: subscriptions } = await supabase
		.from('subscriptions')
		.select('id, name, amount, frequency, next_due_date, is_active, notes, category_id, account_id, categories(name), accounts(name)')
		.eq('family_id', profile!.family_id)
		.order('next_due_date');

	return { subscriptions: subscriptions ?? [] };
};
```

- [ ] **Step 2: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/+page.server.ts
git commit -m "feat(subscriptions): add list page server loader"
```

---

### Task 6: Subscription List — UI

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/+page.svelte`

- [ ] **Step 1: Create list page UI**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { FREQUENCY_LABELS } from '$lib/types/subscription';
	import type { Frequency } from '$lib/types/subscription';

	let { data } = $props();

	let showInactive = $state(false);

	const filtered = $derived(
		data.subscriptions.filter((s) => (showInactive ? !s.is_active : s.is_active))
	);

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
	}

	function formatRp(amount: number): string {
		return `Rp ${Number(amount).toLocaleString('id-ID')}`;
	}

	function daysUntilDue(dateStr: string): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const due = new Date(dateStr + 'T00:00:00');
		return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function dueLabel(dateStr: string): string {
		const days = daysUntilDue(dateStr);
		if (days < 0) return 'Terlambat!';
		if (days === 0) return 'Hari ini!';
		if (days === 1) return 'Besok!';
		const d = new Date(dateStr + 'T00:00:00');
		return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
	}

	function dueColor(dateStr: string): string {
		const days = daysUntilDue(dateStr);
		if (days <= 3) return 'text-warning';
		return 'text-subtle';
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="heading-xl">Langganan</h1>
	<a href={resolve('/plan/subscriptions/new')} class="btn btn-primary btn-sm rounded-xl">+ Tambah</a>
</div>

<!-- Tab filter -->
<div class="mb-4 rounded-xl bg-base-200/50 p-1">
	<div class="flex">
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {!showInactive ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (showInactive = false)}
		>
			Aktif
		</button>
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {showInactive ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (showInactive = true)}
		>
			Nonaktif
		</button>
	</div>
</div>

{#if filtered.length === 0}
	<div class="text-subtle py-10 text-center">
		<p>{showInactive ? 'Tidak ada langganan nonaktif.' : 'Belum ada langganan.'}</p>
		{#if !showInactive}
			<a href={resolve('/plan/subscriptions/new')} class="font-medium text-primary">
				Tambah langganan pertama
			</a>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each filtered as sub (sub.id)}
			<a
				href={resolve('/plan/subscriptions/[id]', { id: sub.id })}
				class="shadow-soft rounded-xl bg-base-100 press-scale"
			>
				<div class="flex items-center gap-3 p-4">
					<div
						class="category-icon"
						style="background-color: {getCategoryColor(sub.name)}"
					>
						{sub.name.charAt(0).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{sub.name}</p>
						<div class="flex items-center gap-2">
							<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
								{FREQUENCY_LABELS[sub.frequency as Frequency]}
							</span>
							{#if sub.is_active}
								<span class="text-[10px] {dueColor(sub.next_due_date)}">
									{dueLabel(sub.next_due_date)}
								</span>
							{/if}
						</div>
					</div>
					<span class="font-mono text-sm font-bold text-error">
						{formatRp(sub.amount)}
					</span>
				</div>
			</a>
		{/each}
	</div>
{/if}
```

- [ ] **Step 2: Verify dev server**

Navigate to `/plan/subscriptions`. Verify:
- Header with "+ Tambah" button
- Aktif/Nonaktif tab toggle
- Empty state message when no subscriptions
- List items with color circle, name, frequency badge, due date, amount

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/+page.svelte
git commit -m "feat(subscriptions): add list page UI with active/inactive tabs"
```

---

## Chunk 4: Create Subscription Page

### Task 7: Create Subscription — Form Action

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/new/+page.server.ts`

- [ ] **Step 1: Create form action**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { computeNextDueDate } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

const VALID_FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual'];

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user!.id)
			.single();

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const amount = parseFloat(formData.get('amount') as string);
		const frequency = formData.get('frequency') as Frequency;
		const category_id = (formData.get('category_id') as string) || null;
		const account_id = (formData.get('account_id') as string) || null;
		const start_date = formData.get('start_date') as string;
		const notes = (formData.get('notes') as string)?.trim() || null;

		if (!name || !amount || !frequency || !start_date) {
			return fail(400, { error: 'Nama, jumlah, frekuensi, dan tanggal mulai wajib diisi.', name, amount, frequency, category_id, account_id, start_date, notes });
		}

		if (!VALID_FREQUENCIES.includes(frequency)) {
			return fail(400, { error: 'Frekuensi tidak valid.', name, amount, frequency, category_id, account_id, start_date, notes });
		}

		const next_due_date = computeNextDueDate(start_date, frequency);

		const { error } = await supabase.from('subscriptions').insert({
			family_id: profile!.family_id,
			user_id: user!.id,
			name,
			amount,
			frequency,
			category_id,
			account_id,
			start_date,
			next_due_date,
			notes
		});

		if (error) {
			return fail(500, { error: 'Gagal membuat langganan.', name, amount, frequency, category_id, account_id, start_date, notes });
		}

		redirect(303, '/plan/subscriptions');
	}
};
```

- [ ] **Step 2: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/new/+page.server.ts
git commit -m "feat(subscriptions): add create form action with date computation"
```

---

### Task 8: Create Subscription — Form UI

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/new/+page.svelte`

- [ ] **Step 1: Create form UI**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FREQUENCY_OPTIONS } from '$lib/types/subscription';

	let { data, form } = $props();

	const today = new Date().toISOString().split('T')[0];
</script>

<h1 class="heading-xl mb-6">Tambah Langganan</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Nama Layanan</span>
		<input
			name="name"
			type="text"
			placeholder="Nama Layanan"
			class="input input-bordered w-full rounded-xl"
			value={form?.name ?? ''}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Jumlah (Rp)</span>
		<input
			name="amount"
			type="number"
			inputmode="decimal"
			placeholder="Jumlah (Rp)"
			class="input input-bordered w-full rounded-xl"
			value={form?.amount ?? ''}
			step="any"
			min="0"
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Frekuensi</span></div>
		<select name="frequency" class="select select-bordered w-full rounded-xl" required>
			<option value="" disabled selected={!form?.frequency}>Pilih frekuensi</option>
			{#each FREQUENCY_OPTIONS as opt (opt.value)}
				<option value={opt.value} selected={form?.frequency === opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Kategori</span></div>
		<select name="category_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tanpa kategori</option>
			{#each data.categories as cat (cat.id)}
				<option value={cat.id} selected={form?.category_id === cat.id}>{cat.name}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Akun Pembayaran</span></div>
		<select name="account_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tidak ditentukan</option>
			{#each data.accounts as acct (acct.id)}
				<option value={acct.id} selected={form?.account_id === acct.id}>{acct.name}</option>
			{/each}
		</select>
	</label>

	<label class="floating-label">
		<span>Tanggal Mulai</span>
		<input
			name="start_date"
			type="date"
			class="input input-bordered w-full rounded-xl"
			value={form?.start_date ?? today}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Catatan</span>
		<input
			name="notes"
			type="text"
			placeholder="Catatan"
			class="input input-bordered w-full rounded-xl"
			value={form?.notes ?? ''}
		/>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/plan/subscriptions')} class="btn btn-ghost flex-1 rounded-xl">Batal</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Simpan</button>
	</div>
</form>
```

- [ ] **Step 2: Verify dev server**

Navigate to `/plan/subscriptions/new`. Verify:
- All form fields render (name, amount, frequency, category, account, start_date, notes)
- Categories and accounts dropdowns populated from parent layout data
- Submit creates a subscription and redirects to list page
- Validation error displays inline

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/new/+page.svelte
git commit -m "feat(subscriptions): add create subscription form UI"
```

---

## Chunk 5: Edit/Delete Subscription Page

### Task 9: Edit/Delete — Server Loader + Actions

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/[id]/+page.server.ts`

- [ ] **Step 1: Create loader and form actions**

```typescript
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { computeNextDueDate } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

const VALID_FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: subscription } = await supabase
		.from('subscriptions')
		.select('id, name, amount, frequency, category_id, account_id, start_date, next_due_date, is_active, notes')
		.eq('id', params.id)
		.single();

	if (!subscription) {
		error(404, 'Langganan tidak ditemukan');
	}

	return { subscription };
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase } }) => {
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const amount = parseFloat(formData.get('amount') as string);
		const frequency = formData.get('frequency') as Frequency;
		const category_id = (formData.get('category_id') as string) || null;
		const account_id = (formData.get('account_id') as string) || null;
		const start_date = formData.get('start_date') as string;
		const is_active = formData.get('is_active') === 'on';
		const notes = (formData.get('notes') as string)?.trim() || null;

		if (!name || !amount || !frequency || !start_date) {
			return fail(400, { error: 'Nama, jumlah, frekuensi, dan tanggal mulai wajib diisi.' });
		}

		if (!VALID_FREQUENCIES.includes(frequency)) {
			return fail(400, { error: 'Frekuensi tidak valid.' });
		}

		// Fetch current subscription to check if frequency or start_date changed
		const { data: current } = await supabase
			.from('subscriptions')
			.select('frequency, start_date, next_due_date')
			.eq('id', params.id)
			.single();

		let next_due_date = current?.next_due_date;
		if (current?.frequency !== frequency || current?.start_date !== start_date) {
			next_due_date = computeNextDueDate(start_date, frequency);
		}

		const { error: updateError } = await supabase
			.from('subscriptions')
			.update({ name, amount, frequency, category_id, account_id, start_date, next_due_date, is_active, notes, updated_at: new Date().toISOString() })
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { error: 'Gagal memperbarui langganan.' });
		}

		redirect(303, '/plan/subscriptions');
	},

	delete: async ({ params, locals: { supabase } }) => {
		const { error: deleteError } = await supabase
			.from('subscriptions')
			.delete()
			.eq('id', params.id);

		if (deleteError) {
			return fail(500, { error: 'Gagal menghapus langganan.' });
		}

		redirect(303, '/plan/subscriptions');
	}
};
```

- [ ] **Step 2: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/[id]/+page.server.ts
git commit -m "feat(subscriptions): add edit/delete server actions"
```

---

### Task 10: Edit/Delete — UI

**Files:**
- Create: `arsa-app/src/routes/plan/subscriptions/[id]/+page.svelte`

- [ ] **Step 1: Create edit/delete form UI**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FREQUENCY_OPTIONS } from '$lib/types/subscription';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="heading-xl mb-6">Edit Langganan</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Nama Layanan</span>
		<input
			name="name"
			type="text"
			placeholder="Nama Layanan"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.name}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Jumlah (Rp)</span>
		<input
			name="amount"
			type="number"
			inputmode="decimal"
			placeholder="Jumlah (Rp)"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.amount}
			step="any"
			min="0"
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Frekuensi</span></div>
		<select name="frequency" class="select select-bordered w-full rounded-xl" required>
			{#each FREQUENCY_OPTIONS as opt (opt.value)}
				<option value={opt.value} selected={data.subscription.frequency === opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Kategori</span></div>
		<select name="category_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tanpa kategori</option>
			{#each data.categories as cat (cat.id)}
				<option value={cat.id} selected={data.subscription.category_id === cat.id}>{cat.name}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Akun Pembayaran</span></div>
		<select name="account_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tidak ditentukan</option>
			{#each data.accounts as acct (acct.id)}
				<option value={acct.id} selected={data.subscription.account_id === acct.id}>{acct.name}</option>
			{/each}
		</select>
	</label>

	<label class="floating-label">
		<span>Tanggal Mulai</span>
		<input
			name="start_date"
			type="date"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.start_date}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Catatan</span>
		<input
			name="notes"
			type="text"
			placeholder="Catatan"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.notes ?? ''}
		/>
	</label>

	<div class="form-control">
		<label class="label cursor-pointer justify-start gap-3">
			<input
				name="is_active"
				type="checkbox"
				class="toggle toggle-primary"
				checked={data.subscription.is_active}
			/>
			<span class="text-sm font-medium">Aktif</span>
		</label>
	</div>

	<p class="text-subtle text-xs">
		Jatuh tempo berikutnya: {data.subscription.next_due_date}
	</p>

	<div class="flex gap-2">
		<a href={resolve('/plan/subscriptions')} class="btn btn-ghost flex-1 rounded-xl">Batal</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Simpan</button>
	</div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full rounded-xl" onclick={() => (showDeleteConfirm = true)}>
	Hapus Langganan
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl">
			<h3 class="heading-lg">Hapus "{data.subscription.name}"?</h3>
			<p class="text-subtle py-4">Tindakan ini tidak dapat dibatalkan.</p>
			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={() => (showDeleteConfirm = false)}>Batal</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error rounded-xl">Hapus</button>
				</form>
			</div>
		</div>
		<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={() => (showDeleteConfirm = false)}></button>
	</div>
{/if}
```

- [ ] **Step 2: Full flow test**

1. Navigate to `/plan/subscriptions/new`, create a subscription (e.g. "Netflix", Rp 65.000, Bulanan)
2. Verify redirect to list page with the new item
3. Tap the item → edit page loads with pre-populated fields
4. Change the name, save → redirects back with updated name
5. Toggle "Aktif" off, save → item moves to "Nonaktif" tab
6. Delete → confirmation modal → confirm → item removed
7. Navigate to `/plan` → verify summary card shows data

- [ ] **Step 3: Commit**

```bash
git add arsa-app/src/routes/plan/subscriptions/[id]/+page.svelte
git commit -m "feat(subscriptions): add edit/delete subscription UI"
```

---

## Chunk 6: Push Reminder Worker

### Task 11: Worker Scaffold

**Files:**
- Create: `workers/arsa-subscriptions/package.json`
- Create: `workers/arsa-subscriptions/tsconfig.json`
- Create: `workers/arsa-subscriptions/wrangler.jsonc`

- [ ] **Step 1: Create worker package.json**

```json
{
  "name": "arsa-subscriptions-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250109.0",
    "typescript": "^5.7.0",
    "wrangler": "^4.0.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create wrangler.jsonc**

```jsonc
{
  "name": "arsa-subscriptions-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "triggers": {
    "crons": ["0 0 * * *"]
  }
}
```

Note: `0 0 * * *` = midnight UTC = 07:00 WIB daily.

- [ ] **Step 4: Install dependencies**

```bash
cd workers/arsa-subscriptions && npm install
```

- [ ] **Step 5: Commit**

```bash
git add workers/arsa-subscriptions/package.json workers/arsa-subscriptions/tsconfig.json workers/arsa-subscriptions/wrangler.jsonc
git commit -m "feat(worker): scaffold arsa-subscriptions worker"
```

---

### Task 12: Worker Entry — Reminder Logic

**Files:**
- Create: `workers/arsa-subscriptions/src/index.ts`

- [ ] **Step 1: Create worker entry with reminder + date advance logic**

```typescript
import { createClient } from '@supabase/supabase-js';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	VAPID_PRIVATE_KEY: string;
	VAPID_PUBLIC_KEY: string;
	WORKER_SECRET: string;
}

interface DueSubscription {
	id: string;
	name: string;
	amount: number;
	frequency: string;
	next_due_date: string;
	user_id: string;
}

interface PushSub {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(processReminders(env));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.headers.get('X-Worker-Secret') !== env.WORKER_SECRET) {
			return new Response('Unauthorized', { status: 401 });
		}
		const result = await processReminders(env);
		return new Response(JSON.stringify(result, null, 2), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

async function processReminders(env: Env): Promise<Record<string, unknown>> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const today = new Date().toISOString().split('T')[0];

	const { data: dueSubs, error } = await supabase
		.from('subscriptions')
		.select('id, name, amount, frequency, next_due_date, user_id')
		.eq('is_active', true)
		.lte('next_due_date', today);

	if (error || !dueSubs) {
		return { error: error?.message ?? 'No data', processed: 0 };
	}

	let notified = 0;
	let advanced = 0;

	for (const sub of dueSubs as DueSubscription[]) {
		// Send push notification
		const { data: pushSubs } = await supabase
			.from('push_subscriptions')
			.select('endpoint, keys')
			.eq('user_id', sub.user_id);

		const payload = JSON.stringify({
			title: `Langganan ${sub.name}`,
			body: `Jatuh tempo hari ini — Rp ${Number(sub.amount).toLocaleString('id-ID')}`,
			icon: '/icons/icon-192.png',
			url: '/plan/subscriptions'
		});

		for (const ps of (pushSubs ?? []) as PushSub[]) {
			try {
				await fetch(ps.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', TTL: '86400' },
					body: payload
				});
				notified++;
			} catch {
				// non-critical
			}
		}

		// Advance next_due_date until it's in the future
		let nextDue = new Date(sub.next_due_date + 'T00:00:00');
		const todayDate = new Date(today + 'T00:00:00');
		while (nextDue <= todayDate) {
			nextDue = advanceDate(nextDue, sub.frequency);
		}

		await supabase
			.from('subscriptions')
			.update({
				next_due_date: nextDue.toISOString().split('T')[0],
				updated_at: new Date().toISOString()
			})
			.eq('id', sub.id);

		advanced++;
	}

	return { processed: dueSubs.length, notified, advanced };
}

function advanceDate(date: Date, frequency: string): Date {
	const d = new Date(date);
	switch (frequency) {
		case 'daily':
			d.setDate(d.getDate() + 1);
			break;
		case 'weekly':
			d.setDate(d.getDate() + 7);
			break;
		case 'monthly':
			d.setMonth(d.getMonth() + 1);
			break;
		case 'quarterly':
			d.setMonth(d.getMonth() + 3);
			break;
		case 'semi_annual':
			d.setMonth(d.getMonth() + 6);
			break;
		case 'annual':
			d.setFullYear(d.getFullYear() + 1);
			break;
	}
	return d;
}
```

- [ ] **Step 2: Set worker secrets**

```bash
cd workers/arsa-subscriptions
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put WORKER_SECRET
```

- [ ] **Step 3: Test locally**

```bash
cd workers/arsa-subscriptions && wrangler dev
```

In another terminal:
```bash
curl -H "X-Worker-Secret: YOUR_SECRET" http://localhost:8787
```

Expected: JSON response with `{ "processed": N, "notified": N, "advanced": N }`

- [ ] **Step 4: Commit**

```bash
git add workers/arsa-subscriptions/src/index.ts
git commit -m "feat(worker): add subscription reminder worker with date advance"
```

---

## Chunk 7: Build Verification & Final Commit

### Task 13: Build Verification

- [ ] **Step 1: Verify SvelteKit build**

```bash
cd arsa-app && npm run build
```

Expected: No TypeScript or Svelte compilation errors on any subscription-related files.

- [ ] **Step 2: Verify worker build**

```bash
cd workers/arsa-subscriptions && npx wrangler deploy --dry-run
```

Expected: Successful build output without deploying.

- [ ] **Step 3: Manual QA checklist**

Run `cd arsa-app && npm run dev` and verify at 375px mobile viewport:

1. `/plan` — Summary card shows when subscriptions exist, hidden when none
2. `/plan` — Summary card shows monthly total, active count, upcoming badges
3. `/plan/subscriptions` — List shows active subscriptions with frequency badges and due dates
4. `/plan/subscriptions` — Tab toggle between Aktif/Nonaktif works
5. `/plan/subscriptions/new` — Form creates subscription, redirects to list
6. `/plan/subscriptions/[id]` — Form pre-populates, saves changes, active toggle works
7. `/plan/subscriptions/[id]` — Delete shows confirmation modal, deletes and redirects
8. Theme toggle (dim ↔ cupcake) — all cards and badges render correctly in both themes

- [ ] **Step 4: Update changelog**

Add entry to `.claude/CHANGELOG.md` documenting all changes.
