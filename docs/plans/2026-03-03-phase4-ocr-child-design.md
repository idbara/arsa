# Phase 4: OCR Receipts & Child Expense Module Design

**Date:** 2026-03-03
**Scope:** Receipt OCR via Cloudflare Workers AI, child expense dashboard, education cost projection calculator

## Receipt OCR

### Flow
1. Photo uploaded to R2 (Phase 3 existing flow)
2. "Scan Receipt" button appears next to receipt preview in AddTransaction modal
3. Client calls `POST /api/ocr` with R2 key
4. SvelteKit endpoint generates presigned GET URL, calls Cloudflare Workers AI REST API (Llama 3.2 Vision) with image URL + extraction prompt
5. AI returns `{ nominal, tanggal, merchant }` as JSON
6. Client auto-fills amount, date, merchant in the form
7. User reviews and edits before saving (human-in-the-loop mandatory)

### Error Handling
If AI fails or returns unparseable data, show alert "Could not read receipt" — user fills manually. Never blocks transaction flow.

### Env Var
`CLOUDFLARE_AI_TOKEN` (server-only) — API token with Workers AI permissions.

## Child Expense Dashboard

Lives under `/plan` tab (bottom nav).

### `/plan` Page
- **Child Expenses Summary:** Total child-related spending this month (stat component). Per-category breakdown for categories with `is_child_related = true`.
- **Education Calculator link** → `/plan/education`

No new tables — filtered views of existing transactions + categories.

## Education Cost Projection Calculator

### `/plan/education` — Pure client-side
**Inputs:**
- Child's current age
- Inflation rate (default 6%)
- Current annual cost per level: TK, SD, SMP, SMA, Kuliah

**Output:** Table showing each level's entry age, years until entry, current cost, projected cost.

**Formula:** `projected = currentCost × (1 + inflationRate) ^ yearsUntil`

Skips levels where child has passed that age. Total projected cost at bottom. All reactive via `$derived`.

## Out of Scope
Multi-child profiles, savings goals, AI model fine-tuning, receipt text storage.
