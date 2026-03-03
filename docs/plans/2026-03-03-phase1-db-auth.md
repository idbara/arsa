# Phase 1: Database Schema & Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the full Supabase database schema with RLS, SSR cookie-based auth, login/register pages, family workspace onboarding, and magic link invites.

**Architecture:** `@supabase/ssr` handles cookie-based sessions via `hooks.server.ts`. SvelteKit form actions handle auth operations. Route guards in `+layout.server.ts` enforce auth + family membership. All 8 DB tables created upfront with RLS policies.

**Tech Stack:** SvelteKit, @supabase/ssr, @supabase/supabase-js, Supabase PostgreSQL, daisyUI

**Prerequisites:** Phase 0 scaffold must be complete (SvelteKit app running with Tailwind+daisyUI). A Supabase project must exist with URL and anon key available.

---

### Task 1: Install @supabase/ssr

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

```bash
cd arsa-app && npm install @supabase/ssr
```

**Step 2: Verify installation**

```bash
npm ls @supabase/ssr
```

Expected: `@supabase/ssr@0.x.x` listed without errors.

---

### Task 2: Create Database Migration — Core Tables

**Files:**
- Create: `supabase/migrations/001_schema.sql`

**Step 1: Create the migration file**

```sql
-- families
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- users (extends auth.users)
create table users (
  id uuid primary key references auth.users on delete cascade,
  family_id uuid references families on delete set null,
  role text check (role in ('admin', 'member')),
  display_name text not null,
  created_at timestamptz default now()
);

-- accounts (wallets)
create table accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  type text not null,
  balance numeric not null default 0,
  created_at timestamptz default now()
);

-- categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  monthly_limit numeric,
  is_child_related boolean not null default false,
  created_at timestamptz default now()
);

-- transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  category_id uuid references categories on delete set null,
  user_id uuid not null references users on delete cascade,
  amount numeric not null,
  type text not null check (type in ('in', 'out', 'transfer')),
  receipt_url text,
  is_reconciled boolean not null default false,
  is_private boolean not null default false,
  date date not null default current_date,
  merchant text,
  notes text,
  created_at timestamptz default now()
);

-- market_rates (global, no family scope)
create table market_rates (
  asset_code text primary key,
  asset_type text not null check (asset_type in ('gold', 'stock', 'mutual_fund')),
  buy_price numeric not null,
  sell_price numeric not null,
  updated_at timestamptz default now()
);

-- investments
create table investments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  asset_code text not null references market_rates on delete cascade,
  qty numeric not null,
  avg_buy_price numeric not null,
  created_at timestamptz default now()
);

-- gamification
create table gamification (
  family_id uuid primary key references families on delete cascade,
  current_points integer not null default 0,
  rewards_catalog jsonb not null default '[]'::jsonb
);

-- invites
create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  created_by uuid not null references users on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz default now()
);
```

**Step 2: Run the migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run the SQL above.

Alternatively, if using Supabase CLI:
```bash
supabase db push
```

Expected: All 9 tables created without errors.

---

### Task 3: Create Database Migration — RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls.sql`

**Step 1: Create the RLS migration file**

```sql
-- Enable RLS on all family-scoped tables
alter table families enable row level security;
alter table users enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table investments enable row level security;
alter table gamification enable row level security;
alter table invites enable row level security;

-- Helper: get current user's family_id
-- Used in policies below

-- families: members can read their own family
create policy "users can view own family"
  on families for select
  using (id = (select family_id from users where id = auth.uid()));

-- families: any authenticated user can insert (creating a new family)
create policy "authenticated users can create family"
  on families for insert
  to authenticated
  with check (true);

-- users: can read other members in same family
create policy "family members can view each other"
  on users for select
  using (
    family_id = (select family_id from users where id = auth.uid())
    or id = auth.uid()
  );

-- users: can insert own row (registration)
create policy "users can insert own row"
  on users for insert
  to authenticated
  with check (id = auth.uid());

-- users: can update own row (joining family)
create policy "users can update own row"
  on users for update
  to authenticated
  using (id = auth.uid());

-- accounts: family access
create policy "family access"
  on accounts for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- categories: family access
create policy "family access"
  on categories for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- transactions: family access
create policy "family access"
  on transactions for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- investments: family access
create policy "family access"
  on investments for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- gamification: family access
create policy "family access"
  on gamification for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- invites: family members can read invites for their family
create policy "family members can view invites"
  on invites for select
  using (family_id = (select family_id from users where id = auth.uid()));

-- invites: admin can create invites
create policy "admin can create invites"
  on invites for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- invites: allow reading by token for join flow (anyone authenticated)
create policy "anyone can read invite by token"
  on invites for select
  to authenticated
  using (true);

-- market_rates: public read for all authenticated users
alter table market_rates enable row level security;
create policy "authenticated users can read market rates"
  on market_rates for select
  to authenticated
  using (true);
```

