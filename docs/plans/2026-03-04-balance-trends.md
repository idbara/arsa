# Balance Trends (Tren Saldo) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a balance trends feature showing daily account balances and total net worth over time, computed from existing transaction data, with Chart.js visualization.

**Architecture:** Server load function computes daily balances by reversing transactions from current account balances. Chart.js renders line charts with per-account and net worth views. Dashboard sparkline widget provides quick access. No new database tables.

**Tech Stack:** Chart.js, svelte-chartjs, SvelteKit server load functions, Supabase queries, daisyUI

**Design doc:** `docs/plans/2026-03-04-balance-trends-design.md`

**Prerequisites:** Phase 1 (auth + DB) and Phase 2 (accounts + transactions) must be complete.

---

### Task 1: Install Chart.js Dependencies

**Files:**
- Modify: `arsa-app/package.json`

**Step 1: Install chart.js and svelte-chartjs**

```bash
cd arsa-app && npm install chart.js svelte-chartjs
```

**Step 2: Verify installation**

```bash
cd arsa-app && node -e "require('chart.js'); console.log('chart.js OK')"
```

Expected: `chart.js OK`

**Step 3: Commit**

```bash
git add arsa-app/package.json arsa-app/package-lock.json
git commit -m "chore: install chart.js and svelte-chartjs"
```

---

### Task 2: Balance Computation Utility — Tests

**Files:**
- Create: `arsa-app/src/lib/trends.ts`
- Create: `arsa-app/tests/unit/trends.test.ts`

**Step 1: Write the failing tests**

`arsa-app/tests/unit/trends.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeDailyBalances, computeNetWorth } from '$lib/trends';

describe('computeDailyBalances', () => {
  it('returns current balance when no transactions', () => {
    const result = computeDailyBalances(
      { id: 'acc-1', balance: 1000000 },
      [],
      new Date('2026-03-01'),
      new Date('2026-03-03')
    );

    expect(result).toEqual([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 1000000 },
      { date: '2026-03-03', balance: 1000000 },
    ]);
  });

  it('reverses outgoing transactions (adds back)', () => {
    const result = computeDailyBalances(
      { id: 'acc-1', balance: 800000 },
      [
        { date: '2026-03-03', amount: 200000, type: 'out', account_id: 'acc-1' },
      ],
      new Date('2026-03-01'),
      new Date('2026-03-03')
    );

    // Today (Mar 3): 800000 (current)
    // Mar 2: 800000 + 200000 = 1000000 (before the spend)
    // Mar 1: 1000000 (no txn)
    expect(result).toEqual([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 1000000 },
      { date: '2026-03-03', balance: 800000 },
    ]);
  });

  it('reverses incoming transactions (subtracts)', () => {
    const result = computeDailyBalances(
      { id: 'acc-1', balance: 1500000 },
      [
        { date: '2026-03-02', amount: 500000, type: 'in', account_id: 'acc-1' },
      ],
      new Date('2026-03-01'),
      new Date('2026-03-03')
    );

    // Today (Mar 3): 1500000
    // Mar 2: 1500000 (income received on this day, balance after = 1500000)
    // Mar 1: 1500000 - 500000 = 1000000 (before the income)
    expect(result).toEqual([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 1500000 },
      { date: '2026-03-03', balance: 1500000 },
    ]);
  });

  it('reverses transfer out (adds back to source)', () => {
    const result = computeDailyBalances(
      { id: 'acc-1', balance: 700000 },
      [
        { date: '2026-03-02', amount: 300000, type: 'transfer', account_id: 'acc-1' },
      ],
      new Date('2026-03-01'),
      new Date('2026-03-02')
    );

    // Mar 2: 700000 (current, transfer out happened)
    // Mar 1: 700000 + 300000 = 1000000
    expect(result).toEqual([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 700000 },
    ]);
  });

  it('handles multiple transactions on same day', () => {
    const result = computeDailyBalances(
      { id: 'acc-1', balance: 500000 },
      [
        { date: '2026-03-02', amount: 200000, type: 'out', account_id: 'acc-1' },
        { date: '2026-03-02', amount: 100000, type: 'out', account_id: 'acc-1' },
      ],
      new Date('2026-03-01'),
      new Date('2026-03-02')
    );

    // Mar 2: 500000 (current)
    // Mar 1: 500000 + 200000 + 100000 = 800000
    expect(result).toEqual([
      { date: '2026-03-01', balance: 800000 },
      { date: '2026-03-02', balance: 500000 },
    ]);
  });
});

describe('computeNetWorth', () => {
  it('sums all account balances per day', () => {
    const accountBalances = [
      [
        { date: '2026-03-01', balance: 500000 },
        { date: '2026-03-02', balance: 600000 },
      ],
      [
        { date: '2026-03-01', balance: 300000 },
        { date: '2026-03-02', balance: 250000 },
      ],
    ];

    const result = computeNetWorth(accountBalances);
    expect(result).toEqual([
      { date: '2026-03-01', balance: 800000 },
      { date: '2026-03-02', balance: 850000 },
    ]);
  });

  it('returns empty array for no accounts', () => {
    expect(computeNetWorth([])).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd arsa-app && npx vitest run tests/unit/trends.test.ts
```

