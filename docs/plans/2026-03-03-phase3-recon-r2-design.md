# Phase 3: Bank Reconciliation & R2 Storage Design

**Date:** 2026-03-03
**Scope:** Client-side CSV bank reconciliation (BCA + Mandiri), receipt photo capture with R2 presigned upload, receipt viewing

## Bank Reconciliation

### CSV Parsing
- Fully client-side using PapaParse. CSV never leaves browser memory.
- User selects bank (BCA or Mandiri) via dropdown before uploading.
- Bank-specific parsers normalize CSV rows into common shape: `{ date, amount, description }`.
- Dependency: `papaparse` + `@types/papaparse`

### Matching Algorithm
- Exact date + exact amount match against existing Arsa transactions.
- If multiple candidates for one CSV row, show all for user to pick.
- Three states per CSV row: Matched, Unmatched, Skipped.

### UI
- "Reconcile" button at top of `/history` page.
- Flow: select bank → upload CSV → checklist of rows with match status → review → "Apply" sets `is_reconciled = true`.
- Manual checklist mode also available: checkboxes on history transactions to mark reconciled without CSV.

## Receipt Storage

### Image Compression (Client-Side)
- Input: `<input type="file" accept="image/*" capture="environment">` (camera + gallery)
- Canvas API: resize to max 1024px longest side, export JPEG quality 0.7 (~100-200KB)
- Runs entirely in browser before upload

### R2 Upload via Presigned URL
1. Client calls `POST /api/receipts/presign` with filename + content type
2. SvelteKit endpoint generates presigned PUT URL using AWS SDK
3. Browser uploads compressed image directly to R2
4. Object key (e.g. `receipts/{family_id}/{uuid}.jpg`) stored as `receipt_url` on transaction

### Receipt Viewing
- `GET /api/receipts/[key]` generates presigned GET URL, redirects to it
- Modal viewer when tapping receipt icon on transaction

### Integration
- AddTransaction modal gains optional photo attachment field
- Preview shown after capture/selection
- Upload executes when transaction is saved

## Environment Variables (Server-Only)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Dependencies
- `papaparse` + `@types/papaparse`
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`

## Out of Scope
OCR/AI extraction (Phase 4), other bank formats, receipt deletion.
