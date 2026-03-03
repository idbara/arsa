# Phase 4: OCR Receipts & Child Expense Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add receipt OCR via Cloudflare Workers AI to auto-fill transaction forms, build the child expense dashboard and education cost projection calculator.

**Architecture:** SvelteKit API endpoint fetches receipt image from R2, converts to base64 data URI, sends to Cloudflare Workers AI REST API for extraction. Response auto-fills the transaction form (human-in-the-loop review required). Child dashboard is a filtered view of existing data. Education calculator is pure client-side math.

**Tech Stack:** SvelteKit, Cloudflare Workers AI (Llama 3.2 Vision / Llama 4 Scout), R2 presigned URLs, daisyUI

**Prerequisites:** Phase 3 complete (receipt upload to R2 working). `CLOUDFLARE_AI_TOKEN` and `R2_ACCOUNT_ID` available.

---

### Task 1: Update Environment Variables

**Files:**
- Modify: `arsa-app/.env.example`

**Step 1: Add Cloudflare AI token**

Append to `.env.example`:

```
CLOUDFLARE_AI_TOKEN=your-cloudflare-ai-api-token
```

**Step 2: Add actual value to `.env`**

Create an API token in Cloudflare dashboard with Workers AI Read + Edit permissions.

**Step 3: Accept model license (one-time)**

Run this curl command to accept Meta's license for the vision model:

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$R2_ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct" \
  -H "Authorization: Bearer $CLOUDFLARE_AI_TOKEN" \
  -d '{"prompt": "agree"}'
```

---

### Task 2: OCR API Endpoint

**Files:**
- Create: `arsa-app/src/routes/api/ocr/+server.ts`

**Step 1: Create the OCR endpoint**

```typescript
import { json, error } from '@sveltejs/kit';
import { r2 } from '$lib/server/r2';
import { R2_BUCKET_NAME, R2_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN } from '$env/static/private';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

const MODEL_ID = '@cf/meta/llama-3.2-11b-vision-instruct';

const EXTRACTION_PROMPT = `You are a receipt data extraction assistant. Analyze this receipt image from an Indonesian store.

Extract and return ONLY a valid JSON object:
{
  "nominal": 0,
  "tanggal": "YYYY-MM-DD",
  "merchant": "Store name"
}

Rules:
- "nominal" is the total amount as a number (no currency symbol, no dots/commas). Example: 150000
- "tanggal" is the date in YYYY-MM-DD format. Look for "Tanggal", "Tgl", or date patterns.
- "merchant" is the store/restaurant name, usually at the top of the receipt.
- If a field cannot be determined, use null.
- Return ONLY the JSON object, no markdown, no explanation.`;

