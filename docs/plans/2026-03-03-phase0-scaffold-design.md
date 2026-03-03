# Phase 0: Project Scaffold Design

**Date:** 2026-03-03
**Scope:** SvelteKit project initialization with Tailwind+daisyUI, Supabase client, theme toggle

## Approach

Use `npm create svelte@latest` (official scaffolder) with TypeScript, ESLint, Prettier. Layer on dependencies manually for full control.

## Dependencies

**Runtime:**
- `@supabase/supabase-js` — DB/auth client
- `@sveltejs/adapter-cloudflare` — deployment adapter

**Dev:**
- `tailwindcss` + `@tailwindcss/vite` — Tailwind v4 via Vite plugin
- `daisyui` — component library plugin

## Configuration

- `svelte.config.js` — swap adapter-auto to adapter-cloudflare
- `vite.config.ts` — add Tailwind Vite plugin
- `app.css` — import Tailwind + daisyUI
- `app.html` — set `data-theme="dim"` on `<html>`
- `.env.example` — `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- daisyUI config: only `dim` and `cupcake` themes enabled

## Files to Create

### `src/lib/supabase.ts`
Supabase client using `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from `$env/static/public`. Single shared instance, no SSR auth hooks yet.

### `src/lib/theme.svelte.ts`
Rune-based theme store (`$state`) holding `'dim'` | `'cupcake'`. Defaults to `dim`. Persists to `localStorage`. Sets `data-theme` on `<html>` on load.

### `src/lib/components/ThemeToggle.svelte`
Toggle switch using daisyUI component. Swaps between dim and cupcake.

### `src/routes/+layout.svelte`
Imports `app.css`. Mobile-first container (max-width capped, centered). Bottom nav bar using daisyUI `btm-nav` with 5 tabs (Home, History, [+] Add, Plan, Settings) — non-functional placeholders.

### `src/routes/+page.svelte`
Placeholder landing page with app name "Arsa" and ThemeToggle component.

## Folder Conventions

```
src/lib/components/   — reusable UI components
src/lib/              — utilities (supabase.ts, theme.svelte.ts)
src/routes/           — SvelteKit pages
```

## Out of Scope

Auth, database schema, R2 storage, OCR, any business logic. This is the runnable shell only.