Expected: FAIL — `$lib/trends` module doesn't exist.

**Step 3: Write the implementation**

`arsa-app/src/lib/trends.ts`:
```typescript
interface AccountInput {
  id: string;
  balance: number;
}

interface TransactionInput {
  date: string;
  amount: number;
  type: 'in' | 'out' | 'transfer';
  account_id: string;
}

export interface DailyBalance {
  date: string;
  balance: number;
}

export function computeDailyBalances(
  account: AccountInput,
  transactions: TransactionInput[],
  rangeStart: Date,
  rangeEnd: Date
): DailyBalance[] {
  // Group transactions by date
  const txnsByDate = new Map<string, TransactionInput[]>();
  for (const txn of transactions) {
    const existing = txnsByDate.get(txn.date) ?? [];
    existing.push(txn);
    txnsByDate.set(txn.date, existing);
  }

  // Build list of dates in range
  const dates: string[] = [];
  const current = new Date(rangeStart);
  while (current <= rangeEnd) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  // Walk backwards from the last date, starting with current balance
  const result: DailyBalance[] = new Array(dates.length);
  let runningBalance = account.balance;

  for (let i = dates.length - 1; i >= 0; i--) {
    result[i] = { date: dates[i], balance: runningBalance };

    // Reverse transactions on this day to get the balance before
    const dayTxns = txnsByDate.get(dates[i]) ?? [];
    for (const txn of dayTxns) {
      if (txn.account_id === account.id) {
        if (txn.type === 'out' || txn.type === 'transfer') {
          runningBalance += txn.amount;
        } else if (txn.type === 'in') {
          runningBalance -= txn.amount;
        }
      }
    }
  }

  return result;
}

export function computeNetWorth(accountBalances: DailyBalance[][]): DailyBalance[] {
  if (accountBalances.length === 0) return [];

  const days = accountBalances[0].length;
  const result: DailyBalance[] = [];

  for (let i = 0; i < days; i++) {
    let total = 0;
    for (const acct of accountBalances) {
      total += acct[i]?.balance ?? 0;
    }
    result.push({
      date: accountBalances[0][i].date,
      balance: total,
    });
  }

  return result;
}

export function formatRupiah(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

export function computeChange(data: DailyBalance[]): { absolute: number; percent: number } {
  if (data.length < 2) return { absolute: 0, percent: 0 };
  const first = data[0].balance;
  const last = data[data.length - 1].balance;
  const absolute = last - first;
  const percent = first === 0 ? 0 : Math.round((absolute / first) * 100);
  return { absolute, percent };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd arsa-app && npx vitest run tests/unit/trends.test.ts
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add arsa-app/src/lib/trends.ts arsa-app/tests/unit/trends.test.ts
git commit -m "feat: add balance computation utility with tests"
```

