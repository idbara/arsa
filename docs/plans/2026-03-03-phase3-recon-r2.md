# Phase 3: Bank Reconciliation & R2 Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add client-side bank CSV reconciliation (BCA + Mandiri), receipt photo capture with Cloudflare R2 presigned upload, and receipt viewing.

**Architecture:** CSV parsing is fully client-side (PapaParse, never hits server). Receipt images are compressed client-side (Canvas API) and uploaded directly to R2 via presigned PUT URLs. SvelteKit API endpoints generate presigned URLs and serve receipt views.

**Tech Stack:** SvelteKit, PapaParse, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, Cloudflare R2, Canvas API

**Prerequisites:** Phase 2 complete. Cloudflare R2 bucket created (e.g. `arsa-receipts`). R2 API token generated with read/write permissions.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `arsa-app/package.json`

**Step 1: Install packages**

```bash
cd arsa-app && npm install papaparse @aws-sdk/client-s3 @aws-sdk/s3-request-presigner && npm install -D @types/papaparse
```

**Step 2: Verify**

```bash
npm ls papaparse @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: All listed without errors.

---

### Task 2: Update Environment Variables

**Files:**
- Modify: `arsa-app/.env.example`

**Step 1: Add R2 variables to .env.example**

Append to the existing file:

```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=arsa-receipts
```

**Step 2: Add actual values to .env**

Copy the template and fill in real values from Cloudflare dashboard → R2 → Manage R2 API Tokens.

**Important:** Also configure CORS on the R2 bucket. In Cloudflare dashboard → R2 → bucket settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-production-domain.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"]
  }
]
```

---

### Task 3: R2 Client Helper

**Files:**
- Create: `arsa-app/src/lib/server/r2.ts`

**Step 1: Create the R2 S3 client**

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID } from '$env/static/private';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});
```

---

### Task 4: Presigned URL API Endpoints

**Files:**
- Create: `arsa-app/src/routes/api/receipts/presign/+server.ts`
- Create: `arsa-app/src/routes/api/receipts/[...key]/+server.ts`

**Step 1: Create presign endpoint (PUT URL for upload)**

File: `src/routes/api/receipts/presign/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import { r2 } from '$lib/server/r2';
import { R2_BUCKET_NAME } from '$env/static/private';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    error(401, 'Unauthorized');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    error(400, 'No family found');
  }

  const { contentType } = await request.json();

  if (!contentType || !contentType.startsWith('image/')) {
    error(400, 'Invalid content type');
  }

  const key = `receipts/${profile.family_id}/${crypto.randomUUID()}.jpg`;

  const putUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: 300 }
  );

  return json({ putUrl, key });
};
```

**Step 2: Create receipt view endpoint (GET URL for viewing)**

File: `src/routes/api/receipts/[...key]/+server.ts`

```typescript
import { redirect, error } from '@sveltejs/kit';
import { r2 } from '$lib/server/r2';
import { R2_BUCKET_NAME } from '$env/static/private';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    error(401, 'Unauthorized');
  }

  const key = params.key;
  if (!key || !key.startsWith('receipts/')) {
    error(400, 'Invalid key');
  }

  const getUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    }),
    { expiresIn: 3600 }
  );

  redirect(302, getUrl);
};
```

---

### Task 5: Image Compression Utility

**Files:**
- Create: `arsa-app/src/lib/compress-image.ts`

**Step 1: Create the compression function**

```typescript
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
```

---

### Task 6: Receipt Upload Component

**Files:**
- Create: `arsa-app/src/lib/components/ReceiptUpload.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import { compressImage } from '$lib/compress-image';

  let {
    receiptKey = $bindable(''),
  }: {
    receiptKey: string;
  } = $props();

  let previewUrl = $state<string | null>(null);
  let uploading = $state(false);
  let error = $state('');

  async function handleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    error = '';
    uploading = true;

    try {
      // Show preview
      previewUrl = URL.createObjectURL(file);

      // Compress
      const compressed = await compressImage(file);

      // Get presigned URL
      const presignRes = await fetch('/api/receipts/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg' })
      });

      if (!presignRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { putUrl, key } = await presignRes.json();

      // Upload to R2
      const uploadRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: compressed
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      receiptKey = key;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Upload failed';
      previewUrl = null;
      receiptKey = '';
    } finally {
      uploading = false;
    }
  }

  function removeReceipt() {
    previewUrl = null;
    receiptKey = '';
  }
