# Phase 2: Core UI & Transaction Entry Design

**Date:** 2026-03-03
**Scope:** Dashboard, account/category CRUD, transaction entry with split bill, transaction history

## Architecture

Server-first with SvelteKit form actions (`+page.server.ts`) for all CRUD. Consistent with Phase 1 auth pattern. `use:enhance` for seamless submissions. Client-side `$state` only for split bill dynamic line items.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — total balance, budget progress, recent transactions |
| `/history` | Transaction history grouped by date, paginated |
| `/settings` | Settings hub |
| `/settings/accounts` | List accounts |
| `/settings/accounts/new` | Add account |
| `/settings/accounts/[id]` | Edit/delete account |
| `/settings/categories` | List categories |
| `/settings/categories/new` | Add category |
| `/settings/categories/[id]` | Edit/delete category |

Plus: transaction modal (not a route, opened from bottom nav Add button).

## Dashboard (Home)

- Total balance: sum of all account balances, displayed with daisyUI `stat`
- Monthly budget: per-category progress bars (green < 75%, yellow 75-90%, red > 90%)
- Recent 5 transactions as compact list, link to `/history`

## Account CRUD

- Fields: name, type (bank/e-wallet/cash), initial balance
- Delete blocked if account has transactions (cascade would destroy data)
- Any role can manage accounts

## Category CRUD

- Fields: name, monthly_limit (optional), is_child_related (checkbox)
- Admin-only: create/edit/delete + budget limits. Member can view only.
- Delete blocked if transactions reference the category

## Transaction Entry

Bottom sheet modal (daisyUI `modal`) triggered by Add button in nav.

Fields:
- Type: out (default) / in / transfer — toggle tabs
- Amount: numeric input, `inputmode="decimal"`, large font, auto-focus
- Account: select
- Category: select (hidden for transfer)
- Transfer to: select (only for transfer type)
- Date: defaults to today
- Merchant: optional text
- Notes: optional text
- Private: checkbox

Split bill mode:
- Toggle activates line items UI
- Amount field becomes the total
- Dynamic list of line items: amount + category each
- Client-side validation: items must sum to total
- On submit: each line item → separate transaction row with shared `group_id`

Balance update done in form action (read → apply delta → update).

## Transaction History

- Grouped by date (Today, Yesterday, formatted date)
- 50 per page, "Load more" button
- Each row: category dot + name, merchant, colored amount (red/green/blue), account name
- Private transactions: redact merchant + notes for non-creator. Amount + category still visible.
- Tap → detail view (edit deferred)

## Bottom Nav Updates

- Real `<a>` links with active state based on `$page.url.pathname`
- Add button opens modal instead of navigating

## DB Migration

Add nullable `group_id uuid` column to `transactions` table for split bill grouping.

## Out of Scope

Receipt upload/OCR, bank reconciliation, investments, gamification.
