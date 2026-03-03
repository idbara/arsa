# Phase 5: Wealth Tracker & Market Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Rust/Wasm Cloudflare Worker that scrapes Antam gold prices and IDX stock data on a cron schedule, plus a portfolio UI with buy/sell forms on the home page.

**Architecture:** Standalone Rust Worker in `workers/market-scraper/` deployed independently. Scrapes Logam Mulia HTML for gold and IDX JSON API for stocks, upserts into Supabase `market_rates` via PostgREST. SvelteKit app adds Home page tabs (Cash Flow / Wealth), a server-side investments API endpoint, and client-side portfolio display with buy/sell modal.

**Tech Stack:** Rust (`worker` crate, `scraper` for HTML parsing, `serde_json`), Cloudflare Workers (Wasm), Supabase PostgREST, SvelteKit, daisyUI

**Prerequisites:** Phase 2 complete (home dashboard, transactions working). Supabase `market_rates` and `investments` tables exist (created in Phase 1 migration).

---

### Task 1: Scaffold Rust Worker Project

**Files:**
- Create: `workers/market-scraper/Cargo.toml`
- Create: `workers/market-scraper/src/lib.rs`
- Create: `workers/market-scraper/wrangler.toml`

**Step 1: Create the project directory**

```bash
mkdir -p workers/market-scraper/src
```

**Step 2: Create `Cargo.toml`**

File: `workers/market-scraper/Cargo.toml`

```toml
[package]
name = "market-scraper"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
worker = "0.5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
scraper = "0.22"

[profile.release]
opt-level = "s"
lto = true
```

**Step 3: Create `wrangler.toml`**

File: `workers/market-scraper/wrangler.toml`

```toml
name = "arsa-market-scraper"
main = "build/worker/shim.mjs"
compatibility_date = "2024-01-01"

[build]
command = "cargo install worker-build && worker-build --release"

[triggers]
crons = ["0 2,6 * * *"]

[vars]
# Set via `wrangler secret put`
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
```

**Step 4: Create minimal `src/lib.rs`**

File: `workers/market-scraper/src/lib.rs`

```rust
use worker::*;

#[event(scheduled)]
async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    console_log!("Market scraper triggered");

    let supabase_url = env.var("SUPABASE_URL").unwrap().to_string();
    let supabase_key = env.secret("SUPABASE_SERVICE_ROLE_KEY").unwrap().to_string();

    if let Err(e) = scrape_gold(&supabase_url, &supabase_key).await {
        console_error!("Gold scraper error: {}", e);
    }

    if let Err(e) = scrape_stocks(&supabase_url, &supabase_key).await {
        console_error!("Stock scraper error: {}", e);
    }

    console_log!("Market scraper completed");
}

async fn scrape_gold(_supabase_url: &str, _supabase_key: &str) -> Result<()> {
    // Implemented in Task 2
    Ok(())
}

async fn scrape_stocks(_supabase_url: &str, _supabase_key: &str) -> Result<()> {
    // Implemented in Task 3
    Ok(())
}
```

**Step 5: Verify the project compiles**

```bash
cd workers/market-scraper && cargo check
```

Expected: Compiles without errors.

---

### Task 2: Implement Gold Scraper (Logam Mulia)

**Files:**
- Modify: `workers/market-scraper/src/lib.rs`

**Step 1: Implement the gold scraper function**

Replace the `scrape_gold` stub with:

```rust
use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Serialize)]
struct MarketRate {
    asset_code: String,
    asset_type: String,
    buy_price: f64,
    sell_price: f64,
}

async fn scrape_gold(supabase_url: &str, supabase_key: &str) -> Result<()> {
    // Fetch buy price page
    let buy_resp = Fetch::Url(
        Url::parse("https://www.logammulia.com/id/harga-emas-hari-ini")
            .map_err(|e| Error::RustError(e.to_string()))?
    )
        .send()
        .await?;
    let buy_html = buy_resp.text().await?;

    let buy_price = parse_gold_price(&buy_html, "buy")
        .ok_or_else(|| Error::RustError("Failed to parse gold buy price".into()))?;

    // Fetch sell/buyback price page
    let sell_resp = Fetch::Url(
        Url::parse("https://www.logammulia.com/id/sell/gold")
            .map_err(|e| Error::RustError(e.to_string()))?
    )
        .send()
        .await?;
    let sell_html = sell_resp.text().await?;

    let sell_price = parse_gold_price(&sell_html, "sell")
        .ok_or_else(|| Error::RustError("Failed to parse gold sell price".into()))?;

    console_log!("Gold prices - buy: {}, sell: {}", buy_price, sell_price);

    let rate = MarketRate {
        asset_code: "ANTAM".to_string(),
        asset_type: "gold".to_string(),
        buy_price,
        sell_price,
    };

    upsert_market_rate(supabase_url, supabase_key, &rate).await?;

    Ok(())
}

fn parse_gold_price(html: &str, price_type: &str) -> Option<f64> {
    let document = Html::parse_document(html);

    match price_type {
        "buy" => {
            // Logam Mulia buy page: look for 1gr price in the table
            // The price table has rows with gram weights and prices
            let row_sel = Selector::parse("table tbody tr").ok()?;
            for row in document.select(&row_sel) {
                let text: String = row.text().collect();
                if text.contains("1 gr") || text.contains("1gr") {
                    // Extract the price number from the row
                    let price = extract_number(&text)?;
                    return Some(price);
                }
            }
            None
        }
        "sell" => {
            // Buyback page: look for #valBasePrice or main price element
            let sel = Selector::parse("#valBasePrice").ok()?;
            if let Some(el) = document.select(&sel).next() {
                let text: String = el.text().collect();
                return extract_number(&text);
            }
            // Fallback: look for price in common selectors
            let sel = Selector::parse(".price, .harga").ok()?;
            if let Some(el) = document.select(&sel).next() {
                let text: String = el.text().collect();
                return extract_number(&text);
            }
            None
        }
        _ => None,
    }
}

fn extract_number(text: &str) -> Option<f64> {
    // Remove "Rp", dots (thousand sep), spaces, and parse
    let cleaned: String = text
        .replace("Rp", "")
        .replace('.', "")
        .replace(',', ".")
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    cleaned.parse::<f64>().ok()
}
```

**Step 2: Verify it compiles**

```bash
cd workers/market-scraper && cargo check
```

Expected: Compiles without errors.

---

### Task 3: Implement Stock Scraper (IDX)

**Files:**
- Modify: `workers/market-scraper/src/lib.rs`

**Step 1: Implement the stock scraper function**

Replace the `scrape_stocks` stub with:

```rust
async fn scrape_stocks(supabase_url: &str, supabase_key: &str) -> Result<()> {
    let tickers = ["BBCA", "BBRI", "TLKM", "BMRI"];

    let resp = Fetch::Url(
        Url::parse(
            "https://www.idx.co.id/primary/TradingSummary/GetStockSummary?length=9999&start=0"
        )
            .map_err(|e| Error::RustError(e.to_string()))?
    )
        .send()
        .await?;

    let body = resp.text().await?;
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| Error::RustError(format!("IDX JSON parse error: {}", e)))?;

    let data = json["data"]
        .as_array()
        .ok_or_else(|| Error::RustError("IDX response missing data array".into()))?;

    for item in data {
        let code = item["StockCode"].as_str().unwrap_or("");
        if !tickers.contains(&code) {
            continue;
        }

        // IDX provides Close price, OpenPrice, etc.
        let close = item["Close"].as_f64().unwrap_or(0.0);
        let prev = item["Previous"].as_f64().unwrap_or(close);

        // For stocks: buy_price = current close, sell_price = current close
        // (single price point, not bid/ask spread)
        let rate = MarketRate {
            asset_code: code.to_string(),
            asset_type: "stock".to_string(),
            buy_price: close,
            sell_price: close,
        };

        console_log!("Stock {} - price: {}", code, close);

        if let Err(e) = upsert_market_rate(supabase_url, supabase_key, &rate).await {
            console_error!("Failed to upsert {}: {}", code, e);
            // Continue with other tickers
        }
    }

    Ok(())
}
```