</script>

<div class="flex flex-col gap-2">
  {#if previewUrl}
    <div class="relative">
      <img src={previewUrl} alt="Receipt preview" class="h-32 w-auto rounded-lg object-cover" />
      <button
        class="btn btn-circle btn-error btn-xs absolute -right-2 -top-2"
        onclick={removeReceipt}
      >✕</button>
      {#if uploading}
        <div class="absolute inset-0 flex items-center justify-center rounded-lg bg-base-300/70">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}
    </div>
  {:else}
    <label class="btn btn-ghost btn-sm gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
      </svg>
      Attach Receipt
      <input
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        onchange={handleFile}
      />
    </label>
  {/if}

  {#if error}
    <p class="text-xs text-error">{error}</p>
  {/if}
</div>
```

---

### Task 7: Integrate Receipt Upload into AddTransaction

**Files:**
- Modify: `arsa-app/src/lib/components/AddTransaction.svelte`
- Modify: `arsa-app/src/routes/api/transactions/+server.ts`

**Step 1: Add receipt to AddTransaction component**

In `AddTransaction.svelte`, add the import and state:

```typescript
  import ReceiptUpload from '$lib/components/ReceiptUpload.svelte';

  let receiptKey = $state('');
```

Add the ReceiptUpload component in the form, after the "Notes" input and before the "Private" checkbox:

```svelte
      <!-- Receipt -->
      <ReceiptUpload bind:receiptKey />
```

In the `handleSubmit` function, add `receipt_url` to the POST body:

```typescript
      body: JSON.stringify({
        type,
        account_id: accountId,
        transfer_to: type === 'transfer' ? transferTo : null,
        date,
        merchant,
        notes,
        is_private: isPrivate,
        receipt_url: receiptKey || null,
        items
      })
```

Also reset `receiptKey` after successful submit (before `onClose()`):

```typescript
    receiptKey = '';
```

**Step 2: Update transaction API to save receipt_url**

In `src/routes/api/transactions/+server.ts`, add `receipt_url` to the destructured body:

```typescript
  const { type, account_id, date, merchant, notes, is_private, receipt_url, items } = body;
```

Add it to each transaction object in the `items.map()`:

```typescript
    receipt_url: receipt_url || null,
```

---

### Task 8: Receipt Viewer on Transaction History

**Files:**
- Create: `arsa-app/src/lib/components/ReceiptViewer.svelte`
- Modify: `arsa-app/src/routes/history/+page.svelte`

**Step 1: Create ReceiptViewer modal component**

File: `src/lib/components/ReceiptViewer.svelte`

```svelte
<script lang="ts">
  let {
    receiptUrl,
    onClose
  }: {
    receiptUrl: string;
    onClose: () => void;
  } = $props();

  let imgSrc = $derived(`/api/receipts/${receiptUrl}`);
</script>

<div class="modal modal-open">
  <div class="modal-box flex flex-col items-center">
    <img src={imgSrc} alt="Receipt" class="max-h-[70vh] w-auto rounded-lg" />
    <div class="modal-action">
      <button class="btn" onclick={onClose}>Close</button>
    </div>
  </div>
  <div class="modal-backdrop" onclick={onClose}></div>
</div>
```

**Step 2: Update history page to show receipt icon and viewer**

In `src/routes/history/+page.server.ts`, add `receipt_url` to the select query:

```typescript
    .select('id, amount, type, date, merchant, notes, is_private, user_id, receipt_url, categories(name), accounts(name)', { count: 'exact' })
```

In `src/routes/history/+page.svelte`, add the import and state at the top:

```typescript
  import ReceiptViewer from '$lib/components/ReceiptViewer.svelte';

  let viewingReceipt = $state<string | null>(null);
```

In each transaction row, add a receipt icon button after the amount (inside the flex row):

```svelte
          <div class="flex items-center gap-2">
            {#if tx.receipt_url}
              <button
                class="btn btn-ghost btn-xs btn-square"
                onclick={() => (viewingReceipt = tx.receipt_url)}
                title="View receipt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                </svg>
              </button>
            {/if}
            <span class="font-mono font-bold text-sm {amountColor(tx.type)}">
              {formatAmount(Number(tx.amount), tx.type)}
            </span>
          </div>
```

At the bottom of the page, add the viewer modal:

```svelte
{#if viewingReceipt}
  <ReceiptViewer receiptUrl={viewingReceipt} onClose={() => (viewingReceipt = null)} />
{/if}
```

---

### Task 9: Bank CSV Parsers

**Files:**
- Create: `arsa-app/src/lib/bank-parsers.ts`

**Step 1: Create the parser module**

```typescript
import Papa from 'papaparse';

export interface BankTransaction {
  date: string;       // YYYY-MM-DD
  amount: number;     // positive for credit, negative for debit
  description: string;
}

function parseIndonesianNumber(str: string): number {
  if (!str || str.trim() === '' || str.trim() === '0.00' || str.trim() === '0') return 0;
  return parseFloat(str.replace(/,/g, ''));
}

function parseDateDDMMYYYY(str: string): string {
  const parts = str.trim().split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const year = new Date().getFullYear();
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
}

interface BcaRow {
  'Tanggal Transaksi'?: string;
  Tanggal?: string;
  Keterangan: string;
  'Mutasi Debet'?: string;
  'Mutasi Kredit'?: string;
  Jumlah?: string;
  Mutasi?: string;
}

function parseBcaRow(row: BcaRow): BankTransaction | null {
  const dateStr = row['Tanggal Transaksi'] || row['Tanggal'];
  if (!dateStr) return null;

  const date = parseDateDDMMYYYY(dateStr);
  const description = (row.Keterangan || '').trim();

  let amount: number;

  if (row['Mutasi Debet'] !== undefined && row['Mutasi Kredit'] !== undefined) {
    const debit = parseIndonesianNumber(row['Mutasi Debet']);
    const credit = parseIndonesianNumber(row['Mutasi Kredit']);
    amount = credit > 0 ? credit : -debit;
  } else if (row.Jumlah !== undefined && row.Mutasi !== undefined) {
    const value = parseIndonesianNumber(row.Jumlah);
    amount = row.Mutasi.trim() === 'CR' ? value : -value;
  } else {
    return null;
  }

  return { date, amount, description };
}

interface MandiriRow {
  Tanggal: string;
  Keterangan: string;
  Debet: string;
  Kredit: string;
}

function parseMandiriRow(row: MandiriRow): BankTransaction | null {
  const dateStr = row.Tanggal;
  if (!dateStr) return null;

  const date = parseDateDDMMYYYY(dateStr);
  const description = (row.Keterangan || '').trim();

  const debit = parseIndonesianNumber(row.Debet);
  const credit = parseIndonesianNumber(row.Kredit);
  const amount = credit > 0 ? credit : -debit;

  return { date, amount, description };
}

export type BankType = 'bca' | 'mandiri';

export function parseBankCsv(file: File, bank: BankType): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete(results) {
        const transactions: BankTransaction[] = [];

        for (const row of results.data as Record<string, string>[]) {
          let parsed: BankTransaction | null = null;

          if (bank === 'bca') {
            parsed = parseBcaRow(row as unknown as BcaRow);
          } else if (bank === 'mandiri') {
            parsed = parseMandiriRow(row as unknown as MandiriRow);
          }

          if (parsed && parsed.amount !== 0) {
            transactions.push(parsed);
          }
        }

        resolve(transactions);
      },
      error(err) {
        reject(new Error(err.message));
      }
    });
  });
}
```

---

### Task 10: Reconciliation Matching Logic

**Files:**
- Create: `arsa-app/src/lib/reconcile.ts`

**Step 1: Create the matching module**

```typescript
import type { BankTransaction } from './bank-parsers';