---

### Task 3: Trends Page — Server Load Function

**Files:**
- Create: `arsa-app/src/routes/trends/+page.server.ts`

**Step 1: Write the server load function**

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { computeDailyBalances, computeNetWorth, computeChange } from '$lib/trends';

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

  const range = parseInt(url.searchParams.get('range') ?? '30', 10);
  const validRange = [7, 30, 90].includes(range) ? range : 30;

  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setDate(rangeEnd.getDate() - validRange + 1);

  const startStr = rangeStart.toISOString().split('T')[0];
  const endStr = rangeEnd.toISOString().split('T')[0];

  const [accountsRes, transactionsRes, investmentsRes, ratesRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, balance')
      .eq('family_id', profile.family_id)
      .order('name'),

    supabase
      .from('transactions')
      .select('date, amount, type, account_id')
      .eq('family_id', profile.family_id)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: false }),

    supabase
      .from('investments')
      .select('asset_code, qty, avg_buy_price')
      .eq('family_id', profile.family_id),

    supabase
      .from('market_rates')
      .select('asset_code, sell_price'),
  ]);

  const accounts = accountsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];

  // Compute daily balances per account
  const accountDailyBalances = accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    dailyBalances: computeDailyBalances(
      { id: account.id, balance: Number(account.balance) },
      transactions
        .filter((t) => t.account_id === account.id)
        .map((t) => ({
          date: t.date,
          amount: Number(t.amount),
          type: t.type as 'in' | 'out' | 'transfer',
          account_id: t.account_id,
        })),
      rangeStart,
      rangeEnd
    ),
  }));

  // Compute net worth
  const netWorth = computeNetWorth(accountDailyBalances.map((a) => a.dailyBalances));

  // Add investment value
  const rateMap = new Map((ratesRes.data ?? []).map((r) => [r.asset_code, Number(r.sell_price)]));
  const investmentValue = (investmentsRes.data ?? []).reduce((sum, inv) => {
    const price = rateMap.get(inv.asset_code) ?? 0;
    return sum + Number(inv.qty) * price;
  }, 0);

  // Net worth change
  const netWorthChange = computeChange(netWorth);

  // Labels (date strings for x-axis)
  const labels = netWorth.map((d) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  });

  return {
    accountDailyBalances,
    netWorth,
    netWorthChange,
    investmentValue,
    labels,
    range: validRange,
    currentNetWorth: netWorth.length > 0 ? netWorth[netWorth.length - 1].balance : 0,
  };
};
```

**Step 2: Commit**

```bash
git add arsa-app/src/routes/trends/+page.server.ts
git commit -m "feat: add trends page server load with balance computation"
```

---

### Task 4: Chart Components

**Files:**
- Create: `arsa-app/src/lib/components/BalanceChart.svelte`
- Create: `arsa-app/src/lib/components/RangeSelector.svelte`
- Create: `arsa-app/src/lib/components/TrendSparkline.svelte`

**Step 1: Create RangeSelector component**

`arsa-app/src/lib/components/RangeSelector.svelte`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';

  let { activeRange }: { activeRange: number } = $props();

  const ranges = [7, 30, 90];

  function selectRange(range: number) {
    goto(`/trends?range=${range}`, { replaceState: true });
  }
</script>

<div class="join">
  {#each ranges as range}
    <button
      class="join-item btn btn-sm"
      class:btn-active={activeRange === range}
      onclick={() => selectRange(range)}
    >
      {range}D
    </button>
  {/each}
</div>
```

**Step 2: Create BalanceChart component**