**Step 2: Verify it compiles**

```bash
cd workers/market-scraper && cargo check
```

Expected: Compiles without errors.

---

### Task 4: Implement Supabase PostgREST Upsert

**Files:**
- Modify: `workers/market-scraper/src/lib.rs`

**Step 1: Implement the upsert function**

Add below the `extract_number` function:

```rust
async fn upsert_market_rate(
    supabase_url: &str,
    supabase_key: &str,
    rate: &MarketRate,
) -> Result<()> {
    let url = format!(
        "{}/rest/v1/market_rates?on_conflict=asset_code",
        supabase_url
    );

    let body = serde_json::to_string(rate)
        .map_err(|e| Error::RustError(e.to_string()))?;

    let mut headers = Headers::new();
    headers.set("apikey", supabase_key)?;
    headers.set("Authorization", &format!("Bearer {}", supabase_key))?;
    headers.set("Content-Type", "application/json")?;
    headers.set("Prefer", "resolution=merge-duplicates")?;

    let request = Request::new_with_init(
        &url,
        RequestInit::new()
            .with_method(Method::Post)
            .with_headers(headers)
            .with_body(Some(body.into())),
    )?;

    let resp = Fetch::Request(request).send().await?;
    let status = resp.status_code();

    if status >= 400 {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(Error::RustError(format!(
            "Supabase upsert failed ({}): {}",
            status, err_text
        )));
    }

    console_log!("Upserted {} successfully", rate.asset_code);
    Ok(())
}
```

**Step 2: Verify it compiles**

```bash
cd workers/market-scraper && cargo check
```

Expected: Compiles without errors.

---

### Task 5: Set Worker Secrets and Test Deploy

**Step 1: Set secrets via wrangler**

```bash
cd workers/market-scraper
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Enter the values when prompted.

**Step 2: Build the worker**

```bash
cd workers/market-scraper && npx wrangler deploy --dry-run
```

Expected: Build succeeds, outputs the compiled Wasm worker.

**Step 3: Deploy the worker**

```bash
cd workers/market-scraper && npx wrangler deploy
```

Expected: Worker deployed with cron triggers `0 2,6 * * *`.

**Step 4: Test with manual trigger**

```bash
cd workers/market-scraper && npx wrangler dev --test-scheduled
```

Then in another terminal:

```bash
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
```

Check the wrangler dev console output for `Gold prices - buy: ..., sell: ...` and `Stock BBCA - price: ...` log lines.

**Step 5: Verify Supabase data**

Check `market_rates` table in Supabase dashboard. Should have rows for ANTAM, BBCA, BBRI, TLKM, BMRI with populated prices.

---

### Task 6: Home Page Tabs (Cash Flow / Wealth)

**Files:**
- Modify: `arsa-app/src/routes/+page.svelte`
- Modify: `arsa-app/src/routes/+page.server.ts`

**Step 1: Update server load to fetch investments**

Add to the existing `+page.server.ts` load function — fetch investments joined with market rates:

```typescript
  // Existing dashboard data above...

  // Fetch investments with market rates for Wealth tab
  const { data: investments } = await supabase
    .from('investments')
    .select('id, asset_code, qty, avg_buy_price, market_rates(asset_code, asset_type, buy_price, sell_price, updated_at)')
    .eq('family_id', familyId);

  // Fetch all market rates for the buy form dropdown
  const { data: marketRates } = await supabase
    .from('market_rates')
    .select('asset_code, asset_type, buy_price, sell_price, updated_at');

  return {
    // ...existing return values,
    investments: investments ?? [],
    marketRates: marketRates ?? []
  };