**Step 2: Run the migration in Supabase**

Paste and run in Supabase SQL Editor.

Expected: All policies created without errors.

---

### Task 4: Type Declarations

**Files:**
- Modify: `arsa-app/src/app.d.ts`

**Step 1: Update app.d.ts with Supabase types**

```typescript
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession(): Promise<{ session: Session | null; user: User | null }>;
    }
    interface PageData {
      session: Session | null;
      user: User | null;
    }
  }
}

export {};
```

**Step 2: Verify no TypeScript errors**

```bash
npm run check
```

Expected: No type errors (or only pre-existing ones from scaffold).

---

### Task 5: Server Hooks — Supabase SSR Client

**Files:**
- Create: `arsa-app/src/hooks.server.ts`

**Step 1: Create hooks.server.ts**

```typescript
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      }
    }
  });

  event.locals.safeGetSession = async () => {
    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) {
      return { session: null, user: null };
    }
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    return { session, user };
  };

  // Route guard
  const publicRoutes = ['/login', '/register'];
  const isPublic = publicRoutes.some((r) => event.url.pathname.startsWith(r));
  const isInvite = event.url.pathname.startsWith('/invite/');

  if (!isPublic && !isInvite) {
    const { session, user } = await event.locals.safeGetSession();

    if (!session) {
      redirect(303, '/login');
    }

    // Check if user has a family (skip for onboarding routes)
    if (!event.url.pathname.startsWith('/onboarding')) {
      const { data: profile } = await event.locals.supabase
        .from('users')
        .select('family_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.family_id) {
        redirect(303, '/onboarding');
      }
    }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
};
```

**Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts without errors. Navigating to `http://localhost:5173` should redirect to `/login` (since no session exists).

---

### Task 6: Layout Server Load — Session Passing

**Files:**
- Create: `arsa-app/src/routes/+layout.server.ts`

**Step 1: Create +layout.server.ts**

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
  const { session, user } = await safeGetSession();

  return {
    session,
    user,
    cookies: cookies.getAll()
  };
};
```

---

### Task 7: Layout Universal Load — Browser/Server Client

**Files:**
- Create: `arsa-app/src/routes/+layout.ts`

**Step 1: Create +layout.ts**

```typescript
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, data, depends }) => {
  depends('supabase:auth');

  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch }
      })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch },
        cookies: {
          getAll() {
            return data.cookies;
          }
        }
      });

  const { data: { session } } = await supabase.auth.getSession();
  const user = data.user;

  return { supabase, session, user };
};
```

---

### Task 8: Update Layout Svelte — Auth State Listener

**Files:**
- Modify: `arsa-app/src/routes/+layout.svelte`

**Step 1: Update +layout.svelte**

Replace the existing content. Keep the bottom nav, header, and theme toggle from Phase 0, but add the auth state change listener and conditionally show nav only when authenticated with a family.

```svelte
<script lang="ts">
  import '../app.css';
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let { data, children } = $props();
  let { supabase, session } = $derived(data);

  onMount(() => {
    const { data: authData } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => authData.subscription.unsubscribe();
  });

  // Show full app chrome only when authenticated
  let showAppShell = $derived(!!session);
</script>

