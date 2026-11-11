# Architecture and Decisions

Status: **Proposed — needs team sign-off before D1-00 starts.** Items marked ⚠ need an owner decision (see "Open decisions" at the end).

The blueprint fixes the direction: Next.js + TypeScript + PostgreSQL + Drizzle, a modular monolith. This document turns that into concrete, enforceable decisions so three developers can work in parallel without colliding.

## 1. Shape of the system

One Next.js app. No separate backend service, no microservices.

```
Browser
  │
  ▼
proxy.ts            optimistic redirect only (is there a session cookie?). NOT a security boundary.
  │
  ▼
app/(…)/page.tsx    Server Components read data through module services
app/**/actions.ts   Server Actions: thin. parse input (Zod) → getActor() → call service → revalidate
app/api/**/route.ts Route Handlers: same shape; used for file download, exports, cron, webhooks
  │
  ▼
modules/<name>/service.ts     ALL business rules, permission checks, transactions live here
modules/<name>/queries.ts     read models (scoped SQL)
(table definitions live in src/db/schema/, not in modules — see §4)
  │
  ▼
db (Drizzle) → PostgreSQL        storage (S3-compatible) → private bucket
```

Rules that follow from this:

1. **Pages and actions contain no business logic.** If you are writing an `if` about money, permissions or status transitions outside `modules/*/service.ts`, move it.
2. **Every service function takes `actor` as its first argument** and checks permission + record scope itself. Hiding a button is never security.
3. **`server-only` on everything in `modules/`, `db/`, `lib/auth`, `lib/storage`.** The client bundle never imports them. (Next.js guidance: a server-only Data Access Layer that authorises and returns minimal DTOs.)
4. **Services return DTOs, not raw rows.** Never return `password_hash`, storage keys, or fields the actor may not see.

## 2. Decisions (ADR summary)

### ADR-01 — Modular monolith, one repo, one deployable
Matches blueprint §8.2. Cross-module calls go through the other module's exported service/query functions, never by reaching into its tables from a different module — **except** read-only reporting queries in `modules/reports` (see ADR-10).

### ADR-02 — Authentication: Better Auth (not Auth.js) ⚠ confirm
- Blueprint requires **revocable sessions**, disabled-user handling, single-use reset tokens, rate limiting. Better Auth gives database-backed sessions, `revokeSessionsOnPasswordReset`, ban/unban (which revokes sessions), and a Drizzle adapter.
- Auth.js was taken over by the Better Auth team and is in maintenance mode; starting a new project on it is a poor bet. Its Credentials provider is also JWT-oriented, which makes revocation harder.
- We use Better Auth for **identity and sessions only**. Authorisation (roles, permissions, record scope) is **our own** code (ADR-03) because the blueprint requires company-scoped role/permission tables and finance permissions that are "configurable" per manager.
- Better Auth's `user` table is the blueprint's `users` table. `employees.user_id` links to it.
- Invitations are our own table (`invitations`: token hash, email, role, expires_at, used_at). Accepting an invitation creates the Better Auth user with a chosen password and links the employee.
- Pin an exact version. Check the Better Auth changelog before upgrading.
- Fallback if rejected: Auth.js JWT + a `session_version` column checked on every request. Costs more custom code; not recommended.

### ADR-03 — RBAC: permission keys, deny-by-default, plus record scope
Two layers, both mandatory:

1. **Capability** — `can(actor, "tasks.assign")`. Role → permission-key mapping stored in `roles` / `role_permissions` / `user_roles` (company-scoped). A role with no rows has no permissions.
2. **Record scope** — even with a capability, queries are filtered to what the actor may see:
   - Employee: tasks where they are an assignee, or tasks of projects where they are a member; projects where they are a member.
   - Manager/Admin: whole company.
   - Finance: capability only; employees never reach finance modules.
   Scope is applied **inside the SQL** (a `scope` helper returning a Drizzle condition), not by filtering after fetch.

The permission-key catalogue lives in `src/lib/permissions/catalog.ts` (see `02-contracts.md`). It is seeded into the database. Changing it requires a PR reviewed by all three developers.

### ADR-04 — Multi-tenancy-ready, single company at launch
- `company_id` on every tenant-owned table, `NOT NULL`.
- **`company_id` comes from the session only** — never from request bodies, query strings or form fields.
- Cross-company integrity: parent tables get `UNIQUE (id, company_id)`; child tables use a composite FK `(parent_id, company_id)`. This makes a cross-company reference a database error, not a code review item.
- PostgreSQL Row Level Security: **deferred** (blueprint says additional defence, not replacement). Revisit after V1.

