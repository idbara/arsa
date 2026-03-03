# Phase 2: Core UI & Transaction Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the dashboard, account/category CRUD, transaction entry with split bill, and transaction history — the core daily-use features of Arsa.

**Architecture:** All CRUD via SvelteKit form actions with `use:enhance`. Data loaded in `+page.server.ts`. Transaction modal is a daisyUI bottom sheet controlled by `$state` in the layout. Split bill uses client-side `$state` for dynamic line items, submits as JSON via form action.

**Tech Stack:** SvelteKit, Supabase (via `@supabase/ssr`), daisyUI, Tailwind CSS

**Prerequisites:** Phase 0 (scaffold) and Phase 1 (DB schema + auth + onboarding) must be complete. User can log in, create a family, and see the home page.

---

### Task 1: DB Migration — Add group_id to transactions

**Files:**
- Create: `supabase/migrations/003_add_group_id.sql`

**Step 1: Create the migration file**

```sql
alter table transactions add column group_id uuid;
```

**Step 2: Run in Supabase SQL Editor**

Expected: Column added, no errors.

---

### Task 2: Bottom Nav — Real Links with Active States

**Files:**
- Create: `arsa-app/src/lib/components/BottomNav.svelte`
- Modify: `arsa-app/src/routes/+layout.svelte`

**Step 1: Create BottomNav component**

File: `src/lib/components/BottomNav.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/state';

  let { onAdd }: { onAdd: () => void } = $props();

  const navItems = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/history', label: 'History', icon: 'clock' },
    { href: '#add', label: 'Add', icon: 'plus', isAction: true },
    { href: '/plan', label: 'Plan', icon: 'clipboard' },
    { href: '/settings', label: 'Settings', icon: 'cog' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<div class="btm-nav btm-nav-sm">
  {#each navItems as item}
    {#if item.isAction}
      <button class="text-primary" onclick={onAdd}>
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="btm-nav-label text-xs">{item.label}</span>
      </button>
    {:else}
      <a href={item.href} class:active={isActive(item.href)}>
        {#if item.icon === 'home'}
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-4 0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1" />
          </svg>
        {:else if item.icon === 'clock'}
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        {:else if item.icon === 'clipboard'}
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
        {:else if item.icon === 'cog'}
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
          </svg>
        {/if}
        <span class="btm-nav-label text-xs">{item.label}</span>
      </a>
    {/if}
  {/each}
</div>
```

**Step 2: Update +layout.svelte to use BottomNav and manage modal state**

Replace the full `+layout.svelte` content:

```svelte
<script lang="ts">
  import '../app.css';
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let { data, children } = $props();
  let { supabase, session } = $derived(data);

  let showAddModal = $state(false);

  onMount(() => {
    const { data: authData } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => authData.subscription.unsubscribe();
  });

  let showAppShell = $derived(!!session);
</script>

{#if showAppShell}
  <div class="flex min-h-screen flex-col">
    <header class="navbar bg-base-200">
      <div class="flex-1">
        <span class="text-xl font-bold">Arsa</span>
      </div>
      <div class="flex-none">
        <ThemeToggle />
      </div>
    </header>

    <main class="flex-1 px-4 py-6 pb-20">
      {@render children()}
    </main>

    <BottomNav onAdd={() => (showAddModal = true)} />
  </div>

  <!-- Transaction Add Modal — rendered here so it's accessible from any page -->
  {#if showAddModal}
    {@const AddTransaction = null}
    <!-- Placeholder: Task 9 will replace this with the real AddTransaction component -->
    <div class="modal modal-open modal-bottom">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Add Transaction</h3>
        <p class="text-base-content/60">Coming soon...</p>
        <div class="modal-action">
          <button class="btn" onclick={() => (showAddModal = false)}>Close</button>
        </div>
      </div>
      <div class="modal-backdrop" onclick={() => (showAddModal = false)}></div>
    </div>
  {/if}
{:else}
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4">
    {@render children()}
  </div>
{/if}
```

**Step 3: Verify**

```bash
npm run dev
```

Expected: Bottom nav links work, active state highlights correctly, Add button opens placeholder modal.

---

### Task 3: Settings Hub Page

**Files:**
- Create: `arsa-app/src/routes/settings/+page.svelte`

**Step 1: Create settings page**

File: `src/routes/settings/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<h1 class="mb-6 text-2xl font-bold">Settings</h1>

<div class="flex flex-col gap-3">
  <a href="/settings/accounts" class="btn btn-ghost justify-start gap-3 text-left">
    <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z" />
    </svg>
    Accounts & Wallets
  </a>

  <a href="/settings/categories" class="btn btn-ghost justify-start gap-3 text-left">
    <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
    </svg>
    Categories & Budgets
  </a>

  <div class="divider"></div>

  <form method="POST" action="/logout" use:enhance>
    <button type="submit" class="btn btn-ghost justify-start gap-3 text-error w-full text-left">
      <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
      </svg>
      Sign Out
    </button>
  </form>
</div>
```