export const POST: RequestHandler = async ({ request, locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    error(401, 'Unauthorized');
  }

  if (!CLOUDFLARE_AI_TOKEN || !R2_ACCOUNT_ID) {
    error(500, 'OCR not configured');
  }

  const { key } = await request.json();

  if (!key || !key.startsWith('receipts/')) {
    error(400, 'Invalid receipt key');
  }

  // Fetch the image from R2 and convert to base64
  const presignedUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    }),
    { expiresIn: 60 }
  );

  const imageResponse = await fetch(presignedUrl);
  if (!imageResponse.ok) {
    error(502, 'Failed to fetch receipt image from storage');
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const dataUri = `data:${contentType};base64,${base64}`;

  // Call Cloudflare Workers AI
  const aiUrl = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/ai/run/${MODEL_ID}`;

  const aiResponse = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_AI_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: dataUri } }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.1
    })
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error('Cloudflare AI error:', errText);
    return json({ success: false, error: 'OCR service unavailable' });
  }

  const aiResult = await aiResponse.json();

  if (!aiResult.success) {
    return json({ success: false, error: 'OCR processing failed' });
  }

  const rawText = aiResult.result?.response ?? '';

  // Parse JSON from response (strip markdown fences if present)
  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);

    return json({
      success: true,
      data: {
        nominal: typeof parsed.nominal === 'number' ? parsed.nominal : null,
        tanggal: typeof parsed.tanggal === 'string' ? parsed.tanggal : null,
        merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null
      }
    });
  } catch {
    return json({
      success: false,
      error: 'Could not parse receipt data'
    });
  }
};
```

---

### Task 3: Add "Scan Receipt" to AddTransaction Modal

**Files:**
- Modify: `arsa-app/src/lib/components/AddTransaction.svelte`

**Step 1: Add OCR state and handler**

Add these state variables after the existing ones:

```typescript
  let scanning = $state(false);
  let scanError = $state('');
```

Add the scan function:

```typescript
  async function scanReceipt() {
    if (!receiptKey) return;
    scanning = true;
    scanError = '';

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: receiptKey })
      });

      const data = await res.json();

      if (!data.success) {
        scanError = data.error || 'Could not read receipt.';
        return;
      }

      if (data.data.nominal != null) {
        amount = String(data.data.nominal);
      }
      if (data.data.tanggal) {
        date = data.data.tanggal;
      }
      if (data.data.merchant) {
        merchant = data.data.merchant;
      }
    } catch {
      scanError = 'Failed to scan receipt.';
    } finally {
      scanning = false;
    }
  }
```

**Step 2: Add Scan button in the template**

After the `<ReceiptUpload>` component and before the date input, add:

```svelte
      <!-- OCR Scan -->
      {#if receiptKey && !isSplit}
        <button
          type="button"
          class="btn btn-secondary btn-sm w-full"
          onclick={scanReceipt}
          disabled={scanning}
        >
          {#if scanning}
            <span class="loading loading-spinner loading-sm"></span>
            Scanning...
          {:else}
            Scan Receipt
          {/if}
        </button>
        {#if scanError}
          <p class="text-xs text-warning">{scanError}</p>
        {/if}
      {/if}
```

---

### Task 4: Plan Page — Child Expense Dashboard

**Files:**
- Create: `arsa-app/src/routes/plan/+page.server.ts`
- Modify: `arsa-app/src/routes/plan/+page.svelte`

**Step 1: Create server load for child expenses**

File: `src/routes/plan/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) return { childExpenses: [], totalChildSpending: 0 };

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) return { childExpenses: [], totalChildSpending: 0 };

  const familyId = profile.family_id;

  // Get child-related categories
  const { data: childCategories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('family_id', familyId)
    .eq('is_child_related', true);

  if (!childCategories?.length) return { childExpenses: [], totalChildSpending: 0 };

  // Current month transactions for child categories
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

  // Aggregate by category
  const spendingMap = new Map<string, number>();
  for (const tx of transactions ?? []) {
    if (tx.category_id) {
      spendingMap.set(tx.category_id, (spendingMap.get(tx.category_id) ?? 0) + Number(tx.amount));
    }
  }

  const childExpenses = childCategories.map((cat) => ({
    name: cat.name,
    spent: spendingMap.get(cat.id) ?? 0
  }));

  const totalChildSpending = childExpenses.reduce((sum, e) => sum + e.spent, 0);

  return { childExpenses, totalChildSpending };
};
```

**Step 2: Create the plan page**

Replace `src/routes/plan/+page.svelte`:

```svelte
<script lang="ts">
  let { data } = $props();

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
</script>

<h1 class="mb-6 text-2xl font-bold">Plan</h1>

<!-- Child Expenses -->
<div class="mb-6">
  <h2 class="mb-3 text-lg font-bold">Child Expenses — {monthName}</h2>

  {#if data.childExpenses.length === 0}
    <div class="text-center text-base-content/60 py-6">
      <p>No child-related categories found.</p>
      <p class="text-sm">Mark categories as "child-related" in Settings → Categories.</p>
    </div>
  {:else}
    <div class="stats w-full shadow mb-4">
      <div class="stat">
        <div class="stat-title">Total Child Spending</div>
        <div class="stat-value text-secondary">
          Rp {data.totalChildSpending.toLocaleString('id-ID')}
        </div>
        <div class="stat-desc">This month</div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      {#each data.childExpenses as expense}
        <div class="flex items-center justify-between py-2 border-b border-base-200">
          <span class="font-medium">{expense.name}</span>
          <span class="font-mono">Rp {expense.spent.toLocaleString('id-ID')}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<div class="divider"></div>

<!-- Education Calculator Link -->
<a href="/plan/education" class="btn btn-outline w-full gap-2">
  <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14zm-4 6v-7.5l4-2.222" />
  </svg>
  Education Cost Projection
</a>
```

---

### Task 5: Education Cost Projection Calculator

**Files:**
- Create: `arsa-app/src/routes/plan/education/+page.svelte`

**Step 1: Create the calculator page**

File: `src/routes/plan/education/+page.svelte`

```svelte
<script lang="ts">
  interface EducationLevel {
    label: string;
    entryAge: number;
    exitAge: number;
  }

  const levels: EducationLevel[] = [
    { label: 'TK (Kindergarten)', entryAge: 5, exitAge: 6 },
    { label: 'SD (Elementary)', entryAge: 7, exitAge: 12 },
    { label: 'SMP (Junior High)', entryAge: 13, exitAge: 15 },
    { label: 'SMA (Senior High)', entryAge: 16, exitAge: 18 },
    { label: 'Kuliah (University)', entryAge: 19, exitAge: 22 }
  ];

  let childAge = $state(1);
  let inflationRate = $state(6);

  let costs = $state<Record<string, number>>({
    TK: 15000000,
    SD: 20000000,
    SMP: 25000000,
    SMA: 30000000,
    Kuliah: 50000000
  });

  const costKeys = ['TK', 'SD', 'SMP', 'SMA', 'Kuliah'];

  let projections = $derived(
    levels.map((level, i) => {
      const yearsUntil = level.entryAge - childAge;
      const currentCost = costs[costKeys[i]] ?? 0;
      const rate = inflationRate / 100;

      if (yearsUntil <= 0) {
        return {
          label: level.label,
          entryAge: level.entryAge,
          yearsUntil: 0,
          currentCost,
          projectedCost: currentCost,
          passed: true
        };
      }

      const projectedCost = Math.round(currentCost * Math.pow(1 + rate, yearsUntil));

      return {
        label: level.label,
        entryAge: level.entryAge,
        yearsUntil,
        currentCost,
        projectedCost,
        passed: false
      };
    })
  );

  let activeProjections = $derived(projections.filter((p) => !p.passed));

  let totalProjected = $derived(
    activeProjections.reduce((sum, p) => sum + p.projectedCost, 0)
  );
</script>

<h1 class="mb-6 text-2xl font-bold">Education Cost Projection</h1>

<div class="flex flex-col gap-4 mb-6">
  <label class="floating-label">
    <span>Child's Current Age</span>
    <input
      type="number"
      inputmode="numeric"
      placeholder="Child's Current Age"
      class="input input-bordered w-full"
      bind:value={childAge}
      min="0"
      max="25"
    />
  </label>

  <label class="floating-label">
    <span>Inflation Rate (%)</span>
    <input
      type="number"
      inputmode="decimal"
      placeholder="Inflation Rate (%)"
      class="input input-bordered w-full"
      bind:value={inflationRate}
      step="0.1"
      min="0"
      max="30"
    />
  </label>
</div>

<h2 class="mb-3 text-lg font-bold">Current Annual Costs</h2>
<div class="flex flex-col gap-3 mb-6">
  {#each levels as level, i}
    <label class="floating-label">
      <span>{level.label}</span>
      <input
        type="number"
        inputmode="decimal"
        placeholder={level.label}
        class="input input-bordered w-full"
        bind:value={costs[costKeys[i]]}
        step="any"
      />
    </label>
  {/each}
</div>

<h2 class="mb-3 text-lg font-bold">Projected Costs</h2>

{#if activeProjections.length === 0}
  <p class="text-base-content/60 text-center py-4">Child has passed all education levels.</p>
{:else}
  <div class="overflow-x-auto mb-4">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Level</th>
          <th class="text-right">Entry Age</th>
          <th class="text-right">In Years</th>
          <th class="text-right">Projected Cost</th>
        </tr>
      </thead>
      <tbody>
        {#each activeProjections as row}
          <tr>
            <td class="font-medium">{row.label}</td>
            <td class="text-right">{row.entryAge}</td>
            <td class="text-right">{row.yearsUntil}</td>
            <td class="text-right font-mono">
              Rp {row.projectedCost.toLocaleString('id-ID')}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="stats w-full shadow">
    <div class="stat">
      <div class="stat-title">Total Projected Cost</div>
      <div class="stat-value text-primary text-2xl">
        Rp {totalProjected.toLocaleString('id-ID')}
      </div>
      <div class="stat-desc">At {inflationRate}% annual inflation</div>
    </div>
  </div>
{/if}

<div class="mt-6">
  <a href="/plan" class="btn btn-ghost w-full">Back to Plan</a>
</div>
```

---

### Task 6: Final Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test OCR flow**

1. Tap + → Add transaction → attach a receipt photo
2. Wait for upload to complete
3. Tap "Scan Receipt" → loading spinner shows
4. If OCR succeeds: amount, date, merchant auto-fill in the form
5. Verify user can edit all auto-filled fields before saving
6. If OCR fails: warning text shows, user fills manually — transaction flow not blocked

**Step 3: Test child expense dashboard**

1. Ensure at least one category is marked `is_child_related` (Settings → Categories → edit)
2. Add a few expense transactions under child-related categories
3. Navigate to Plan tab → verify total child spending shows correctly
4. Verify per-category breakdown matches the transactions

**Step 4: Test education calculator**

1. Plan → Education Cost Projection
2. Set child age to 2, inflation 6%
3. Enter costs for each level
4. Verify projected costs update reactively
5. Change child age to 15 → TK/SD/SMP rows should disappear (passed)
6. Verify total is sum of active projections only

**Step 5: Build + lint**

```bash
npm run build && npm run lint
```

Expected: No errors.