`arsa-app/src/lib/components/BalanceChart.svelte`:
```svelte
<script lang="ts">
  import { Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  interface Dataset {
    label: string;
    data: number[];
    color: string;
    fill?: boolean;
  }

  let { labels, datasets }: { labels: string[]; datasets: Dataset[] } = $props();

  const COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  ];

  const chartData = $derived({
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || COLORS[i % COLORS.length],
      backgroundColor: ds.fill
        ? `${ds.color || COLORS[i % COLORS.length]}20`
        : 'transparent',
      fill: ds.fill ?? false,
      tension: 0.3,
      pointRadius: labels.length > 30 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    })),
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const value = ctx.parsed.y;
            return `${ctx.dataset.label}: Rp${value.toLocaleString('id-ID')}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: any) => `Rp${(value / 1000000).toFixed(1)}jt`,
          font: { size: 10 },
        },
        grid: { color: 'rgba(128,128,128,0.1)' },
      },
      x: {
        ticks: {
          maxTicksLimit: 7,
          font: { size: 10 },
        },
        grid: { display: false },
      },
    },
  };
</script>

<div style="height: 280px; width: 100%;">
  <Line data={chartData} options={chartOptions} />
</div>
```

**Step 3: Create TrendSparkline component**

`arsa-app/src/lib/components/TrendSparkline.svelte`:
```svelte
<script lang="ts">
  import { Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
  } from 'chart.js';

  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

  let { data, color = '#6366f1' }: { data: number[]; color?: string } = $props();

  const labels = data.map(() => '');

  const chartData = $derived({
    labels,
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: `${color}15`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      line: { borderJoinStyle: 'round' as const },
    },
  };
</script>

<div style="height: 48px; width: 100%;">
  <Line data={chartData} options={chartOptions} />
</div>
```

**Step 4: Commit**

```bash
git add arsa-app/src/lib/components/RangeSelector.svelte arsa-app/src/lib/components/BalanceChart.svelte arsa-app/src/lib/components/TrendSparkline.svelte
git commit -m "feat: add BalanceChart, RangeSelector, and TrendSparkline components"
```

---

### Task 5: Trends Page — UI

**Files:**
- Create: `arsa-app/src/routes/trends/+page.svelte`

**Step 1: Write the trends page**

```svelte
<script lang="ts">
  import BalanceChart from '$lib/components/BalanceChart.svelte';
  import RangeSelector from '$lib/components/RangeSelector.svelte';
  import { formatRupiah } from '$lib/trends';

  let { data } = $props();

  type View = 'accounts' | 'networth';
  let activeView: View = $state('networth');

  const accountDatasets = $derived(
    data.accountDailyBalances.map((a: any) => ({
      label: a.accountName,
      data: a.dailyBalances.map((d: any) => d.balance),
      color: '',
      fill: false,
    }))
  );

  const netWorthDatasets = $derived([
    {
      label: 'Net Worth',
      data: data.netWorth.map((d: any) => d.balance),
      color: '#6366f1',
      fill: true,
    },
    ...(data.investmentValue > 0
      ? [
          {
            label: 'Net Worth + Investments',
            data: data.netWorth.map((d: any) => d.balance + data.investmentValue),
            color: '#10b981',
            fill: false,
          },
        ]
      : []),
  ]);

  const changePrefix = data.netWorthChange.absolute >= 0 ? '↑' : '↓';
  const changeColor = data.netWorthChange.absolute >= 0 ? 'text-success' : 'text-error';
</script>

