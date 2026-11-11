# Automora Company Management System

Internal operations platform for Automora Tech Solutions LLP: employees, clients, projects, tasks, and operational finance.

Repository: https://github.com/HardzGuardian/Automora-Management-System

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

## Getting started

Requirements: Node 22+, pnpm, PostgreSQL 17+ (Docker Compose provides it, or use a local install).

```bash
pnpm install
cp .env.example .env            # then edit DATABASE_URL, BETTER_AUTH_SECRET (32+ chars), SEED_ADMIN_EMAIL
docker compose up -d            # PostgreSQL, MinIO, Mailpit  (skip if you run your own PostgreSQL)
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # company, permissions, system roles, Super Admin invitation
pnpm dev                        # http://localhost:3000
```

`db:seed` prints a one-time **accept-invite link** for `SEED_ADMIN_EMAIL` (and emails it through Mailpit when it is running). Open the link, choose a password, then sign in. There is no hard-coded admin password. Set `SEED_DEMO=true` to also create labelled `[DEMO]` employees, clients, projects and tasks.

Tests run against a **real PostgreSQL** (no mocks). Create an empty database, put its URL in `TEST_DATABASE_URL`, then:

```bash
pnpm test         # resets the test database, applies migrations, runs everything
pnpm lint && pnpm typecheck && pnpm build
```

| Script | What it does |
|---|---|
| `pnpm db:generate` | generate a migration from `src/db/schema` (commit it; never edit merged migrations) |
| `pnpm db:migrate` / `pnpm db:seed` | apply migrations / idempotent seed |
| `pnpm test` | Vitest, including the 110-case security suite and the 10k-task performance suite |

Uploads use the local filesystem driver by default (`STORAGE_DRIVER=local`, `.data/uploads`); set `STORAGE_DRIVER=s3` plus the `S3_*` variables for MinIO/S3.

## Authentication and sessions

- **Better Auth** handles identity and sessions only (email + password, database-backed sessions, HttpOnly SameSite=Lax cookies, built-in rate limits on sign-in and password reset).
- **No public sign-up.** Users are created by **invitation**: an admin invites an employee (`users.invite`), the link carries a single-use token (stored hashed, valid 7 days), and accepting it sets the password and links the employee record.
- **Forgot/reset password:** same response for unknown emails, 1-hour single-use token, all other sessions are revoked on reset.
- **Suspension** = `user.banned`. Deactivating or suspending an employee bans the account and deletes its sessions; `loadActor()` also rejects banned users, so a stale session is never enough.
- `proxy.ts` is only an optimistic redirect. The real checks are `getActor()` plus the service-level permission and scope checks.

## Roles and permissions (RBAC)

- Two mandatory layers: **capability** (`can(actor, "tasks.assign")`, deny by default) and **record scope** (`taskScope`, `projectScope`, `clientScope` are SQL conditions applied inside queries).
- The permission catalogue is `src/lib/permissions/catalog.ts` (changes need all three developers' review). Default roles (Super Admin, Manager, Employee) are in `roles.ts` and seeded; roles and their permission sets are editable through `modules/auth` (`createRole`, `setRolePermissions`, `assignRole`). The Super Admin role is immutable and the last Super Admin cannot be removed or deactivated.
- A record outside the actor's scope is reported as **NOT_FOUND**, never FORBIDDEN, so existence is not revealed.
- Every service function takes the `Actor` first. Pages and actions contain no business rules.

## Employees, clients, projects, tasks (Developer 1 modules)

| Module | Highlights |
|---|---|
| `modules/employees` | CRUD, directory search/filter/paginate, workload (open / in progress / overdue / completed in period), deactivate / suspend / reactivate, `assertAssignable` |
| `modules/clients` | CRUD, archive (never delete; projects and tasks stay), notes |
| `modules/projects` | Client vs Internal rule, status machine, members and owner transfer, milestones, progress (completed ÷ non-archived tasks, floored) |
| `modules/tasks` | CRUD, multiple assignees, status machine, comments, attachments, activity history, list/board/calendar, bulk actions |
| `modules/search` | Global search over what the actor may already open |

**Task rules.** Statuses: Pending → In Progress → In Review → Completed (and Completed → In Progress to reopen). Assignees with `tasks.status.update.own` can move their own task between Pending / In Progress / In Review; **completing and reopening need `tasks.update`**. Transitions are compare-and-set (`WHERE status = :expected`), so of several concurrent identical changes exactly one wins and the rest get CONFLICT. A task's client must equal its project's client. Every change writes `task_activity_logs` in the same transaction.

**Dates.** "Today" is company-local (`todayInTz`). The single overdue rule lives in `src/lib/dates`: due date before today, not completed, not archived (`isOverdue` / `overdueCondition`). Reports and dashboards must reuse it.

**Files.** Private storage; keys are server-generated (`<companyId>/<uuid>`); uploads must match an allowlisted extension, MIME type **and** file signature (10 MB; pdf, png, jpg, docx, xlsx, csv, txt). Downloads go through `/api/files/[id]`, which asks the owning module whether the actor can see the parent record. Finance adds its checker there.

Performance baselines at 10k tasks are in [docs/09-query-performance.md](docs/09-query-performance.md).

## Status

Developer 1 scope (D1-00 … D1-34) is implemented except **D1-30** (finance tabs on client/project pages), which is blocked on `@/modules/finance` summaries from Developer 2. See [docs/progress.md](docs/progress.md).