```

**Step 2: Add tabs to the home page**

Wrap the existing dashboard content in a tab structure. At the top of the template in `+page.svelte`:

```svelte
<script lang="ts">
  let { data } = $props();

  let activeTab = $state<'cashflow' | 'wealth'>('cashflow');
</script>

<div role="tablist" class="tabs tabs-bordered mb-6">
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'cashflow'}
    onclick={() => activeTab = 'cashflow'}
  >
    Cash Flow
  </button>
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'wealth'}
    onclick={() => activeTab = 'wealth'}
  >
    Wealth
  </button>
</div>

{#if activeTab === 'cashflow'}
  <!-- Move ALL existing dashboard content here -->
  <!-- Balance stat, budget progress, recent transactions, etc. -->
{:else}
  <!-- Wealth tab content (Task 8) -->
  <WealthTab investments={data.investments} marketRates={data.marketRates} />
{/if}
```

---

### Task 7: Investments API Endpoint

**Files:**
- Create: `arsa-app/src/routes/api/investments/+server.ts`

**Step 1: Create the endpoint**

File: `src/routes/api/investments/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) error(401, 'Unauthorized');

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) error(403, 'No family');

  const body = await request.json();
  const { action, asset_code, asset_type, qty, price } = body;

  if (!action || !asset_code || !qty || !price) {
    error(400, 'Missing required fields');
  }

  if (qty <= 0 || price <= 0) {
    error(400, 'Quantity and price must be positive');
  }

  const familyId = profile.family_id;

  if (action === 'buy') {
    // Check for existing holding
    const { data: existing } = await supabase
      .from('investments')
      .select('id, qty, avg_buy_price')
      .eq('family_id', familyId)
      .eq('asset_code', asset_code)
      .single();

    if (existing) {
      // Update: weighted average
      const oldQty = Number(existing.qty);
      const oldAvg = Number(existing.avg_buy_price);
      const newQty = oldQty + qty;
      const newAvg = ((oldQty * oldAvg) + (qty * price)) / newQty;

      const { error: updateErr } = await supabase
        .from('investments')
        .update({ qty: newQty, avg_buy_price: newAvg })
        .eq('id', existing.id);

      if (updateErr) error(500, updateErr.message);
    } else {
      // Insert new holding
      // Ensure market_rates has this asset_code (upsert if new ticker)
      if (asset_type) {
        await supabase
          .from('market_rates')
          .upsert(
            { asset_code, asset_type, buy_price: price, sell_price: price },
            { onConflict: 'asset_code' }
          );
      }

      const { error: insertErr } = await supabase
        .from('investments')
        .insert({
          family_id: familyId,
          asset_code,
          qty,
          avg_buy_price: price
        });

      if (insertErr) error(500, insertErr.message);
    }

    return json({ success: true });
  }

  if (action === 'sell') {
    const { data: existing } = await supabase
      .from('investments')
      .select('id, qty, avg_buy_price')
      .eq('family_id', familyId)
      .eq('asset_code', asset_code)
      .single();

    if (!existing) error(404, 'No holding found');

    const currentQty = Number(existing.qty);
    if (qty > currentQty) {
      error(400, `Cannot sell more than current holding (${currentQty})`);
    }

    const remainingQty = currentQty - qty;

    if (remainingQty === 0) {
      // Delete the row
      const { error: deleteErr } = await supabase
        .from('investments')
        .delete()
        .eq('id', existing.id);

      if (deleteErr) error(500, deleteErr.message);
    } else {
      // Reduce qty, keep avg_buy_price unchanged
      const { error: updateErr } = await supabase
        .from('investments')
        .update({ qty: remainingQty })
        .eq('id', existing.id);

      if (updateErr) error(500, updateErr.message);
    }

    return json({ success: true });
  }

  error(400, 'Invalid action. Use "buy" or "sell".');
};
```

---

### Task 8: Wealth Tab Component

**Files:**
- Create: `arsa-app/src/lib/components/WealthTab.svelte`

**Step 1: Create the component**

File: `src/lib/components/WealthTab.svelte`

```svelte
<script lang="ts">
  import InvestmentModal from './InvestmentModal.svelte';

  interface Investment {
    id: string;
    asset_code: string;
    qty: number;
    avg_buy_price: number;
    market_rates: {
      asset_code: string;
      asset_type: string;
      buy_price: number;
      sell_price: number;
      updated_at: string;
    } | null;
  }

  interface MarketRate {
    asset_code: string;
    asset_type: string;
    buy_price: number;
    sell_price: number;
    updated_at: string;
  }

  let { investments, marketRates }: {
    investments: Investment[];
    marketRates: MarketRate[];
  } = $props();

  let showModal = $state(false);
  let modalAction = $state<'buy' | 'sell'>('buy');
  let selectedAsset = $state('');

  let holdings = $derived(
    investments.map((inv) => {
      const rate = inv.market_rates;
      const currentPrice = rate?.sell_price ?? 0;
      const currentValue = inv.qty * currentPrice;
      const costBasis = inv.qty * inv.avg_buy_price;
      const pl = currentValue - costBasis;
      const plPercent = costBasis > 0 ? (pl / costBasis) * 100 : 0;

      return {
        ...inv,
        currentPrice,
        currentValue,
        pl,
        plPercent,
        assetType: rate?.asset_type ?? 'unknown',
        updatedAt: rate?.updated_at ?? ''
      };
    })
  );

  let totalValue = $derived(holdings.reduce((sum, h) => sum + h.currentValue, 0));
  let totalPl = $derived(holdings.reduce((sum, h) => sum + h.pl, 0));
  let totalCost = $derived(holdings.reduce((sum, h) => sum + h.qty * h.avg_buy_price, 0));
  let totalPlPercent = $derived(totalCost > 0 ? (totalPl / totalCost) * 100 : 0);

  function openBuy() {
    modalAction = 'buy';
    selectedAsset = '';
    showModal = true;
  }

  function openSell(assetCode: string) {
    modalAction = 'sell';
    selectedAsset = assetCode;
    showModal = true;
  }

  function formatRp(n: number): string {
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  function formatDate(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<!-- Stats -->
<div class="stats stats-vertical w-full shadow mb-4">
  <div class="stat">
    <div class="stat-title">Total Portfolio Value</div>
    <div class="stat-value text-primary text-2xl">{formatRp(totalValue)}</div>
  </div>
  <div class="stat">
    <div class="stat-title">Floating P/L</div>
    <div class="stat-value text-2xl" class:text-success={totalPl >= 0} class:text-error={totalPl < 0}>
      {totalPl >= 0 ? '+' : ''}{formatRp(totalPl)}
      <span class="text-base font-normal">
        ({totalPl >= 0 ? '+' : ''}{totalPlPercent.toFixed(1)}%)
      </span>
    </div>
  </div>
</div>

<!-- Buy Button -->
<button class="btn btn-primary w-full mb-4" onclick={openBuy}>
  + Buy Asset
</button>

<!-- Holdings List -->
{#if holdings.length === 0}
  <div class="text-center text-base-content/60 py-8">
    <p>No investments yet.</p>
    <p class="text-sm">Tap "Buy Asset" to add your first holding.</p>
  </div>
{:else}
  <div class="flex flex-col gap-3">
    {#each holdings as h}
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body p-4">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-bold text-lg">{h.asset_code}</span>
              <span class="badge badge-sm badge-ghost ml-2">{h.assetType}</span>
            </div>
            <button
              class="btn btn-ghost btn-sm text-error"
              onclick={() => openSell(h.asset_code)}
            >
              Sell
            </button>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
            <span class="text-base-content/60">Qty</span>
            <span class="text-right font-mono">{h.qty}</span>

            <span class="text-base-content/60">Avg Buy</span>
            <span class="text-right font-mono">{formatRp(h.avg_buy_price)}</span>

            <span class="text-base-content/60">Current</span>
            <span class="text-right font-mono">{formatRp(h.currentPrice)}</span>

            <span class="text-base-content/60">Value</span>
            <span class="text-right font-mono font-bold">{formatRp(h.currentValue)}</span>

            <span class="text-base-content/60">P/L</span>
            <span
              class="text-right font-mono"
              class:text-success={h.pl >= 0}
              class:text-error={h.pl < 0}
            >
              {h.pl >= 0 ? '+' : ''}{formatRp(h.pl)} ({h.pl >= 0 ? '+' : ''}{h.plPercent.toFixed(1)}%)
            </span>
          </div>

          <div class="text-xs text-base-content/40 mt-1">
            Updated: {formatDate(h.updatedAt)}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- Modal -->
{#if showModal}
  <InvestmentModal
    action={modalAction}
    assetCode={selectedAsset}
    {marketRates}
    {investments}
    onclose={() => showModal = false}
  />
{/if}
```

---

### Task 9: Buy/Sell Modal Component

**Files:**
- Create: `arsa-app/src/lib/components/InvestmentModal.svelte`

**Step 1: Create the modal**

File: `src/lib/components/InvestmentModal.svelte`

```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  interface MarketRate {
    asset_code: string;
    asset_type: string;
    buy_price: number;
    sell_price: number;
  }

  interface Investment {
    asset_code: string;
    qty: number;
  }

  let {
    action,
    assetCode: initialAssetCode = '',
    marketRates,
    investments,
    onclose
  }: {
    action: 'buy' | 'sell';
    assetCode?: string;
    marketRates: MarketRate[];
    investments: Investment[];
    onclose: () => void;
  } = $props();

  let assetCode = $state(initialAssetCode);
  let assetType = $state('stock');
  let customTicker = $state('');
  let qty = $state('');
  let price = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');

  let isCustom = $state(false);

  let selectedRate = $derived(
    marketRates.find((r) => r.asset_code === assetCode)
  );

  let currentHolding = $derived(
    investments.find((i) => i.asset_code === (isCustom ? customTicker : assetCode))
  );

  let maxSellQty = $derived(currentHolding ? Number(currentHolding.qty) : 0);

  // Auto-fill price when asset selected
  $effect(() => {
    if (selectedRate && !price) {
      price = String(selectedRate.buy_price);
    }
  });

  async function handleSubmit() {
    const finalCode = isCustom ? customTicker.toUpperCase().trim() : assetCode;
    const qtyNum = parseFloat(qty);
    const priceNum = parseFloat(price);

    if (!finalCode) { errorMsg = 'Select or enter an asset'; return; }
    if (!qtyNum || qtyNum <= 0) { errorMsg = 'Enter a valid quantity'; return; }
    if (!priceNum || priceNum <= 0) { errorMsg = 'Enter a valid price'; return; }
    if (action === 'sell' && qtyNum > maxSellQty) {
      errorMsg = `Max sell quantity is ${maxSellQty}`;
      return;
    }

    submitting = true;
    errorMsg = '';

    try {
      const res = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          asset_code: finalCode,
          asset_type: isCustom ? assetType : (selectedRate?.asset_type ?? 'stock'),
          qty: qtyNum,
          price: priceNum
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Request failed' }));
        errorMsg = data.message || 'Something went wrong';
        return;
      }

      await invalidateAll();
      onclose();
    } catch {
      errorMsg = 'Network error';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="modal modal-open">
  <div class="modal-box">
    <h3 class="font-bold text-lg mb-4">
      {action === 'buy' ? 'Buy Asset' : `Sell ${initialAssetCode}`}
    </h3>

    <form onsubmit|preventDefault={handleSubmit} class="flex flex-col gap-4">
      {#if action === 'buy'}
        <!-- Asset Selection -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-2 mb-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={isCustom}
            />
            <span class="label-text">Enter custom ticker</span>
          </label>

          {#if isCustom}
            <input
              type="text"
              class="input input-bordered w-full"
              placeholder="Ticker (e.g. UNVR)"
              bind:value={customTicker}
            />
            <select class="select select-bordered w-full mt-2" bind:value={assetType}>
              <option value="stock">Stock</option>
              <option value="gold">Gold</option>
            </select>
          {:else}
            <select class="select select-bordered w-full" bind:value={assetCode}>
              <option value="">Select asset...</option>
              {#each marketRates as rate}
                <option value={rate.asset_code}>
                  {rate.asset_code} ({rate.asset_type}) — Rp {rate.buy_price.toLocaleString('id-ID')}
                </option>
              {/each}
            </select>
          {/if}
        </div>
      {/if}

      <!-- Quantity -->
      <label class="floating-label">
        <span>Quantity {action === 'sell' ? `(max: ${maxSellQty})` : ''}</span>
        <input
          type="number"
          inputmode="decimal"
          placeholder="Quantity"
          class="input input-bordered w-full"
          bind:value={qty}
          step="any"
          min="0"
          max={action === 'sell' ? maxSellQty : undefined}
        />
      </label>

      <!-- Price -->
      <label class="floating-label">
        <span>{action === 'buy' ? 'Buy' : 'Sell'} Price per Unit</span>
        <input
          type="number"
          inputmode="decimal"
          placeholder="Price per unit"
          class="input input-bordered w-full"
          bind:value={price}
          step="any"
          min="0"
        />
      </label>

      {#if errorMsg}
        <p class="text-error text-sm">{errorMsg}</p>
      {/if}

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            {action === 'buy' ? 'Buy' : 'Sell'}
          {/if}
        </button>
      </div>
    </form>
  </div>
  <div class="modal-backdrop" onclick={onclose}></div>
</div>
```

---

### Task 10: Final Verification

**Step 1: Build the Rust Worker**

```bash
cd workers/market-scraper && cargo check
```

Expected: Compiles without errors.

**Step 2: Start the SvelteKit dev server**

```bash
cd arsa-app && npm run dev
```

**Step 3: Test Wealth tab**

1. Navigate to Home → tap "Wealth" tab
2. Verify "Total Portfolio Value" shows Rp 0 and empty state message
3. Tap "Buy Asset" → modal opens

**Step 4: Test Buy flow**

1. In Buy modal, select an asset from dropdown (e.g. BBCA)
2. Price auto-fills with current market price
3. Enter quantity (e.g. 10)
4. Tap "Buy" → modal closes, holding appears in list
5. Buy same asset again → verify qty increases and avg price recalculates

**Step 5: Test Sell flow**

1. Tap "Sell" on a holding
2. Enter quantity ≤ current holding
3. Tap "Sell" → qty reduces
4. Sell entire remaining qty → holding disappears from list

**Step 6: Test custom ticker Buy**

1. "Buy Asset" → check "Enter custom ticker"
2. Type "UNVR", select "Stock", enter qty and price
3. Tap "Buy" → new holding appears

**Step 7: Verify P/L calculations**

1. With holdings present, verify:
   - Current Value = qty × sell_price from market_rates
   - P/L = Current Value - (qty × avg_buy_price)
   - P/L % = P/L / (qty × avg_buy_price) × 100
   - Green for positive, red for negative
   - Totals at top are sums of all holdings

**Step 8: Build + lint**

```bash
cd arsa-app && npm run build && npm run lint
```

Expected: No errors.