{#if showAppShell}
  <div class="flex min-h-screen flex-col">
    <!-- Top bar -->
    <header class="navbar bg-base-200">
      <div class="flex-1">
        <span class="text-xl font-bold">Arsa</span>
      </div>
      <div class="flex-none">
        <ThemeToggle />
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 px-4 py-6 pb-20">
      {@render children()}
    </main>

    <!-- Bottom navigation -->
    <div class="btm-nav btm-nav-sm">
      <button class="text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-4 0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1" />
        </svg>
        <span class="btm-nav-label text-xs">Home</span>
      </button>
      <button>
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        <span class="btm-nav-label text-xs">History</span>
      </button>
      <button>
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="btm-nav-label text-xs">Add</span>
      </button>
      <button>
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
        </svg>
        <span class="btm-nav-label text-xs">Plan</span>
      </button>
      <button>
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
        </svg>
        <span class="btm-nav-label text-xs">Settings</span>
      </button>
    </div>
  </div>
{:else}
  <!-- Auth/onboarding pages: no app shell -->
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4">
    {@render children()}
  </div>
{/if}
```

---

### Task 9: Login Page

**Files:**
- Create: `arsa-app/src/routes/login/+page.server.ts`
- Create: `arsa-app/src/routes/login/+page.svelte`

**Step 1: Create login form action**

File: `src/routes/login/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (session) {
    redirect(303, '/');
  }
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.', email });
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail(400, { error: error.message, email });
    }

    redirect(303, '/');
  }
};
```

**Step 2: Create login page**

File: `src/routes/login/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title justify-center text-2xl">Arsa</h2>
    <p class="text-center text-base-content/60">Sign in to your account</p>

    {#if form?.error}
      <div class="alert alert-error text-sm">
        {form.error}
      </div>
    {/if}

    <form method="POST" use:enhance class="flex flex-col gap-3">
      <label class="floating-label">
        <span>Email</span>
        <input
          name="email"
          type="email"
          placeholder="Email"
          class="input input-bordered w-full"
          value={form?.email ?? ''}
          required
        />
      </label>

      <label class="floating-label">
        <span>Password</span>
        <input
          name="password"
          type="password"
          placeholder="Password"
          class="input input-bordered w-full"
          required
        />
      </label>

      <button type="submit" class="btn btn-primary w-full">Sign In</button>
    </form>

    <p class="text-center text-sm">
      Don't have an account? <a href="/register" class="link link-primary">Register</a>
    </p>
  </div>
</div>
```

---

### Task 10: Register Page

**Files:**
- Create: `arsa-app/src/routes/register/+page.server.ts`
- Create: `arsa-app/src/routes/register/+page.svelte`

**Step 1: Create register form action**

File: `src/routes/register/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (session) {
    redirect(303, '/');
  }
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('display_name') as string;

    if (!email || !password || !displayName) {
      return fail(400, { error: 'All fields are required.', email, displayName });
    }

    if (password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters.', email, displayName });
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return fail(400, { error: authError.message, email, displayName });
    }

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({ id: authData.user.id, display_name: displayName });

      if (profileError) {
        return fail(500, { error: 'Account created but profile setup failed. Try logging in.', email, displayName });
      }
    }

    redirect(303, '/onboarding');
  }
};
```

**Step 2: Create register page**

File: `src/routes/register/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title justify-center text-2xl">Create Account</h2>
    <p class="text-center text-base-content/60">Join Arsa to manage your family finances</p>

    {#if form?.error}
      <div class="alert alert-error text-sm">
        {form.error}
      </div>
    {/if}

    <form method="POST" use:enhance class="flex flex-col gap-3">
      <label class="floating-label">
        <span>Display Name</span>
        <input
          name="display_name"
          type="text"
          placeholder="Display Name"
          class="input input-bordered w-full"
          value={form?.displayName ?? ''}
          required
        />
      </label>

      <label class="floating-label">
        <span>Email</span>
        <input
          name="email"
          type="email"
          placeholder="Email"
          class="input input-bordered w-full"
          value={form?.email ?? ''}
          required
        />
      </label>

      <label class="floating-label">
        <span>Password</span>
        <input
          name="password"
          type="password"
          placeholder="Password"
          class="input input-bordered w-full"
          minlength="6"
          required
        />
      </label>

      <button type="submit" class="btn btn-primary w-full">Register</button>
    </form>

    <p class="text-center text-sm">
      Already have an account? <a href="/login" class="link link-primary">Sign in</a>
    </p>
  </div>
</div>
```

---

### Task 11: Logout Action

**Files:**
- Create: `arsa-app/src/routes/logout/+page.server.ts`

**Step 1: Create logout action**

File: `src/routes/logout/+page.server.ts`

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ locals: { supabase } }) => {
    await supabase.auth.signOut();
    redirect(303, '/login');
  }
};
```

This is a POST-only endpoint. Trigger it with:
```svelte
<form method="POST" action="/logout">
  <button type="submit" class="btn btn-ghost">Logout</button>
</form>
```

---

### Task 12: Onboarding Page — Create Family

**Files:**
- Create: `arsa-app/src/routes/onboarding/+page.server.ts`
- Create: `arsa-app/src/routes/onboarding/+page.svelte`

**Step 1: Create onboarding form action**

File: `src/routes/onboarding/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    redirect(303, '/login');
  }

  // If already in a family, skip onboarding
  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profile?.family_id) {
    redirect(303, '/');
  }
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) {
      redirect(303, '/login');
    }

    const formData = await request.formData();
    const familyName = formData.get('family_name') as string;

    if (!familyName) {
      return fail(400, { error: 'Family name is required.' });
    }

    // Create the family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName })
      .select()
      .single();

    if (familyError) {
      return fail(500, { error: 'Failed to create family.' });
    }

    // Update user: set family_id and role to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ family_id: family.id, role: 'admin' })
      .eq('id', user.id);

    if (updateError) {
      return fail(500, { error: 'Family created but failed to link your account.' });
    }

    redirect(303, '/onboarding/invite');
  }
};
```

**Step 2: Create onboarding page**

File: `src/routes/onboarding/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title justify-center text-2xl">Welcome to Arsa</h2>
    <p class="text-center text-base-content/60">Create your family workspace or join an existing one</p>

    {#if form?.error}
      <div class="alert alert-error text-sm">
        {form.error}
      </div>
    {/if}

    <form method="POST" action="?/create" use:enhance class="flex flex-col gap-3">
      <label class="floating-label">
        <span>Family Name</span>
        <input
          name="family_name"
          type="text"
          placeholder="Family Name"
          class="input input-bordered w-full"
          required
        />
      </label>

      <button type="submit" class="btn btn-primary w-full">Create Family</button>
    </form>

    <div class="divider">OR</div>

    <p class="text-center text-sm text-base-content/60">
      Have an invite link from your partner? Open the link directly to join their family.
    </p>
  </div>
</div>
```

---

### Task 13: Invite Generation Page

**Files:**
- Create: `arsa-app/src/routes/onboarding/invite/+page.server.ts`
- Create: `arsa-app/src/routes/onboarding/invite/+page.svelte`

**Step 1: Create invite generation logic**

File: `src/routes/onboarding/invite/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
  const { user } = await safeGetSession();
  if (!user) {
    redirect(303, '/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    redirect(303, '/onboarding');
  }

  // Check for existing active invite
  const { data: existingInvite } = await supabase
    .from('invites')
    .select('token, expires_at')
    .eq('family_id', profile.family_id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const baseUrl = url.origin;

  return {
    inviteLink: existingInvite ? `${baseUrl}/invite/${existingInvite.token}` : null,
    familyId: profile.family_id
  };
};

export const actions: Actions = {
  generate: async ({ locals: { supabase, safeGetSession }, url }) => {
    const { user } = await safeGetSession();
    if (!user) {
      redirect(303, '/login');
    }

    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (!profile?.family_id) {
      return fail(400, { error: 'You must belong to a family first.' });
    }

    const { data: invite, error } = await supabase
      .from('invites')
      .insert({ family_id: profile.family_id, created_by: user.id })
      .select('token')
      .single();

    if (error) {
      return fail(500, { error: 'Failed to generate invite.' });
    }

    return { inviteLink: `${url.origin}/invite/${invite.token}` };
  }
};
```

**Step 2: Create invite page**

File: `src/routes/onboarding/invite/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let inviteLink = $derived(form?.inviteLink ?? data.inviteLink);
  let copied = $state(false);

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title justify-center text-2xl">Invite Your Partner</h2>
    <p class="text-center text-base-content/60">Share this link so they can join your family workspace</p>

    {#if form?.error}
      <div class="alert alert-error text-sm">
        {form.error}
      </div>
    {/if}

    {#if inviteLink}
      <div class="flex flex-col gap-2">
        <input type="text" class="input input-bordered w-full text-sm" value={inviteLink} readonly />
        <button class="btn btn-secondary w-full" onclick={copyLink}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    {:else}
      <form method="POST" action="?/generate" use:enhance>
        <button type="submit" class="btn btn-primary w-full">Generate Invite Link</button>
      </form>
    {/if}

    <div class="divider"></div>

    <a href="/" class="btn btn-ghost w-full">Skip for now</a>
  </div>
</div>
```

---

### Task 14: Join Family via Invite Token

**Files:**
- Create: `arsa-app/src/routes/invite/[token]/+page.server.ts`
- Create: `arsa-app/src/routes/invite/[token]/+page.svelte`

**Step 1: Create invite join logic**

File: `src/routes/invite/[token]/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession, supabase } }) => {
  const { data: invite } = await supabase
    .from('invites')
    .select('id, family_id, expires_at, used_at, families(name)')
    .eq('token', params.token)
    .single();

  if (!invite) {
    return { error: 'Invalid invite link.' };
  }

  if (invite.used_at) {
    return { error: 'This invite has already been used.' };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite has expired.' };
  }

  const { session } = await safeGetSession();

  return {
    familyName: (invite.families as { name: string })?.name ?? 'Unknown',
    token: params.token,
    isAuthenticated: !!session
  };
};

export const actions: Actions = {
  join: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) {
      redirect(303, `/login?redirect=/invite/${params.token}`);
    }

    // Validate invite again
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, family_id, expires_at, used_at')
      .eq('token', params.token)
      .single();

    if (inviteError || !invite) {
      return fail(400, { error: 'Invalid invite link.' });
    }

    if (invite.used_at) {
      return fail(400, { error: 'This invite has already been used.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return fail(400, { error: 'This invite has expired.' });
    }

    // Check user doesn't already belong to a family
    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profile?.family_id) {
      return fail(400, { error: 'You already belong to a family.' });
    }

    // Join the family
    const { error: updateError } = await supabase
      .from('users')
      .update({ family_id: invite.family_id, role: 'member' })
      .eq('id', user.id);

    if (updateError) {
      return fail(500, { error: 'Failed to join family.' });
    }

    // Mark invite as used
    await supabase
      .from('invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id);

    redirect(303, '/');
  }
};
```

**Step 2: Create invite join page**

File: `src/routes/invite/[token]/+page.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
  <div class="card-body">
    {#if data.error}
      <h2 class="card-title justify-center text-2xl">Invalid Invite</h2>
      <div class="alert alert-error text-sm">{data.error}</div>
      <a href="/login" class="btn btn-primary w-full">Go to Login</a>
    {:else}
      <h2 class="card-title justify-center text-2xl">Join Family</h2>
      <p class="text-center text-base-content/60">
        You've been invited to join <span class="font-bold">{data.familyName}</span>
      </p>

      {#if form?.error}
        <div class="alert alert-error text-sm">{form.error}</div>
      {/if}

      {#if data.isAuthenticated}
        <form method="POST" action="?/join" use:enhance>
          <button type="submit" class="btn btn-primary w-full">Join Family</button>
        </form>
      {:else}
        <a href="/register" class="btn btn-primary w-full">Register to Join</a>
        <a href="/login?redirect=/invite/{data.token}" class="btn btn-ghost w-full">
          Already have an account? Sign in
        </a>
      {/if}
    {/if}
  </div>
</div>
```

---

### Task 15: Delete Phase 0 Simple Supabase Client

**Files:**
- Delete: `arsa-app/src/lib/supabase.ts`

**Step 1: Remove the old simple client**

The SSR setup in Tasks 5-7 replaces this file entirely. Delete `src/lib/supabase.ts`.

Any component that needs Supabase should access it via `data.supabase` from the layout load, not from a direct import.

---

### Task 16: Update Home Page

**Files:**
- Modify: `arsa-app/src/routes/+page.svelte`

**Step 1: Update the landing page to show user info**

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex flex-col items-center gap-4 pt-10">
  <h1 class="text-3xl font-bold">Welcome to Arsa</h1>
  <p class="text-base-content/60">Signed in as {data.user?.email}</p>

  <form method="POST" action="/logout">
    <button type="submit" class="btn btn-ghost btn-sm">Sign out</button>
  </form>
</div>
```

---

### Task 17: Final Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test the full flow**

1. Visit `http://localhost:5173` → should redirect to `/login`
2. Click "Register" → fill form → should redirect to `/onboarding`
3. Enter family name → "Create Family" → should redirect to `/onboarding/invite`
4. "Generate Invite Link" → copy the link
5. "Skip for now" → should land on home page with email shown and bottom nav visible
6. Sign out → should redirect to `/login`
7. Open the invite link in an incognito window → should show "Join Family" page
8. Register a new account from invite page → join family → lands on home page

**Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Verify lint**

```bash
npm run lint
```

Expected: No errors.