---

### Task 4: Accounts List Page

**Files:**
- Create: `arsa-app/src/routes/settings/accounts/+page.server.ts`
- Create: `arsa-app/src/routes/settings/accounts/+page.svelte`

**Step 1: Create the server load function**

File: `src/routes/settings/accounts/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user!.id)
    .single();

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, balance')
    .eq('family_id', profile!.family_id)
    .order('name');

  return { accounts: accounts ?? [] };
};
```

**Step 2: Create the page**

File: `src/routes/settings/accounts/+page.svelte`

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Accounts</h1>
  <a href="/settings/accounts/new" class="btn btn-primary btn-sm">+ Add</a>
</div>

{#if data.accounts.length === 0}
  <div class="text-center text-base-content/60 py-10">
    <p>No accounts yet.</p>
    <a href="/settings/accounts/new" class="link link-primary">Create your first account</a>
  </div>
{:else}
  <div class="flex flex-col gap-2">
    {#each data.accounts as account}
      <a href="/settings/accounts/{account.id}" class="card bg-base-100 shadow-sm">
        <div class="card-body p-4 flex-row items-center justify-between">
          <div>
            <p class="font-medium">{account.name}</p>
            <p class="text-sm text-base-content/60 capitalize">{account.type}</p>
          </div>
          <p class="font-mono font-bold">
            Rp {Number(account.balance).toLocaleString('id-ID')}
          </p>
        </div>
      </a>
    {/each}
  </div>
{/if}
```

---

### Task 5: Add Account Page

**Files:**
- Create: `arsa-app/src/routes/settings/accounts/new/+page.server.ts`
- Create: `arsa-app/src/routes/settings/accounts/new/+page.svelte`

**Step 1: Create form action**

File: `src/routes/settings/accounts/new/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();

    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user!.id)
      .single();

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;
    const balance = parseFloat(formData.get('balance') as string) || 0;

    if (!name || !type) {
      return fail(400, { error: 'Name and type are required.', name, type, balance });
    }

    const { error } = await supabase
      .from('accounts')
      .insert({ family_id: profile!.family_id, name, type, balance });

    if (error) {
      return fail(500, { error: 'Failed to create account.', name, type, balance });
    }

    redirect(303, '/settings/accounts');
  }
};
```

**Step 2: Create the page**

File: `src/routes/settings/accounts/new/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<h1 class="mb-6 text-2xl font-bold">Add Account</h1>

{#if form?.error}
  <div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
  <label class="floating-label">
    <span>Account Name</span>
    <input
      name="name"
      type="text"
      placeholder="Account Name"
      class="input input-bordered w-full"
      value={form?.name ?? ''}
      required
    />
  </label>

  <label class="form-control w-full">
    <div class="label"><span class="label-text">Type</span></div>
    <select name="type" class="select select-bordered w-full" required>
      <option value="" disabled selected={!form?.type}>Select type</option>
      <option value="bank" selected={form?.type === 'bank'}>Bank</option>
      <option value="e-wallet" selected={form?.type === 'e-wallet'}>E-Wallet</option>
      <option value="cash" selected={form?.type === 'cash'}>Cash</option>
    </select>
  </label>

  <label class="floating-label">
    <span>Initial Balance</span>
    <input
      name="balance"
      type="number"
      inputmode="decimal"
      placeholder="Initial Balance"
      class="input input-bordered w-full"
      value={form?.balance ?? 0}
      step="any"
    />
  </label>

  <div class="flex gap-2">
    <a href="/settings/accounts" class="btn btn-ghost flex-1">Cancel</a>
    <button type="submit" class="btn btn-primary flex-1">Create</button>
  </div>
</form>
```

---

### Task 6: Edit/Delete Account Page

**Files:**
- Create: `arsa-app/src/routes/settings/accounts/[id]/+page.server.ts`
- Create: `arsa-app/src/routes/settings/accounts/[id]/+page.svelte`

**Step 1: Create server load + form actions**

File: `src/routes/settings/accounts/[id]/+page.server.ts`

```typescript
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, type, balance')
    .eq('id', params.id)
    .single();

  if (!account) {
    error(404, 'Account not found');
  }

  return { account };
};

export const actions: Actions = {
  update: async ({ params, request, locals: { supabase } }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;

    if (!name || !type) {
      return fail(400, { error: 'Name and type are required.' });
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ name, type })
      .eq('id', params.id);

    if (updateError) {
      return fail(500, { error: 'Failed to update account.' });
    }

    redirect(303, '/settings/accounts');
  },

  delete: async ({ params, locals: { supabase } }) => {
    // Check if account has transactions
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', params.id);

    if (count && count > 0) {
      return fail(400, { error: `Cannot delete — account has ${count} transaction(s). Remove them first.` });
    }

    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return fail(500, { error: 'Failed to delete account.' });
    }

    redirect(303, '/settings/accounts');
  }
};
```

**Step 2: Create the page**

File: `src/routes/settings/accounts/[id]/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let showDeleteConfirm = $state(false);
</script>