<div class="flex flex-col gap-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Balance Trends</h2>
    <RangeSelector activeRange={data.range} />
  </div>

  <!-- View toggle -->
  <div role="tablist" class="tabs tabs-bordered">
    <button
      role="tab"
      class="tab"
      class:tab-active={activeView === 'accounts'}
      onclick={() => (activeView = 'accounts')}
    >
      Per Account
    </button>
    <button
      role="tab"
      class="tab"
      class:tab-active={activeView === 'networth'}
      onclick={() => (activeView = 'networth')}
    >
      Net Worth
    </button>
  </div>

  <!-- Chart -->
  <div class="card bg-base-200">
    <div class="card-body p-3">
      {#if activeView === 'accounts'}
        <BalanceChart labels={data.labels} datasets={accountDatasets} />
      {:else}
        <BalanceChart labels={data.labels} datasets={netWorthDatasets} />
      {/if}
    </div>
  </div>

  <!-- Summary stats -->
  <div class="stats stats-horizontal w-full shadow">
    <div class="stat">
      <div class="stat-title">Net Worth</div>
      <div class="stat-value text-lg">{formatRupiah(data.currentNetWorth)}</div>
    </div>
    <div class="stat">
      <div class="stat-title">{data.range}D Change</div>
      <div class="stat-value text-lg {changeColor}">
        {changePrefix}{Math.abs(data.netWorthChange.percent)}%
      </div>
      <div class="stat-desc {changeColor}">
        {data.netWorthChange.absolute >= 0 ? '+' : ''}{formatRupiah(data.netWorthChange.absolute)}
      </div>
    </div>
    {#if data.investmentValue > 0}
      <div class="stat">
        <div class="stat-title">Investments</div>
        <div class="stat-value text-lg">{formatRupiah(data.investmentValue)}</div>
      </div>
    {/if}
  </div>
</div>
```

**Step 2: Verify the page renders**

```bash
cd arsa-app && npm run dev
```

Navigate to http://localhost:5173/trends. Verify chart renders (may show empty if no transactions exist yet). Toggle between Per Account and Net Worth views. Click 7D/30D/90D buttons.

**Step 3: Commit**

```bash
git add arsa-app/src/routes/trends/+page.svelte
git commit -m "feat: add trends page with chart views and range selector"
```

---

### Task 6: Dashboard Sparkline Widget

**Files:**
- Modify: `arsa-app/src/routes/+page.server.ts` (add trend data to existing load)
- Modify: `arsa-app/src/routes/+page.svelte` (add sparkline widget)

**Step 1: Add trend data to dashboard load function**

In `arsa-app/src/routes/+page.server.ts`, add to the existing load function (after auth check and family check):

```typescript
import { computeDailyBalances, computeNetWorth, computeChange } from '$lib/trends';

// Inside the load function, after existing queries:

const rangeEnd = new Date();
const rangeStart = new Date();
rangeStart.setDate(rangeEnd.getDate() - 29); // 30 days

const startStr = rangeStart.toISOString().split('T')[0];
const endStr = rangeEnd.toISOString().split('T')[0];

const [trendAccountsRes, trendTxnsRes] = await Promise.all([
  supabase
    .from('accounts')
    .select('id, balance')
    .eq('family_id', profile.family_id),
  supabase
    .from('transactions')
    .select('date, amount, type, account_id')
    .eq('family_id', profile.family_id)
    .gte('date', startStr)
    .lte('date', endStr),
]);

const trendAccounts = trendAccountsRes.data ?? [];
const trendTxns = trendTxnsRes.data ?? [];

const allDailyBalances = trendAccounts.map((account) =>
  computeDailyBalances(
    { id: account.id, balance: Number(account.balance) },
    trendTxns
      .filter((t) => t.account_id === account.id)
      .map((t) => ({
        date: t.date,
        amount: Number(t.amount),
        type: t.type as 'in' | 'out' | 'transfer',
        account_id: t.account_id,
      })),
    rangeStart,
    rangeEnd
  )
);

const netWorthTrend = computeNetWorth(allDailyBalances);
const trendChange = computeChange(netWorthTrend);

// Add to return object:
// trend: {
//   data: netWorthTrend.map((d) => d.balance),
//   currentNetWorth: netWorthTrend.length > 0 ? netWorthTrend[netWorthTrend.length - 1].balance : 0,
//   change: trendChange,
// }
```

Return the `trend` object alongside existing return data.

**Step 2: Add sparkline widget to dashboard page**

In `arsa-app/src/routes/+page.svelte`, add the widget (integrate with existing content):

```svelte
<script lang="ts">
  import TrendSparkline from '$lib/components/TrendSparkline.svelte';
  import { formatRupiah } from '$lib/trends';

  let { data } = $props();
</script>

<!-- Add after existing dashboard content -->

{#if data.trend}
  <a href="/trends" class="card bg-base-200 mt-4">
    <div class="card-body p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-bold">Balance Trend</p>
        <span class="text-xs text-base-content/50">30D →</span>
      </div>
      <TrendSparkline data={data.trend.data} />
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold">{formatRupiah(data.trend.currentNetWorth)}</span>
        <span class={data.trend.change.absolute >= 0 ? 'text-success text-sm' : 'text-error text-sm'}>
          {data.trend.change.absolute >= 0 ? '↑' : '↓'}{Math.abs(data.trend.change.percent)}%
        </span>
      </div>
    </div>
  </a>
{/if}
```

**Step 3: Verify on dev server**

```bash
cd arsa-app && npm run dev
```

Navigate to http://localhost:5173/. Verify sparkline widget appears. Tap it — should navigate to `/trends`.

**Step 4: Commit**

```bash
git add arsa-app/src/routes/+page.server.ts arsa-app/src/routes/+page.svelte
git commit -m "feat: add balance trend sparkline widget to dashboard"
```

---

### Task 7: Unit Tests — formatRupiah & computeChange

**Files:**
- Modify: `arsa-app/tests/unit/trends.test.ts`

**Step 1: Add tests for helper functions**

Append to `arsa-app/tests/unit/trends.test.ts`:

```typescript
import { formatRupiah, computeChange } from '$lib/trends';

describe('formatRupiah', () => {
  it('formats zero', () => {
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('formats positive number with locale', () => {
    const result = formatRupiah(1500000);
    expect(result).toContain('Rp');
    expect(result).toContain('1');
    expect(result).toContain('500');
  });

  it('formats negative number', () => {
    const result = formatRupiah(-250000);
    expect(result).toContain('-');
    expect(result).toContain('250');
  });
});

describe('computeChange', () => {
  it('returns zero for single data point', () => {
    const result = computeChange([{ date: '2026-03-01', balance: 1000000 }]);
    expect(result).toEqual({ absolute: 0, percent: 0 });
  });

  it('computes positive change', () => {
    const result = computeChange([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 1200000 },
    ]);
    expect(result.absolute).toBe(200000);
    expect(result.percent).toBe(20);
  });

  it('computes negative change', () => {
    const result = computeChange([
      { date: '2026-03-01', balance: 1000000 },
      { date: '2026-03-02', balance: 800000 },
    ]);
    expect(result.absolute).toBe(-200000);
    expect(result.percent).toBe(-20);
  });

  it('handles zero starting balance', () => {
    const result = computeChange([
      { date: '2026-03-01', balance: 0 },
      { date: '2026-03-02', balance: 500000 },
    ]);
    expect(result.absolute).toBe(500000);
    expect(result.percent).toBe(0);
  });
});
```

**Step 2: Run all trend tests**

```bash
cd arsa-app && npx vitest run tests/unit/trends.test.ts
```

Expected: All tests pass (original 7 + new 8 = 15 total).

**Step 3: Commit**

```bash
git add arsa-app/tests/unit/trends.test.ts
git commit -m "test: add unit tests for formatRupiah and computeChange"
```

---

### Task 8: Smoke Test — Full Flow Verification

**Step 1: Run all unit tests**

```bash
cd arsa-app && npx vitest run
```

Expected: All pass.

**Step 2: Test trends page on dev server**

```bash
cd arsa-app && npm run dev
```

1. Log in → navigate to `/trends`
2. Verify chart renders (empty data shows flat line at current balance)
3. Toggle between "Per Account" and "Net Worth" views
4. Click 7D / 30D / 90D — verify URL updates and chart re-renders
5. If transactions exist: verify line moves based on spending patterns
6. Go to dashboard (`/`) — verify sparkline widget shows
7. Tap sparkline → verify navigation to `/trends`

**Step 3: Test responsive layout**

Open DevTools → toggle device mode → 375px width:
- Chart should fill width
- Range selector buttons should be tappable
- Stats row should not overflow

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: smoke test fixes for balance trends"
```
