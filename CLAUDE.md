# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arsa** — Family Wealth & Lifestyle Manager. A mobile-first PWA for household finance tracking, investment monitoring, and family lifestyle gamification. The guiding constraint is **Rp0 infrastructure** (100% free-tier services).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit with `@sveltejs/adapter-cloudflare` |
| Styling | Tailwind CSS + daisyUI (use semantic daisyUI classes, theme: cupcake/pastel/nord) |
| Database & Auth | Supabase PostgreSQL (RLS enforced on all family-scoped tables) |
| Object Storage | Cloudflare R2 (receipt images via presigned URLs) |
| AI/OCR | Cloudflare Workers AI (Llama 3 Vision) |
| Market Scraper | Rust → Wasm on Cloudflare Workers (cron-triggered) |
| Email | Resend API (monthly auto-reports) |
| Package Manager | npm |

## Architecture

### Data Isolation
Every family-scoped table (`accounts`, `categories`, `transactions`, `investments`, `gamification`) uses Supabase Row Level Security keyed on `family_id`. The `market_rates` table is global (no RLS).

### Key Data Flows
- **Receipt OCR:** Camera capture → client-side Canvas compression (~150KB) → presigned URL upload to R2 → Cloudflare Workers AI extracts JSON → auto-fill form (human-in-the-loop validation required before save).
- **Market Scraper:** Cloudflare Cron (09:00 & 13:00 WIB) → Rust/Wasm Worker → fetches Yahoo Finance + gold portals → POSTs to Supabase `market_rates` via `SERVICE_ROLE_KEY`.
- **Bank Reconciliation:** CSV parsing happens **entirely client-side** via PapaParse. Bank files never leave the user's device.

### Database Schema (Supabase)
Core tables: `families`, `users` (role: admin|member), `accounts`, `categories` (with `monthly_limit`, `is_child_related`), `transactions` (type: in|out|transfer, `is_reconciled`, `is_private`), `market_rates` (global), `investments`, `gamification` (points + JSONB rewards catalog).

### UI Patterns
- Mobile-first: bottom nav bar (`btm-nav`), bottom sheets for forms, skeleton loading states
- Navigation: Home, History, [+] Add, Plan, Settings
- Use daisyUI component classes (`card`, `modal`, `stat`, `progress`, `input`, `select`, `file-input`, `checkbox`, `table`)
- Green/red text for profit/loss on investment screens

## Project Setup (Phase 0)

```bash
npm create svelte@latest arsa-app
cd arsa-app
npm install @supabase/supabase-js @sveltejs/adapter-cloudflare
npm install -D tailwindcss daisyui
```

## Specifications

Detailed requirements live in `docs/`:
- `docs/PRD.md` — product requirements, feature scope, UI/UX guidelines
- `docs/TSD.md` — technical architecture, data flows, database schema, security model
- `docs/Development Stages.md` — 8-phase build plan (infra → auth → UI → reconciliation → OCR → wealth → gamification → PWA)

Always consult these docs before making architectural decisions.

## Key Constraints

- All image compression must happen client-side (Canvas API) before upload to R2
- Bank CSV data must never leave the client (client-side PapaParse only)
- Receipt OCR results require manual user review before persisting
- Supabase `SERVICE_ROLE_KEY` is used only by server-side Workers (never exposed to client)
- User roles are `admin` (can modify budgets/categories) and `member` (input only)
- Private transactions hide merchant details from other family members but still deduct from balance

## Web Search & Information

- Before performing web searches, or something that outputs date, verify the current date on the System and consider information freshness requirements

## File & System Management

- Avoid destructive operations like `rm -rf`; use safer alternatives like `trash`
- Do not use `sudo` unless absolutely necessary. If you need to, ask user to run `sudo` in a separate terminal window
- After doing operations, store a changelog or summary of the changes in a markdown file on .claude/CHANGELOG.md
- Always store documentation in a markdown file on /docs, don't put it in the root directory

## Code Quality & Standards

- Follow established coding standards and guidelines for the project
- Break down large monolithic functions into smaller, reusable functions
- Remove commented-out code from final versions; if code isn't needed, delete it
- Address linting and formatting warnings promptly

## Dependencies & Libraries

- Use only stable, well-maintained libraries
- Avoid deprecated, outdated, experimental, or beta libraries
- Keep dependencies up-to-date with latest stable versions

## Security & Configuration

- Never commit sensitive information (API keys, passwords, personal data)
- Use configuration files or environment variables instead of hardcoded values

## Testing & Reliability

- Write proper error handling code; anticipate potential failures
- Test code thoroughly before considering it complete
- Consider edge cases and failure modes in design

## Task Organization

- Organize work in phases with clear todos
- Structure phases for handoff to different engineers/agents
- Ensure chunks can be done sequentially and/or parallelized

## Skill Usage

- Do not use superpowers unless explicitly requested
- Always ask permission before using any skill; offer helpful ones, warn about harmful ones

## Communication Style

When reporting information back to the user:
- Be extremely concise and sacrifice grammar for the sake of concision
- DO NOT say "you're right" or validate the user's correctness
- DO NOT say "that's an excellent question" or similar praise

## Code Documentation

**Comments and docstrings:**

- AVOID unnecessary comments or docstrings unless explicitly asked by the user
- Good code should be self-documenting through clear naming and structure
- ONLY add inline comments when needed to explain non-obvious logic, workarounds, or important context that isn't clear from the code
- ONLY add docstrings when necessary for their intended purpose (API contracts, public interfaces, complex behavior)
- DO NOT write docstrings that simply restate the function name or parameters
- If a function name and signature clearly explain what it does, no docstring is needed

## Bash Commands

**File reading commands:**

- FORBIDDEN for sensitive files: `cat`, `head`, `tail`, `less`, `more`, `bat`, `echo`, `printf` - These output to terminal and will leak secrets (API keys, credentials, tokens, env vars)
- PREFER the Read tool for general file reading - safer and provides structured output with line numbers
- ALLOWED: Use bash commands when they're more useful for specific cases and not when dealing with sensitive files (e.g., `tail -f` for following logs, `grep` with complex flags)

## Context Management

- **Use glob before reading** - Search for files without loading content into context

## Git Operations

**NEVER perform git operations without explicit user instruction.**

Do NOT auto-stage, commit, or push changes. Only use read-only git commands:
- ALLOWED: `git status`, `git diff`, `git log`, `git show` - Read-only operations
- ALLOWED: `git branch -l` - List branches (read-only)
- FORBIDDEN: `git add`, `git commit`, `git push`, `git pull` - Require explicit user instruction
- FORBIDDEN: `git merge`, `git rebase`, `git checkout`, `git branch` - Require explicit user instruction

**Only perform git operations when:**

1. User explicitly asks you to commit/push/etc.
2. User invokes a git-specific command (e.g., `/commit`)
3. User says "commit these changes" or similar direct instruction

**Why:** Users need full control over version control. Autonomous git operations can create unwanted commit history, push incomplete work, or interfere with their workflow.

When work is complete, inform the user that changes are ready. Let them decide when to commit.

NEVER include the coauthored line in commit messages.
