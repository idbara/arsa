# Arsa

Family Wealth & Lifestyle Manager. A mobile-first PWA for household finance tracking, investment monitoring, and family lifestyle gamification.

Built on 100% free-tier services (Rp0 infrastructure).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (Svelte 5) + TypeScript |
| Styling | Tailwind CSS v4 + daisyUI v5 |
| Database & Auth | Supabase PostgreSQL (RLS enforced) |
| Hosting | Cloudflare Pages |
| Object Storage | Cloudflare R2 |
| AI/OCR | Cloudflare Workers AI (Llama 3 Vision) |
| Market Scraper | Rust/Wasm on Cloudflare Workers |
| Email | Resend API |

## Features

- **Transaction tracking** — quick entry with split bill, private transactions, receipt attachments
- **Family workspace** — invite-based family groups with admin/member roles
- **Budget management** — category budgets with monthly progress tracking
- **Bank reconciliation** — client-side CSV matching (data never leaves the browser)
- **Receipt OCR** — camera capture, auto-compression, AI-powered data extraction
- **Wealth tracker** — gold, stocks, mutual funds with live market rates
- **Gamification** — family points and rewards for staying under budget
- **Auto-reports** — monthly email summaries

## Quick Start

```bash
cd arsa-app
npm install
cp .env.example .env
# Fill in PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full setup including Supabase and Cloudflare configuration.

## Project Structure

```
arsa/
├── arsa-app/              # SvelteKit application
│   ├── src/
│   │   ├── routes/        # Pages and API routes
│   │   ├── lib/           # Shared components and utilities
│   │   └── hooks.server.ts # Auth middleware
│   ├── wrangler.jsonc     # Cloudflare config
│   └── package.json
├── supabase/
│   └── migrations/        # Database schema and RLS policies
└── docs/                  # Project documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Development Guide](docs/DEVELOPMENT.md) | Local setup, dev workflow, database migrations |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deploy, CI/CD, monitoring, rollback |
| [Product Requirements](docs/PRD.md) | Feature scope and UI/UX guidelines |
| [Technical Spec](docs/TSD.md) | Architecture, data flows, security model |
| [Development Stages](docs/Development%20Stages.md) | 8-phase build roadmap |
| [Panduan Kontribusi](docs/CONTRIBUTING.md) | Branching, commit, code style, PR guidelines |

## License

Personal and non-commercial use only. See [LICENSE](LICENSE).