<h1 class="mb-6 text-2xl font-bold">Edit Account</h1>

{#if form?.error}
  <div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
  <label class="floating-label">
    <span>Account Name</span>
    <input
      name="name"
      type="text"
      placeholder="Account Name"
      class="input input-bordered w-full"
      value={data.account.name}
      required
    />
  </label>

  <label class="form-control w-full">
    <div class="label"><span class="label-text">Type</span></div>
    <select name="type" class="select select-bordered w-full" required>
      <option value="bank" selected={data.account.type === 'bank'}>Bank</option>
      <option value="e-wallet" selected={data.account.type === 'e-wallet'}>E-Wallet</option>
      <option value="cash" selected={data.account.type === 'cash'}>Cash</option>
    </select>
  </label>

  <p class="text-sm text-base-content/60">
    Balance: Rp {Number(data.account.balance).toLocaleString('id-ID')}
    <br />
    <span class="text-xs">Balance is updated automatically by transactions.</span>
  </p>

  <div class="flex gap-2">
    <a href="/settings/accounts" class="btn btn-ghost flex-1">Cancel</a>
    <button type="submit" class="btn btn-primary flex-1">Save</button>
  </div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full" onclick={() => (showDeleteConfirm = true)}>
  Delete Account
</button>

{#if showDeleteConfirm}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Delete "{data.account.name}"?</h3>
      <p class="py-4 text-base-content/60">This cannot be undone. Accounts with transactions cannot be deleted.</p>
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
        <form method="POST" action="?/delete" use:enhance>
          <button type="submit" class="btn btn-error">Delete</button>
        </form>
      </div>
    </div>
    <div class="modal-backdrop" onclick={() => (showDeleteConfirm = false)}></div>
  </div>
{/if}
```

---

### Task 7: Categories List Page

**Files:**
- Create: `arsa-app/src/routes/settings/categories/+page.server.ts`
- Create: `arsa-app/src/routes/settings/categories/+page.svelte`

**Step 1: Create server load**

File: `src/routes/settings/categories/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user!.id)
    .single();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, monthly_limit, is_child_related')
    .eq('family_id', profile!.family_id)
    .order('name');

  return {
    categories: categories ?? [],
    isAdmin: profile!.role === 'admin'
  };
};
```

**Step 2: Create the page**

File: `src/routes/settings/categories/+page.svelte`

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Categories</h1>
  {#if data.isAdmin}
    <a href="/settings/categories/new" class="btn btn-primary btn-sm">+ Add</a>
  {/if}
</div>

{#if data.categories.length === 0}
  <div class="text-center text-base-content/60 py-10">
    <p>No categories yet.</p>
    {#if data.isAdmin}
      <a href="/settings/categories/new" class="link link-primary">Create your first category</a>
    {/if}
  </div>
{:else}
  <div class="flex flex-col gap-2">
    {#each data.categories as category}
      <a
        href={data.isAdmin ? `/settings/categories/${category.id}` : '#'}
        class="card bg-base-100 shadow-sm"
        class:pointer-events-none={!data.isAdmin}
      >
        <div class="card-body p-4 flex-row items-center justify-between">
          <div class="flex items-center gap-2">
            <p class="font-medium">{category.name}</p>
            {#if category.is_child_related}
              <span class="badge badge-secondary badge-sm">Child</span>
            {/if}
          </div>
          {#if category.monthly_limit}
            <p class="text-sm text-base-content/60">
              Rp {Number(category.monthly_limit).toLocaleString('id-ID')}/mo
            </p>
          {/if}
        </div>
      </a>
    {/each}
  </div>
{/if}
```

---

### Task 8: Add/Edit/Delete Category Pages

**Files:**
- Create: `arsa-app/src/routes/settings/categories/new/+page.server.ts`
- Create: `arsa-app/src/routes/settings/categories/new/+page.svelte`
- Create: `arsa-app/src/routes/settings/categories/[id]/+page.server.ts`
- Create: `arsa-app/src/routes/settings/categories/[id]/+page.svelte`

**Step 1: Create add category form action**

File: `src/routes/settings/categories/new/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect(303, '/settings/categories');
  }
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();

    const { data: profile } = await supabase
      .from('users')
      .select('family_id, role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'admin') {
      return fail(403, { error: 'Only admins can create categories.' });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const monthlyLimit = formData.get('monthly_limit') as string;
    const isChildRelated = formData.get('is_child_related') === 'on';

    if (!name) {
      return fail(400, { error: 'Name is required.', name, monthlyLimit, isChildRelated });
    }

    const { error } = await supabase.from('categories').insert({
      family_id: profile!.family_id,
      name,
      monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
      is_child_related: isChildRelated
    });

    if (error) {
      return fail(500, { error: 'Failed to create category.', name, monthlyLimit, isChildRelated });
    }

    redirect(303, '/settings/categories');
  }
};
```

