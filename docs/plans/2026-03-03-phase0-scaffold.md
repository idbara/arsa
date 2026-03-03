# Phase 0: Project Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a runnable SvelteKit app with Tailwind v4, daisyUI v5, Supabase client, theme toggle, and mobile-first layout shell.

**Architecture:** SvelteKit with adapter-cloudflare, CSS-first Tailwind v4 via Vite plugin, daisyUI v5 configured via `@plugin` in CSS. Supabase client as a simple shared instance (no SSR auth yet).

**Tech Stack:** SvelteKit (latest), Svelte 5, TypeScript, Tailwind CSS v4, daisyUI v5, @supabase/supabase-js, @sveltejs/adapter-cloudflare

---

### Task 1: Scaffold SvelteKit Project

**Files:**
- Create: `arsa-app/` (entire project directory via CLI)

**Step 1: Run the SvelteKit scaffolder**

Run from `C:\Users\barar\Work\arsa`:

```bash
npx sv create arsa-app
```

Interactive prompts — select:
1. Template: `minimal`
2. Type checking: `ts` (TypeScript)
3. Add-ons: select `eslint`, `prettier`, `tailwindcss`

This auto-installs `tailwindcss`, `@tailwindcss/vite`, configures `vite.config.ts` with the Tailwind plugin, creates `src/app.css` with `@import "tailwindcss"`, and sets up ESLint + Prettier with Svelte plugins.

**Step 2: Verify scaffold runs**

```bash
cd arsa-app && npm run dev
```

Expected: Dev server starts, page loads at `http://localhost:5173`

**Step 3: Stop dev server** (Ctrl+C)

---

### Task 2: Install Remaining Dependencies

**Files:**
- Modify: `arsa-app/package.json`

**Step 1: Install runtime deps**

```bash
npm install @supabase/supabase-js
```

**Step 2: Install dev deps**

```bash
npm install -D daisyui@latest @sveltejs/adapter-cloudflare
```

**Step 3: Verify install succeeded**

```bash
npm ls @supabase/supabase-js daisyui @sveltejs/adapter-cloudflare
```

Expected: All three listed without errors.

---

### Task 3: Configure Adapter & Wrangler

**Files:**
- Modify: `arsa-app/svelte.config.js`
- Create: `arsa-app/wrangler.jsonc`

**Step 1: Update svelte.config.js**

Replace the adapter import and usage:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: [vitePreprocess()],
	kit: {
		adapter: adapter()
	}
};
```

**Step 2: Create wrangler.jsonc**

```jsonc
{
	"name": "arsa-app",
	"main": ".svelte-kit/cloudflare/_worker.js",
	"compatibility_date": "2025-01-01",
	"compatibility_flags": ["nodejs_als"],
	"assets": {
		"binding": "ASSETS",
		"directory": ".svelte-kit/cloudflare"
	}
}
```

**Step 3: Verify build works**

```bash
npm run build
```

Expected: Build completes without errors.

---

### Task 4: Configure daisyUI & Themes

**Files:**
- Modify: `arsa-app/src/app.css`
- Modify: `arsa-app/src/app.html`

**Step 1: Add daisyUI plugin to app.css**

The file should already have `@import "tailwindcss";` from the scaffold. Add daisyUI config after it:

```css
@import "tailwindcss";
@plugin "daisyui" {
	themes: dim --default, cupcake;
}
```

Only `dim` and `cupcake` are enabled — keeps the CSS bundle small.

**Step 2: Set default theme on app.html**

In `src/app.html`, add `data-theme="dim"` to the `<html>` tag:

```html
<html lang="en" data-theme="dim">
```

**Step 3: Verify daisyUI works**

Temporarily add a daisyUI button to `src/routes/+page.svelte`:

```svelte
<button class="btn btn-primary">Test</button>
```

Run `npm run dev`, confirm the button renders with daisyUI dim theme styling. Then remove the test button.

---

### Task 5: Create Supabase Client

**Files:**
- Create: `arsa-app/src/lib/supabase.ts`
- Create: `arsa-app/.env.example`

**Step 1: Create .env.example**

```
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 2: Create Supabase client helper**

File: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

No test needed — this will error at import time if env vars are missing, which is the correct behavior. It will be exercised in Phase 1 when auth is built.

---

### Task 6: Create Theme Store

**Files:**
- Create: `arsa-app/src/lib/theme.svelte.ts`

**Step 1: Create the theme rune store**

File: `src/lib/theme.svelte.ts`

```typescript
import { browser } from '$app/environment';

export type Theme = 'dim' | 'cupcake';

const STORAGE_KEY = 'arsa-theme';
const DEFAULT_THEME: Theme = 'dim';

function getInitialTheme(): Theme {
	if (!browser) return DEFAULT_THEME;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'dim' || stored === 'cupcake') return stored;
	return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem(STORAGE_KEY, theme);
}

let current: Theme = $state(getInitialTheme());

if (browser) {
	applyTheme(current);
}

export const theme = {
	get current() {
		return current;
	},
	toggle() {
		current = current === 'dim' ? 'cupcake' : 'dim';
		applyTheme(current);
	}
};
```

---

### Task 7: Create ThemeToggle Component

**Files:**
- Create: `arsa-app/src/lib/components/ThemeToggle.svelte`

**Step 1: Create ThemeToggle.svelte**

```svelte
<script lang="ts">
	import { theme } from '$lib/theme.svelte';
</script>

<label class="swap swap-rotate">
	<input
		type="checkbox"
		checked={theme.current === 'cupcake'}
		onchange={theme.toggle}
	/>
	<!-- sun icon (cupcake/light) -->
	<svg class="swap-on size-6 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
	</svg>
	<!-- moon icon (dim/dark) -->
	<svg class="swap-off size-6 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/>
	</svg>
</label>
```

---

### Task 8: Create Layout with Bottom Nav Shell

**Files:**
- Modify: `arsa-app/src/routes/+layout.svelte`

**Step 1: Replace +layout.svelte content**

```svelte
<script lang="ts">
	import '../app.css';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

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
	<main class="flex-1 px-4 py-6">
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
```

---

### Task 9: Create Landing Page

**Files:**
- Modify: `arsa-app/src/routes/+page.svelte`

**Step 1: Replace +page.svelte content**

```svelte
<div class="flex flex-col items-center justify-center gap-4 pt-20">
	<h1 class="text-4xl font-bold">Arsa</h1>
	<p class="text-base-content/60">Family Wealth & Lifestyle Manager</p>
</div>
```

---

### Task 10: Add .gitignore entries and final verification

**Files:**
- Modify: `arsa-app/.gitignore`

**Step 1: Ensure .env is gitignored**

The SvelteKit scaffold should already include `.env` patterns. Verify `.env` and `.env.*` (except `.env.example`) are in `.gitignore`. Add if missing:

```
.env
.env.*
!.env.example
```

**Step 2: Full verification**

```bash
npm run dev
```

Expected: App loads at localhost:5173 with:
- "Arsa" heading centered on page
- Dim theme (dark) active
- Theme toggle in top-right swaps to cupcake (light pastel)
- Bottom nav bar with 5 tabs visible
- No console errors

```bash
npm run build
```

Expected: Build succeeds with no errors.

```bash
npm run lint
```

Expected: No lint errors.

---

Plan complete and saved to `docs/plans/2026-03-03-phase0-scaffold.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints

Which approach?
