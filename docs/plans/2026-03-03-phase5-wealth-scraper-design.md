# Phase 5: Wealth Tracker & Market Scraper Design

**Date:** 2026-03-03
**Scope:** Rust/Wasm market scraper Worker, portfolio UI with buy/sell, home page tabs

## Market Scraper

### Architecture
Standalone Rust/Wasm Cloudflare Worker in `workers/market-scraper/`. Uses `worker-rs` crate. Deployed independently from the SvelteKit app.

### Cron Schedule
`0 2,6 * * *` (02:00 and 06:00 UTC = 09:00 and 13:00 WIB)

### Data Sources
- **Gold:** Scrape `https://www.logammulia.com/id` → extract Antam gold buy/sell prices → upsert `market_rates` with `asset_code = 'ANTAM'`, `asset_type = 'gold'`
- **Stocks:** Scrape IDX (Bursa Efek Indonesia) for predefined tickers (BBCA, BBRI, TLKM, BMRI) → upsert `market_rates` with `asset_type = 'stock'`

### Supabase Write
HTTP POST/PATCH to Supabase PostgREST endpoint using `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS.

### Worker Env Secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Error Handling
If one source fails, log error and continue with others. Partial updates acceptable.

## Portfolio UI

### Home Page Tabs
`/` gets two tabs: **Cash Flow** (existing dashboard) and **Wealth** (portfolio). Tab state via `$state`.

### Wealth Tab
- **Total Portfolio Value** — stat component. Sum of `qty × current_price` across all investments.
- **Total Floating P/L** — stat component, green/red. Sum of `(current_price × qty) - (avg_buy_price × qty)`.
- **Holdings list** — per asset: code, quantity, current value, P/L amount + percentage, last updated.

Data: `investments` joined with `market_rates` on `asset_code`.

## Buy/Sell Forms

Modal on Wealth tab. API endpoint: `POST /api/investments` with `{ action, asset_code, asset_type, qty, price }`.

### Buy
- Select asset from `market_rates` or enter new ticker
- Quantity + buy price (defaults to current market buy price)
- Existing holding: update qty, recalculate weighted avg: `new_avg = ((old_qty × old_avg) + (new_qty × new_price)) / (old_qty + new_qty)`
- New holding: insert into `investments`

### Sell
- Quantity to sell (max = current holding)
- Sell price per unit
- Reduce qty. If zero, delete row. Avg buy price unchanged (historical cost basis).

## Out of Scope
Mutual fund scraping, investment transaction history, charts, dividend tracking.