**Step 2: Create add category page**

File: `src/routes/settings/categories/new/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<h1 class="mb-6 text-2xl font-bold">Add Category</h1>

{#if form?.error}
  <div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
  <label class="floating-label">
    <span>Category Name</span>
    <input
      name="name"
      type="text"
      placeholder="Category Name"
      class="input input-bordered w-full"
      value={form?.name ?? ''}
      required
    />
  </label>

  <label class="floating-label">
    <span>Monthly Budget Limit (optional)</span>
    <input
      name="monthly_limit"
      type="number"
      inputmode="decimal"
      placeholder="Monthly Budget Limit (optional)"
      class="input input-bordered w-full"
      value={form?.monthlyLimit ?? ''}
      step="any"
    />
  </label>

  <label class="label cursor-pointer justify-start gap-3">
    <input
      name="is_child_related"
      type="checkbox"
      class="checkbox"
      checked={form?.isChildRelated ?? false}
    />
    <span class="label-text">Child-related expense</span>
  </label>

  <div class="flex gap-2">
    <a href="/settings/categories" class="btn btn-ghost flex-1">Cancel</a>
    <button type="submit" class="btn btn-primary flex-1">Create</button>
  </div>
</form>
```

**Step 3: Create edit/delete category form action**

File: `src/routes/settings/categories/[id]/+page.server.ts`

```typescript
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect(303, '/settings/categories');
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, monthly_limit, is_child_related')
    .eq('id', params.id)
    .single();

  if (!category) {
    error(404, 'Category not found');
  }

  return { category };
};

export const actions: Actions = {
  update: async ({ params, request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'admin') {
      return fail(403, { error: 'Only admins can edit categories.' });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const monthlyLimit = formData.get('monthly_limit') as string;
    const isChildRelated = formData.get('is_child_related') === 'on';

    if (!name) {
      return fail(400, { error: 'Name is required.' });
    }

    const { error: updateError } = await supabase
      .from('categories')
      .update({
        name,
        monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
        is_child_related: isChildRelated
      })
      .eq('id', params.id);

    if (updateError) {
      return fail(500, { error: 'Failed to update category.' });
    }

    redirect(303, '/settings/categories');
  },

  delete: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'admin') {
      return fail(403, { error: 'Only admins can delete categories.' });
    }

    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', params.id);

    if (count && count > 0) {
      return fail(400, { error: `Cannot delete — category has ${count} transaction(s).` });
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return fail(500, { error: 'Failed to delete category.' });
    }

    redirect(303, '/settings/categories');
  }
};
```

**Step 4: Create edit category page**

File: `src/routes/settings/categories/[id]/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let showDeleteConfirm = $state(false);
</script>

<h1 class="mb-6 text-2xl font-bold">Edit Category</h1>

{#if form?.error}
  <div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
  <label class="floating-label">
    <span>Category Name</span>
    <input
      name="name"
      type="text"
      placeholder="Category Name"
      class="input input-bordered w-full"
      value={data.category.name}
      required
    />
  </label>

  <label class="floating-label">
    <span>Monthly Budget Limit (optional)</span>
    <input
      name="monthly_limit"
      type="number"
      inputmode="decimal"
      placeholder="Monthly Budget Limit (optional)"
      class="input input-bordered w-full"
      value={data.category.monthly_limit ?? ''}
      step="any"
    />
  </label>

  <label class="label cursor-pointer justify-start gap-3">
    <input
      name="is_child_related"
      type="checkbox"
      class="checkbox"
      checked={data.category.is_child_related}
    />
    <span class="label-text">Child-related expense</span>
  </label>

  <div class="flex gap-2">
    <a href="/settings/categories" class="btn btn-ghost flex-1">Cancel</a>
    <button type="submit" class="btn btn-primary flex-1">Save</button>
  </div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full" onclick={() => (showDeleteConfirm = true)}>
  Delete Category
</button>

{#if showDeleteConfirm}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Delete "{data.category.name}"?</h3>
      <p class="py-4 text-base-content/60">This cannot be undone. Categories with transactions cannot be deleted.</p>
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
        <form method="POST" action="?/delete" use:enhance>
          <button type="submit" class="btn btn-error">Delete</button>
        </form>
      </div>
    </div>
    <div class="modal-backdrop" onclick={() => (showDeleteConfirm = false)}></div>
  </div>
{/if}
```

---

### Task 9: Transaction Add Modal Component

**Files:**
- Create: `arsa-app/src/lib/components/AddTransaction.svelte`
- Create: `arsa-app/src/routes/api/transactions/+server.ts`
- Modify: `arsa-app/src/routes/+layout.svelte`
- Modify: `arsa-app/src/routes/+layout.server.ts`

