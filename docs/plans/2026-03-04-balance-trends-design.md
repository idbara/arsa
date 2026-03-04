# Balance Trends (Tren Saldo) Design

**Date:** 2026-03-04
**Status:** Approved
**Approach:** Compute-on-request from transactions (Approach A)

---

## Overview

Balance trends feature showing daily account balances and net worth over time, computed on-the-fly from existing transaction data. No new database tables. Chart.js for visualization with a full trends page and a dashboard sparkline widget.

---

## Data Computation

### Algorithm (per account)

1. Start with `account.balance` (current balance)
2. Fetch all transactions for the account in the selected date range, ordered by date DESC
3. For each day from today back to range start:
   - Find transactions on that day
   - Reverse their effect:
     - `type 'out'`: add amount back
     - `type 'in'`: subtract amount
     - `type 'transfer'` where account is source (`account_id`): add amount back
     - `type 'transfer'` where account is destination: subtract amount
   - Record the resulting balance for that day
4. Result: array of `{ date, balance }` per account

### Net Worth

- For each day, sum all account balances
- Optionally add investment portfolio value (qty × current market price) as a constant line (no daily investment history in current schema)

### Server Load

`/trends/+page.server.ts`:
1. Accept `?range=7|30|90` query param (default 30)
2. Fetch all accounts for the family
3. Fetch transactions in the date range
4. Compute daily balances per account
5. Compute daily net worth (sum of all accounts)
6. Return structured data for Chart.js

### Performance

90 days × 5 accounts × ~10 txns/day = ~4,500 transactions max. Single Supabase query, computation in JS. Sub-100ms.

---

## Visualization

### Chart Library

`chart.js` + `svelte-chartjs` (Svelte wrapper)

### Two Views (Toggle)

**Per-Account Balances:**
- Line chart with one line per account
- Distinct color per account (auto-assigned palette)
- Legend at bottom with account names
- Y-axis: Rupiah (`Rp` prefix + locale separators)
- X-axis: dates (day/month, e.g., "5 Mar")
- Tooltip on tap: exact balance + date

**Total Net Worth:**
- Single line with area fill (gradient, semi-transparent)
- Same axis formatting
- If investments exist: second dashed line for "Net Worth + Investments"

### Range Selector

Three buttons (chip/toggle style): **7D** | **30D** | **90D**

Active button highlighted. Changing range reloads via `goto()` with query param.

### Dashboard Mini-Chart

On home page (`/`):
- Small sparkline (no axes, no legend — just the line)
- Shows net worth for last 30 days
- Tapping navigates to `/trends`
- Below: current net worth + change indicator (↑↓ vs 30 days ago)

### Responsive

- Chart fills container width (100%)
- Touch zoom/pan disabled
- Min height 200px

---

## Routes

| Route | Purpose |
|-------|---------|
| `/trends` | Full trends page with chart, range selector, view toggle, summary stats |

---

## Components

| Component | Purpose |
|-----------|---------|
| `BalanceChart.svelte` | Chart.js line chart wrapper — accepts datasets + labels, handles both views |
| `RangeSelector.svelte` | 7D/30D/90D toggle buttons |
| `TrendSparkline.svelte` | Minimal sparkline for dashboard widget |

---

## Page Layouts

### `/trends` Page

```
┌─────────────────────────┐
│ Balance Trends      [?D] │  ← title + range selector
├─────────────────────────┤
│  [Per Account] [Net Worth] │  ← view toggle tabs
├─────────────────────────┤
│                           │
│     ╱‾‾╲    ╱‾‾╲         │  ← Chart.js line chart
│   ╱    ╲╱╱    ╲         │
│  ╱              ╲        │
│                           │
├─────────────────────────┤
│ Summary stats             │
│ Total: Rp X    Δ: ↑Y%    │  ← net worth + change from period start
└─────────────────────────┘
```

### Dashboard Widget

```
┌─────────────────────────┐
│ Balance Trend    →       │  ← tappable card
│ ~~sparkline~~            │
│ Rp 15.000.000    ↑3.2%   │
└─────────────────────────┘
```

---

## Data Flow

1. `/trends/+page.server.ts` — loads accounts + transactions, computes daily balances → returns `{ accounts, dailyBalances, netWorth, range }`
2. `/trends/+page.svelte` — receives data, passes to `BalanceChart` and `RangeSelector`
3. `BalanceChart.svelte` — takes `{ labels: string[], datasets: { label, data, color }[] }`, renders Chart.js
4. Dashboard `+page.server.ts` — loads 30-day net worth only (lightweight) → passes to `TrendSparkline`
