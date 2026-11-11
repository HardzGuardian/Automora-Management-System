# Automora Company Management System

Internal operations platform for Automora Tech Solutions LLP: employees, clients, projects, tasks, and operational finance.

Source of truth for product rules: the *Automora Company Management System Development Blueprint* (v1.0, 07 Nov 2026). It is marked confidential/internal, so the PDF is **not stored in this public repo** — get it from Sagar / the project owner.
Source of truth for **how we build it**: the documents in [`docs/`](docs).

## Read in this order

| # | Document | Who |
|---|----------|-----|
| 1 | [docs/00-architecture.md](docs/00-architecture.md) — architecture and the decisions behind it | everyone |
| 2 | [docs/01-team-plan.md](docs/01-team-plan.md) — phases, sprints, who does what and when | everyone |
| 3 | [docs/02-contracts.md](docs/02-contracts.md) — shared conventions, permission catalogue, table ownership, handoffs | everyone |
| 4 | [docs/03-dev1-sagar.md](docs/03-dev1-sagar.md) — Foundation & Core Operations | Sagar |
| 5 | [docs/04-dev2-chintan.md](docs/04-dev2-chintan.md) — Finance & Business Logic | Chintan |
| 6 | [docs/05-dev3-shubhangi.md](docs/05-dev3-shubhangi.md) — Dashboard, UI & Integration | Shubhangi |
| 7 | [docs/06-workflow.md](docs/06-workflow.md) — git, PRs, CI, Definition of Done | everyone |
| 8 | [docs/08-data-model.md](docs/08-data-model.md) — ERD and table list | everyone |
| 9 | [docs/progress.md](docs/progress.md) — task tracker · [docs/decisions.md](docs/decisions.md) — decision log | everyone |
| – | [docs/07-file-architecture.md](docs/07-file-architecture.md) — full project file/folder tree with owners and import rules | everyone |

## Team

| Dev | Name | Owns |
|-----|------|------|
| 1 | Sagar ([@HardzGuardian](https://github.com/HardzGuardian)) | Auth, RBAC, employees, clients, projects, tasks, shared platform libs |
| 2 | Chintan ([@Chintan572](https://github.com/Chintan572)) | Invoices, payments, expenses, financial reports, money logic |
| 3 | Shubhangi ([@shubhangi-builds](https://github.com/shubhangi-builds)) | App shell, design system, dashboards, reports UI, notifications, settings, integration |

## Stack

Next.js (App Router) · React · TypeScript · PostgreSQL · Drizzle ORM · Better Auth · Zod · React Hook Form · Tailwind + shadcn/ui · TanStack Table · Recharts · S3-compatible storage.

## Status

Planning complete. Implementation starts with the scaffold PR (D1-00). See the team plan.