### ADR-05 — Money
- Stored as `NUMERIC(14,2)`. Never `float`.
- Drizzle returns `numeric` as a string. **Do all arithmetic on integer minor units** (paise) via `lib/money`, then format back to two decimals. No floating-point math on currency anywhere.
- A single rounding rule (half-up to 2 dp) lives in `lib/money` and nowhere else. Owner: Chintan. Everyone else imports it.
- Positive-only amounts via `CHECK (amount > 0)`. Reversals are new rows/flags, never negative amounts or in-place edits.

### ADR-06 — Time
- Event timestamps: `timestamptz` (UTC). Business dates (due date, invoice date): `date`.
- "Today" is **company-local** (`company_settings.timezone`). `lib/dates` exports `todayInTz(tz)` and the **single overdue predicate** `isOverdue(task, today)`; SQL equivalent `overdueCondition(today)`. Dashboards, reports and notifications must use these, never re-implement it. Owner: Sagar.
- Overdue is derived, never stored as a status.

### ADR-07 — Human-readable codes
`TSK-000123`, `PRJ-…`, `CLI-…`, `EMP-…`, `INV-…`, `EXP-…` come from a `code_sequences` table (`company_id, kind, next_value`) incremented with `UPDATE … RETURNING` inside the creating transaction. **Never `MAX(code)+1`** (races create duplicates). One helper, `nextCode(tx, companyId, kind)`, shared by all modules. Invoice numbering format is a business decision (⚠ open) but still uses this helper.

### ADR-08 — Files
- Private S3-compatible bucket. DB stores metadata + a **server-generated** object key (never a user-supplied filename in the key).
- One shared module `lib/storage` + `files` table. Task attachments (Sagar) and finance receipts/bills (Chintan) both use it; `files` rows are linked to their parent via module-specific link tables (`task_attachments`, `expense_attachments`, …).
- Downloads go through a Route Handler that (1) authenticates, (2) loads the parent record **with the actor's scope**, (3) only then issues a short-lived signed URL. Hard-to-guess URLs are not authorisation.
- Upload limits and a file-type allowlist are enforced server-side. Local dev uses MinIO via docker compose.

### ADR-09 — Audit and activity
- `activity_logs` (cross-module audit) and `task_activity_logs` (task history) are **append-only**: the application DB role has `INSERT, SELECT` only on them; a trigger also rejects `UPDATE/DELETE`.
- Audit writes happen **in the same transaction** as the change (`audit.record(tx, {...})`). If the change rolls back, so does the audit row.
- Never put passwords, tokens or payment credentials in `before/after` JSON. The audit helper strips a deny-list of keys.

### ADR-10 — Reads for dashboards and reports
`modules/reports` (Shubhangi) may query across tables for aggregation, but must:
- accept the `actor` and apply the same scope helpers,
- use `isOverdue`/`overdueCondition` and the money helpers,
- be covered by a **reconciliation test** (AC-12): report totals equal the sum of source records for the same filter.

### ADR-11 — Notifications
`notify(...)` is called **after** the main transaction commits. A failed notification never rolls back a task or payment (blueprint §10.1). Scheduled reminders (due soon / overdue / invoice due) run from a secured cron Route Handler and use stable event keys (`task:{id}:overdue:{date}`) with a unique index to deduplicate. Email is out of V1 unless a provider is chosen (⚠ open).

### ADR-12 — Errors and validation
- All inputs validated with Zod at the action/route boundary **and** re-validated in the service for anything callable from elsewhere.
- Services throw `DomainError(code, message, details?)`. Actions convert to `{ ok:false, error:{code,message,fieldErrors?} }`. Stack traces, SQL and secrets never leave the server.
- Success UI only after the server confirms; no optimistic updates for financial actions.

### ADR-13 — Idempotency (finance)
Mutations that create money records accept an `idempotency_key` (client generates a UUID when the form opens). Unique index `(company_id, idempotency_key)`; a repeat returns the original result. Owner: Chintan; the table/helper is in his module.

### ADR-14 — Tooling (propose, approve once)
| Concern | Choice |
|---|---|
| Runtime / package manager | Node LTS, **pnpm** |
| Framework | Next.js (current stable, App Router), `proxy.ts` instead of `middleware.ts` |
| Lint / format | ESLint + Prettier, `tsc --noEmit` (strict, no `any`) |
| Unit/integration tests | **Vitest**; integration tests run against a real PostgreSQL (docker compose), never mocks of the DB |
| E2E | **Playwright** (desktop + mobile viewports) |
| Local services | `docker-compose.yml`: PostgreSQL, MinIO, Mailpit (dev email) |
| CI | GitHub Actions: install → lint → typecheck → unit/integration (Postgres service) → build. E2E on PRs to `main` when stable |
| PDF | Chintan to choose (server-side render; candidates: `@react-pdf/renderer`, or HTML→PDF) — decision in his plan |
| XLSX | Shubhangi to choose (e.g. `exceljs`) — decision in her plan |