export interface ArsaTransaction {
  id: string;
  date: string;
  amount: number;
  type: string;
  merchant: string | null;
  is_reconciled: boolean;
  categories: { name: string } | null;
  accounts: { name: string } | null;
}

export interface ReconcileMatch {
  bankTx: BankTransaction;
  candidates: ArsaTransaction[];
  selectedId: string | null;
  status: 'matched' | 'unmatched' | 'skipped';
}

export function reconcile(
  bankTransactions: BankTransaction[],
  arsaTransactions: ArsaTransaction[]
): ReconcileMatch[] {
  return bankTransactions.map((bankTx) => {
    const bankAmount = Math.abs(bankTx.amount);
    const bankIsExpense = bankTx.amount < 0;

    const candidates = arsaTransactions.filter((arsa) => {
      if (arsa.is_reconciled) return false;
      if (arsa.date !== bankTx.date) return false;

      const arsaAmount = Math.abs(Number(arsa.amount));
      if (Math.abs(arsaAmount - bankAmount) > 0.01) return false;

      if (bankIsExpense && arsa.type !== 'out') return false;
      if (!bankIsExpense && arsa.type !== 'in') return false;

      return true;
    });

    if (candidates.length === 1) {
      return {
        bankTx,
        candidates,
        selectedId: candidates[0].id,
        status: 'matched' as const
      };
    }

    if (candidates.length > 1) {
      return {
        bankTx,
        candidates,
        selectedId: null,
        status: 'unmatched' as const
      };
    }

    return {
      bankTx,
      candidates: [],
      selectedId: null,
      status: 'unmatched' as const
    };
  });
}
```

---

### Task 11: Reconciliation UI

**Files:**
- Create: `arsa-app/src/lib/components/Reconcile.svelte`
- Modify: `arsa-app/src/routes/history/+page.svelte`
- Create: `arsa-app/src/routes/api/reconcile/+server.ts`

**Step 1: Create reconcile API endpoint**

File: `src/routes/api/reconcile/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    error(401, 'Unauthorized');
  }

  const { transactionIds } = await request.json();

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    error(400, 'No transaction IDs provided');
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ is_reconciled: true })
    .in('id', transactionIds);

  if (updateError) {
    error(500, 'Failed to reconcile transactions');
  }

  return json({ success: true, count: transactionIds.length });
};
```

**Step 2: Create Reconcile component**

File: `src/lib/components/Reconcile.svelte`

```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { parseBankCsv, type BankType } from '$lib/bank-parsers';
  import { reconcile, type ArsaTransaction, type ReconcileMatch } from '$lib/reconcile';

  let {
    arsaTransactions,
    onClose
  }: {
    arsaTransactions: ArsaTransaction[];
    onClose: () => void;
  } = $props();

  let bank = $state<BankType>('bca');
  let matches = $state<ReconcileMatch[]>([]);
  let parseError = $state('');
  let submitting = $state(false);
  let step = $state<'upload' | 'review'>('upload');

  async function handleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    parseError = '';

    try {
      const bankTxs = await parseBankCsv(file, bank);
      if (bankTxs.length === 0) {
        parseError = 'No transactions found in CSV.';
        return;
      }
      matches = reconcile(bankTxs, arsaTransactions);
      step = 'review';
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Failed to parse CSV';
    }
  }

  function selectCandidate(matchIndex: number, txId: string) {
    matches[matchIndex].selectedId = txId;
    matches[matchIndex].status = 'matched';
  }

  function skipMatch(matchIndex: number) {
    matches[matchIndex].selectedId = null;
    matches[matchIndex].status = 'skipped';
  }

  let confirmedIds = $derived(
    matches.filter((m) => m.status === 'matched' && m.selectedId).map((m) => m.selectedId!)
  );

  let matchedCount = $derived(matches.filter((m) => m.status === 'matched').length);
  let unmatchedCount = $derived(matches.filter((m) => m.status === 'unmatched').length);

  async function applyReconciliation() {
    if (confirmedIds.length === 0) return;
    submitting = true;

    const res = await fetch('/api/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: confirmedIds })
    });

    if (res.ok) {
      await invalidateAll();
      onClose();
    } else {
      parseError = 'Failed to apply reconciliation.';
    }

    submitting = false;
  }