**Step 1: Add accounts and categories to layout data**

Modify `src/routes/+layout.server.ts` to also load accounts and categories (needed by the Add modal which lives in the layout):

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session, user } = await safeGetSession();

  let accounts: { id: string; name: string; type: string }[] = [];
  let categories: { id: string; name: string }[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profile?.family_id) {
      const [acctResult, catResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, name, type')
          .eq('family_id', profile.family_id)
          .order('name'),
        supabase
          .from('categories')
          .select('id, name')
          .eq('family_id', profile.family_id)
          .order('name')
      ]);

      accounts = acctResult.data ?? [];
      categories = catResult.data ?? [];
    }
  }

  return {
    session,
    user,
    cookies: cookies.getAll(),
    accounts,
    categories
  };
};
```

**Step 2: Create API endpoint for transaction creation**

We use a JSON API endpoint instead of a form action because the Add modal lives in the layout (not a specific page) and needs to handle split bill as structured data.

File: `src/routes/api/transactions/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    return json({ error: 'No family found' }, { status: 400 });
  }

  const body = await request.json();
  const { type, account_id, date, merchant, notes, is_private, items } = body;

  // items is an array of { amount, category_id } for split bill, or a single item
  if (!type || !account_id || !items?.length) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const groupId = items.length > 1 ? crypto.randomUUID() : null;

  // Insert transactions
  const transactions = items.map((item: { amount: number; category_id: string | null }) => ({
    family_id: profile.family_id,
    account_id,
    category_id: type === 'transfer' ? null : item.category_id,
    user_id: user.id,
    amount: item.amount,
    type,
    date: date || new Date().toISOString().split('T')[0],
    merchant: merchant || null,
    notes: notes || null,
    is_private: is_private || false,
    group_id: groupId
  }));

  const { error: txError } = await supabase.from('transactions').insert(transactions);

  if (txError) {
    return json({ error: 'Failed to create transaction' }, { status: 500 });
  }

  // Update account balance
  const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
  const balanceDelta = type === 'in' ? totalAmount : -totalAmount;

  const { data: account } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', account_id)
    .single();

  if (account) {
    await supabase
      .from('accounts')
      .update({ balance: Number(account.balance) + balanceDelta })
      .eq('id', account_id);
  }

  // Handle transfer: credit the destination account
  if (type === 'transfer' && body.transfer_to) {
    const { data: destAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', body.transfer_to)
      .single();

    if (destAccount) {
      await supabase
        .from('accounts')
        .update({ balance: Number(destAccount.balance) + totalAmount })
        .eq('id', body.transfer_to);
    }
  }

  return json({ success: true });
};
```

**Step 3: Create AddTransaction component**

File: `src/lib/components/AddTransaction.svelte`

```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  let {
    accounts,
    categories,
    onClose
  }: {
    accounts: { id: string; name: string; type: string }[];
    categories: { id: string; name: string }[];
    onClose: () => void;
  } = $props();

  let type = $state<'out' | 'in' | 'transfer'>('out');
  let accountId = $state('');
  let transferTo = $state('');
  let date = $state(new Date().toISOString().split('T')[0]);
  let merchant = $state('');
  let notes = $state('');
  let isPrivate = $state(false);
  let isSplit = $state(false);
  let submitting = $state(false);
  let error = $state('');

  // Single mode
  let amount = $state('');
  let categoryId = $state('');

  // Split mode
  let splitItems = $state([{ amount: '', categoryId: '' }]);

  function addSplitItem() {
    splitItems = [...splitItems, { amount: '', categoryId: '' }];
  }

  function removeSplitItem(index: number) {
    splitItems = splitItems.filter((_, i) => i !== index);
  }

  let splitTotal = $derived(
    splitItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  );

  async function handleSubmit() {
    error = '';
    submitting = true;

    let items: { amount: number; category_id: string | null }[];

    if (isSplit) {
      if (splitItems.some((item) => !item.amount || (!item.categoryId && type !== 'transfer'))) {
        error = 'All split items need an amount and category.';
        submitting = false;
        return;
      }
      items = splitItems.map((item) => ({
        amount: parseFloat(item.amount),
        category_id: type === 'transfer' ? null : item.categoryId
      }));
    } else {
      if (!amount || (!categoryId && type !== 'transfer')) {
        error = 'Amount and category are required.';
        submitting = false;
        return;
      }
      items = [{ amount: parseFloat(amount), category_id: type === 'transfer' ? null : categoryId }];
    }

    if (!accountId) {
      error = 'Please select an account.';
      submitting = false;
      return;
    }

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        account_id: accountId,
        transfer_to: type === 'transfer' ? transferTo : null,
        date,
        merchant,
        notes,
        is_private: isPrivate,
        items
      })
    });

    if (!res.ok) {
      const data = await res.json();
      error = data.error || 'Something went wrong.';
      submitting = false;
      return;
    }

    await invalidateAll();
    submitting = false;
    onClose();
  }