New dependencies beyond this table need agreement in the PR description.

## 3. Folder structure (blueprint §8.3, tightened)

```
src/
  app/
    (auth)/login, forgot-password, reset-password, accept-invite
    (workspace)/dashboard, my-tasks, tasks, projects, employees, clients,
                invoices, payments, expenses, reports, notifications, settings
    api/            files/[id], exports/*, cron/*, auth/[...all]
  modules/
    auth/ employees/ clients/ projects/ tasks/      ← Sagar
    finance/ (invoices, payments, expenses, reports) ← Chintan
    notifications/ reports/ settings?                 ← Shubhangi
    audit/                                            ← Sagar (shared)
    each module:  service.ts  queries.ts  schemas.ts (Zod)  types.ts  index.ts (public API)  *.test.ts
  components/
    ui/ (shadcn)  layout/  data-table/  forms/  dashboard/   ← Shubhangi owns; feature components live next to their module's pages
  db/
    schema/  (one file per module area; index.ts re-exports)   migrations/  seed.ts
  lib/
    auth/  permissions/  validation/  storage/  dates/  money/  errors/  codes/
  types/
```

`modules/<x>/index.ts` is the module's **public API**. Other modules import only from there.

## 4. Schema and migrations
- Drizzle schema files under `src/db/schema/`, split by area, re-exported from `index.ts`. **Each file has one owner** (see `02-contracts.md`).
- Migrations are generated (`drizzle-kit generate`) and committed. No `push` against shared databases. No hand-edited production schema.
- Migration conflicts: if two PRs add a migration, the second to merge rebases, **deletes its generated migration, and regenerates** on top of `main`. Never hand-merge migration files.
- Seed (`db/seed.ts`): company, system roles, permission keys, default expense categories, and labelled demo data **only when `SEED_DEMO=true`**. The Super Admin is created by invitation; no hard-coded production password.

## 5. Security baseline (applies to all three)
- HttpOnly, SameSite=Lax, Secure-in-production cookies; rate-limit login/reset/invite endpoints.
- Argon2id/bcrypt handled by Better Auth; we never touch raw passwords.
- Reset/invite tokens: single-use, short-lived, stored hashed.
- Every list/detail/file endpoint is covered by an automated IDOR test (employee A cannot read employee B's task; employee cannot read any finance record or attachment).
- Secrets only in environment variables; `.env*` git-ignored; `.env.example` maintained.
- Security headers (CSP, frame-ancestors, etc.) configured once in `next.config` — Shubhangi.

## 6. Deployment (not decided by the blueprint)
Blueprint allows a Linux VPS or a managed platform. Whichever is chosen, the app must run from a `Dockerfile`, read config from env vars, and use an external PostgreSQL and object store. If it ends up on a serverless platform: no writing to the local filesystem outside `/tmp`, and long exports/reminders need background execution. ⚠ hosting open.

## 7. Open decisions (owner must answer; none block the scaffold)

| # | Decision | Needed by | Default if unanswered |
|---|----------|-----------|----------------------|
| 1 | Confirm Better Auth (ADR-02) | before D1-01 | Better Auth |
| 2 | Hosting + managed Postgres + object storage provider | Sprint 5 (files) / Sprint 9 | MinIO locally; S3-compatible interface |
| 3 | Email provider for invites/resets | Sprint 2 | Mailpit (dev), console log in staging |
| 4 | Invoice numbering format; credit notes/refunds in V1? | Sprint 6 | `INV-YYYY-000001`; no credit notes in V1 |
| 5 | GST/tax rules (inclusive/exclusive, rounding, legal fields) — accountant | Sprint 6 | Exclusive, per-line tax rate, half-up 2 dp |
| 6 | Can managers see finance / issue invoices / record receipts / approve expenses | Sprint 2 (role seed) | No finance access for managers |
| 7 | Expense approval workflow vs direct recording | Sprint 7 | Direct recording by permitted users |
| 8 | Payment methods + required reference fields | Sprint 6 | bank transfer, UPI, cash, card, other; reference required except cash |
| 9 | File type/size limits | Sprint 5 | 10 MB; pdf, png, jpg, docx, xlsx, csv, txt |
| 10 | Blocked task status in V1? | Sprint 4 | Not included |
| 11 | Backup retention, RPO/RTO | Sprint 9 | daily 14d / weekly 8w / monthly 12m |