</script>

<div class="modal modal-open modal-bottom">
  <div class="modal-box max-h-[90vh]">
    <h3 class="mb-4 text-lg font-bold">Reconcile Transactions</h3>

    {#if parseError}
      <div class="alert alert-error mb-4 text-sm">{parseError}</div>
    {/if}

    {#if step === 'upload'}
      <div class="flex flex-col gap-4">
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Bank</span></div>
          <select class="select select-bordered w-full" bind:value={bank}>
            <option value="bca">BCA</option>
            <option value="mandiri">Mandiri</option>
          </select>
        </label>

        <label class="form-control w-full">
          <div class="label"><span class="label-text">CSV File</span></div>
          <input
            type="file"
            accept=".csv"
            class="file-input file-input-bordered w-full"
            onchange={handleFile}
          />
        </label>

        <p class="text-xs text-base-content/60">
          Your CSV file is processed entirely on this device and never uploaded to any server.
        </p>
      </div>
    {:else}
      <!-- Review matches -->
      <div class="mb-4 flex gap-3 text-sm">
        <span class="badge badge-success">{matchedCount} matched</span>
        <span class="badge badge-warning">{unmatchedCount} unmatched</span>
      </div>

      <div class="flex flex-col gap-3 overflow-y-auto max-h-[55vh]">
        {#each matches as match, i}
          <div class="card bg-base-200 p-3">
            <div class="flex justify-between text-sm">
              <div>
                <p class="font-mono font-bold">
                  Rp {Math.abs(match.bankTx.amount).toLocaleString('id-ID')}
                </p>
                <p class="text-xs text-base-content/60">{match.bankTx.date}</p>
                <p class="text-xs text-base-content/60 truncate max-w-48">{match.bankTx.description}</p>
              </div>
              <div class="text-right">
                {#if match.status === 'matched'}
                  <span class="badge badge-success badge-sm">Matched</span>
                {:else if match.status === 'skipped'}
                  <span class="badge badge-ghost badge-sm">Skipped</span>
                {:else}
                  <span class="badge badge-warning badge-sm">No match</span>
                {/if}
              </div>
            </div>

            {#if match.candidates.length > 1 && match.status !== 'skipped'}
              <div class="mt-2 flex flex-col gap-1">
                <p class="text-xs text-base-content/60">Multiple matches — pick one:</p>
                {#each match.candidates as candidate}
                  <button
                    class="btn btn-xs"
                    class:btn-primary={match.selectedId === candidate.id}
                    class:btn-ghost={match.selectedId !== candidate.id}
                    onclick={() => selectCandidate(i, candidate.id)}
                  >
                    {candidate.merchant || (candidate.categories as {name: string})?.name || 'Unknown'}
                    — {(candidate.accounts as {name: string})?.name}
                  </button>
                {/each}
              </div>
            {/if}

            {#if match.status !== 'skipped' && match.candidates.length === 0}
              <p class="mt-1 text-xs text-base-content/60">No matching Arsa transaction found.</p>
            {/if}

            {#if match.status !== 'matched' || match.candidates.length > 1}
              <button class="btn btn-ghost btn-xs mt-1" onclick={() => skipMatch(i)}>
                {match.status === 'skipped' ? 'Skipped' : 'Skip'}
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" onclick={() => (step = 'upload')}>Back</button>
        <button
          class="btn btn-primary"
          onclick={applyReconciliation}
          disabled={confirmedIds.length === 0 || submitting}
        >
          {#if submitting}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            Apply ({confirmedIds.length})
          {/if}
        </button>
      </div>
    {/if}

    {#if step === 'upload'}
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={onClose}>Cancel</button>
      </div>
    {/if}
  </div>
  <div class="modal-backdrop" onclick={onClose}></div>
</div>
```

**Step 3: Add Reconcile button and component to history page**

In `src/routes/history/+page.server.ts`, add `is_reconciled` to the select and export a flat list of arsa transactions for the reconciler:

Update the select query to include `is_reconciled`:

```typescript
    .select('id, amount, type, date, merchant, notes, is_private, user_id, receipt_url, is_reconciled, categories(name), accounts(name)', { count: 'exact' })
```

Add to the returned data:

```typescript
  // Flat list for reconciler (unreconciled only, current month)
  const { data: reconCandidates } = await supabase
    .from('transactions')
    .select('id, amount, type, date, merchant, is_reconciled, categories(name), accounts(name)')
    .eq('family_id', profile.family_id)
    .eq('is_reconciled', false)
    .order('date', { ascending: false });

  return { groups, hasMore, nextPage: page + 1, reconCandidates: reconCandidates ?? [] };
```

In `src/routes/history/+page.svelte`, add imports and state:

```typescript
  import Reconcile from '$lib/components/Reconcile.svelte';

  let showReconcile = $state(false);
```

Add reconcile button next to the page title:

```svelte
<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">History</h1>
  <button class="btn btn-secondary btn-sm" onclick={() => (showReconcile = true)}>Reconcile</button>
</div>
```

Add the modal at the bottom:

```svelte
{#if showReconcile}
  <Reconcile
    arsaTransactions={data.reconCandidates}
    onClose={() => (showReconcile = false)}
  />
{/if}
```

Also add a small reconciled badge on transaction rows that are reconciled:

```svelte
            {#if tx.is_reconciled}
              <span class="badge badge-success badge-xs">✓</span>
            {/if}
```

---

### Task 12: Manual Reconciliation Checkboxes

**Files:**
- Modify: `arsa-app/src/routes/history/+page.svelte`

**Step 1: Add manual reconcile toggle**

Add a state for manual mode:

```typescript
  let manualMode = $state(false);
  let manualSelected = $state<Set<string>>(new Set());
  let applyingManual = $state(false);
```

Add a toggle button next to the Reconcile button:

```svelte
  <div class="flex gap-2">
    <button
      class="btn btn-ghost btn-sm"
      class:btn-active={manualMode}
      onclick={() => { manualMode = !manualMode; manualSelected = new Set(); }}
    >
      ☑ Manual
    </button>
    <button class="btn btn-secondary btn-sm" onclick={() => (showReconcile = true)}>Reconcile</button>
  </div>
```

In each transaction row, when `manualMode` is true and the transaction is not already reconciled, show a checkbox:

```svelte
          {#if manualMode && !tx.is_reconciled}
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              checked={manualSelected.has(tx.id)}
              onchange={() => {
                const next = new Set(manualSelected);
                if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
                manualSelected = next;
              }}
            />
          {/if}
```

Add an "Apply" floating button when selections exist:

```svelte
{#if manualMode && manualSelected.size > 0}
  <div class="fixed bottom-20 left-0 right-0 flex justify-center">
    <button
      class="btn btn-primary btn-sm shadow-lg"
      disabled={applyingManual}
      onclick={async () => {
        applyingManual = true;
        await fetch('/api/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [...manualSelected] })
        });
        manualSelected = new Set();
        manualMode = false;
        applyingManual = false;
        await invalidateAll();
      }}
    >
      Mark {manualSelected.size} as reconciled
    </button>
  </div>
{/if}
```

Add `invalidateAll` import if not already present:

```typescript
  import { invalidateAll } from '$app/navigation';
```

---

### Task 13: Final Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test receipt upload flow**

1. Tap + → Add transaction → attach receipt photo via camera or gallery
2. Verify preview shows, upload spinner completes
3. Save transaction
4. Go to History → verify receipt icon appears on that transaction
5. Tap receipt icon → modal shows the image loaded from R2

**Step 3: Test CSV reconciliation**

1. Create several transactions manually (e.g. 150.000 out on 2026-03-03)
2. Create a test BCA-format CSV with matching rows
3. History → Reconcile → select BCA → upload CSV
4. Verify auto-matching finds the correct transactions
5. Apply → verify reconciled badge (✓) appears

**Step 4: Test manual reconciliation**

1. History → tap "Manual" → checkboxes appear on unreconciled transactions
2. Select some → "Mark N as reconciled" → apply
3. Verify badges update

**Step 5: Verify privacy constraint**

1. Open browser dev tools → Network tab
2. Upload a CSV → verify NO network requests contain CSV data (all parsing is client-side)

**Step 6: Build + lint**

```bash
npm run build && npm run lint
```

Expected: No errors.