</script>

<div class="modal modal-open modal-bottom">
  <div class="modal-box max-h-[85vh]">
    <h3 class="mb-4 text-lg font-bold">Add Transaction</h3>

    {#if error}
      <div class="alert alert-error mb-4 text-sm">{error}</div>
    {/if}

    <!-- Type tabs -->
    <div class="tabs tabs-boxed mb-4">
      <button class="tab" class:tab-active={type === 'out'} onclick={() => (type = 'out')}>Expense</button>
      <button class="tab" class:tab-active={type === 'in'} onclick={() => (type = 'in')}>Income</button>
      <button class="tab" class:tab-active={type === 'transfer'} onclick={() => (type = 'transfer')}>Transfer</button>
    </div>

    <div class="flex flex-col gap-3">
      {#if !isSplit}
        <!-- Single amount -->
        <input
          type="number"
          inputmode="decimal"
          placeholder="Amount"
          class="input input-bordered input-lg w-full text-center text-2xl"
          bind:value={amount}
          step="any"
        />
      {/if}

      <!-- Account -->
      <select class="select select-bordered w-full" bind:value={accountId}>
        <option value="" disabled>Select account</option>
        {#each accounts as account}
          <option value={account.id}>{account.name}</option>
        {/each}
      </select>

      <!-- Transfer destination -->
      {#if type === 'transfer'}
        <select class="select select-bordered w-full" bind:value={transferTo}>
          <option value="" disabled>Transfer to...</option>
          {#each accounts.filter((a) => a.id !== accountId) as account}
            <option value={account.id}>{account.name}</option>
          {/each}
        </select>
      {/if}

      <!-- Category (not for transfer) -->
      {#if type !== 'transfer' && !isSplit}
        <select class="select select-bordered w-full" bind:value={categoryId}>
          <option value="" disabled>Select category</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      {/if}

      <!-- Split toggle (not for transfer) -->
      {#if type !== 'transfer'}
        <label class="label cursor-pointer justify-start gap-3">
          <input type="checkbox" class="toggle toggle-sm" bind:checked={isSplit} />
          <span class="label-text">Split across categories</span>
        </label>
      {/if}

      <!-- Split items -->
      {#if isSplit && type !== 'transfer'}
        <div class="rounded-box border border-base-300 p-3 flex flex-col gap-2">
          {#each splitItems as item, i}
            <div class="flex gap-2 items-center">
              <input
                type="number"
                inputmode="decimal"
                placeholder="Amount"
                class="input input-bordered input-sm flex-1"
                bind:value={item.amount}
                step="any"
              />
              <select class="select select-bordered select-sm flex-1" bind:value={item.categoryId}>
                <option value="" disabled>Category</option>
                {#each categories as category}
                  <option value={category.id}>{category.name}</option>
                {/each}
              </select>
              {#if splitItems.length > 1}
                <button class="btn btn-ghost btn-sm btn-square" onclick={() => removeSplitItem(i)}>✕</button>
              {/if}
            </div>
          {/each}
          <button class="btn btn-ghost btn-sm" onclick={addSplitItem}>+ Add item</button>
          <p class="text-right text-sm font-mono">
            Total: Rp {splitTotal.toLocaleString('id-ID')}
          </p>
        </div>
      {/if}

      <!-- Date -->
      <input type="date" class="input input-bordered w-full" bind:value={date} />

      <!-- Merchant -->
      <input
        type="text"
        placeholder="Merchant (optional)"
        class="input input-bordered w-full"
        bind:value={merchant}
      />

      <!-- Notes -->
      <input
        type="text"
        placeholder="Notes (optional)"
        class="input input-bordered w-full"
        bind:value={notes}
      />

      <!-- Private -->
      <label class="label cursor-pointer justify-start gap-3">
        <input type="checkbox" class="checkbox checkbox-sm" bind:checked={isPrivate} />
        <span class="label-text">Hide details from partner</span>
      </label>
    </div>

    <div class="modal-action">
      <button class="btn btn-ghost" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary" onclick={handleSubmit} disabled={submitting}>
        {#if submitting}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          Save
        {/if}
      </button>
    </div>
  </div>
  <div class="modal-backdrop" onclick={onClose}></div>
</div>
```

**Step 4: Update +layout.svelte to use AddTransaction**

Replace the placeholder modal in `+layout.svelte` with the real component. In the `{#if showAddModal}` block:

```svelte
  {#if showAddModal}
    <AddTransaction
      accounts={data.accounts}
      categories={data.categories}
      onClose={() => (showAddModal = false)}
    />
  {/if}
```

And add the import at the top of the `<script>`:

```typescript
  import AddTransaction from '$lib/components/AddTransaction.svelte';
```

---

### Task 10: Dashboard (Home Page)

**Files:**
- Modify: `arsa-app/src/routes/+page.server.ts` (create if not exists)
- Modify: `arsa-app/src/routes/+page.svelte`

**Step 1: Create home page server load**

File: `src/routes/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) return { totalBalance: 0, budgets: [], recentTransactions: [] };

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) return { totalBalance: 0, budgets: [], recentTransactions: [] };

  const familyId = profile.family_id;

  // Total balance across all accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('balance')
    .eq('family_id', familyId);

  const totalBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.balance), 0);

  // Categories with monthly limits + this month's spending
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, monthly_limit')
    .eq('family_id', familyId)
    .not('monthly_limit', 'is', null);

  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('family_id', familyId)
    .eq('type', 'out')
    .gte('date', monthStart)
    .lte('date', monthEnd);

  const spendingByCategory = new Map<string, number>();
  for (const tx of monthTransactions ?? []) {
    if (tx.category_id) {
      spendingByCategory.set(
        tx.category_id,
        (spendingByCategory.get(tx.category_id) ?? 0) + Number(tx.amount)
      );
    }
  }

  const budgets = (categories ?? []).map((cat) => ({
    name: cat.name,
    limit: Number(cat.monthly_limit),
    spent: spendingByCategory.get(cat.id) ?? 0
  }));

  // Recent 5 transactions
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('id, amount, type, date, merchant, is_private, user_id, categories(name), accounts(name)')
    .eq('family_id', familyId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  // Redact private transactions for non-creators
  const sanitized = (recentTransactions ?? []).map((tx) => ({
    ...tx,
    merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant
  }));

  return { totalBalance, budgets, recentTransactions: sanitized };
};
```

**Step 2: Create home page**

File: `src/routes/+page.svelte`

```svelte
<script lang="ts">
  let { data } = $props();

  function budgetColor(spent: number, limit: number): string {
    const pct = spent / limit;
    if (pct > 0.9) return 'progress-error';
    if (pct > 0.75) return 'progress-warning';
    return 'progress-success';
  }

  function formatAmount(amount: number, type: string): string {
    const formatted = `Rp ${Math.abs(amount).toLocaleString('id-ID')}`;
    if (type === 'in') return `+${formatted}`;
    if (type === 'out') return `-${formatted}`;
    return formatted;
  }

  function amountColor(type: string): string {
    if (type === 'in') return 'text-success';
    if (type === 'out') return 'text-error';
    return 'text-info';
  }
</script>

<!-- Total Balance -->
<div class="stats w-full shadow mb-6">
  <div class="stat">
    <div class="stat-title">Total Balance</div>
    <div class="stat-value text-primary">
      Rp {data.totalBalance.toLocaleString('id-ID')}
    </div>
  </div>
</div>

<!-- Monthly Budget -->
{#if data.budgets.length > 0}
  <h2 class="mb-3 text-lg font-bold">Monthly Budget</h2>
  <div class="flex flex-col gap-3 mb-6">
    {#each data.budgets as budget}
      <div>
        <div class="flex justify-between text-sm mb-1">
          <span>{budget.name}</span>
          <span class="font-mono text-base-content/60">
            Rp {budget.spent.toLocaleString('id-ID')} / {budget.limit.toLocaleString('id-ID')}
          </span>
        </div>
        <progress
          class="progress w-full {budgetColor(budget.spent, budget.limit)}"
          value={Math.min(budget.spent, budget.limit)}
          max={budget.limit}
        ></progress>
      </div>
    {/each}
  </div>
{/if}

<!-- Recent Transactions -->
<div class="flex items-center justify-between mb-3">
  <h2 class="text-lg font-bold">Recent</h2>
  <a href="/history" class="link link-primary text-sm">View all</a>
</div>

{#if data.recentTransactions.length === 0}
  <p class="text-center text-base-content/60 py-6">No transactions yet. Tap + to add one.</p>
{:else}
  <div class="flex flex-col gap-1">
    {#each data.recentTransactions as tx}
      <div class="flex items-center justify-between py-2 border-b border-base-200">
        <div>
          <p class="font-medium text-sm">
            {tx.is_private && !tx.merchant ? 'Private' : tx.merchant || (tx.categories as {name: string})?.name || 'Uncategorized'}
          </p>
          <p class="text-xs text-base-content/60">
            {(tx.accounts as {name: string})?.name} · {tx.date}
          </p>
        </div>
        <span class="font-mono font-bold text-sm {amountColor(tx.type)}">
          {formatAmount(Number(tx.amount), tx.type)}
        </span>
      </div>
    {/each}
  </div>
{/if}
```

---

### Task 11: Transaction History Page

**Files:**
- Create: `arsa-app/src/routes/history/+page.server.ts`
- Create: `arsa-app/src/routes/history/+page.svelte`

**Step 1: Create history server load**

File: `src/routes/history/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';

interface Transaction {
  id: string;
  amount: string;
  type: string;
  date: string;
  merchant: string | null;
  notes: string | null;
  is_private: boolean;
  user_id: string;
  categories: { name: string } | null;
  accounts: { name: string } | null;
}

interface DateGroup {
  label: string;
  date: string;
  transactions: Transaction[];
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
  const { user } = await safeGetSession();
  if (!user) return { groups: [], hasMore: false };

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) return { groups: [], hasMore: false };

  const page = parseInt(url.searchParams.get('page') ?? '0');
  const limit = 50;
  const offset = page * limit;

  const { data: transactions, count } = await supabase
    .from('transactions')
    .select('id, amount, type, date, merchant, notes, is_private, user_id, categories(name), accounts(name)', { count: 'exact' })
    .eq('family_id', profile.family_id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Redact private transactions
  const sanitized = (transactions ?? []).map((tx) => ({
    ...tx,
    merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant,
    notes: tx.is_private && tx.user_id !== user.id ? null : tx.notes
  }));

  // Group by date
  const groupMap = new Map<string, Transaction[]>();
  for (const tx of sanitized) {
    const existing = groupMap.get(tx.date) ?? [];
    existing.push(tx as Transaction);
    groupMap.set(tx.date, existing);
  }

  const groups: DateGroup[] = Array.from(groupMap.entries()).map(([date, txs]) => ({
    label: getDateLabel(date),
    date,
    transactions: txs
  }));

  const totalCount = count ?? 0;
  const hasMore = offset + limit < totalCount;

  return { groups, hasMore, nextPage: page + 1 };
};
```

**Step 2: Create history page**

File: `src/routes/history/+page.svelte`

```svelte
<script lang="ts">
  let { data } = $props();

  function formatAmount(amount: number, type: string): string {
    const formatted = `Rp ${Math.abs(amount).toLocaleString('id-ID')}`;
    if (type === 'in') return `+${formatted}`;
    if (type === 'out') return `-${formatted}`;
    return formatted;
  }

  function amountColor(type: string): string {
    if (type === 'in') return 'text-success';
    if (type === 'out') return 'text-error';
    return 'text-info';
  }
</script>

<h1 class="mb-6 text-2xl font-bold">History</h1>

{#if data.groups.length === 0}
  <p class="text-center text-base-content/60 py-10">No transactions yet.</p>
{:else}
  {#each data.groups as group}
    <h3 class="mb-2 mt-4 text-sm font-semibold text-base-content/60">{group.label}</h3>
    <div class="flex flex-col gap-1">
      {#each group.transactions as tx}
        <div class="flex items-center justify-between py-3 border-b border-base-200">
          <div>
            <p class="font-medium text-sm">
              {tx.is_private && !tx.merchant ? 'Private' : tx.merchant || (tx.categories as {name: string})?.name || 'Uncategorized'}
            </p>
            <p class="text-xs text-base-content/60">
              {(tx.categories as {name: string})?.name ?? ''} · {(tx.accounts as {name: string})?.name}
            </p>
          </div>
          <span class="font-mono font-bold text-sm {amountColor(tx.type)}">
            {formatAmount(Number(tx.amount), tx.type)}
          </span>
        </div>
      {/each}
    </div>
  {/each}

  {#if data.hasMore}
    <div class="mt-6 text-center">
      <a href="/history?page={data.nextPage}" class="btn btn-ghost btn-sm">Load more</a>
    </div>
  {/if}
{/if}
```

---

### Task 12: Plan Placeholder Page

**Files:**
- Create: `arsa-app/src/routes/plan/+page.svelte`

**Step 1: Create placeholder**

File: `src/routes/plan/+page.svelte`

```svelte
<div class="flex flex-col items-center justify-center gap-4 pt-20 text-center">
  <h1 class="text-2xl font-bold">Plan</h1>
  <p class="text-base-content/60">Budget planning and projections coming soon.</p>
</div>
```

---

### Task 13: Final Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test full flow**

1. Login → Dashboard shows total balance (stat), empty budget/transactions
2. Settings → Accounts → Add "BCA" (bank, Rp 5.000.000) and "Cash" (cash, Rp 500.000)
3. Settings → Categories → Add "Groceries" (limit 2.000.000), "Transport" (limit 500.000)
4. Tap + (Add) → Expense → 150.000 → BCA → Groceries → Save
5. Dashboard: balance updated, budget progress bar shows, recent transactions list shows entry
6. Tap + → toggle Split → add two items: 100.000 Groceries + 50.000 Transport → Save
7. History → grouped by date, amounts color-coded
8. Test private transaction: check "Hide details" → Save → verify merchant hidden for other user
9. Bottom nav: active states highlight correctly on each page
10. Test delete guards: try deleting an account/category that has transactions → blocked

**Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

Expected: No errors.
