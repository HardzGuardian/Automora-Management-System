# Developer 1 (Sagar) — Sprint 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the scaffold, database baseline, authentication, foundation libraries and seed so Chintan and Shubhangi are unblocked and Sprint 2 (access + employees) can start.

**Architecture:** One Next.js App Router app, modular monolith. Business rules live in `src/modules/*/service.ts`; every service takes an `Actor` first and checks permission + record scope. Better Auth handles identity/sessions only; RBAC and scope are our own code. All tenant tables carry `company_id` with composite FKs.

**Tech Stack:** Next.js (current stable, `proxy.ts`), TypeScript strict, pnpm, PostgreSQL + Drizzle (drizzle-kit migrations), Better Auth (pinned exact version), Zod, Vitest (real Postgres), Docker Compose (Postgres, MinIO, Mailpit), GitHub Actions.

**Spec:** `docs/03-dev1-sagar.md` (tasks D1-00…D1-04), `docs/00-architecture.md`, `docs/02-contracts.md`, `docs/07-file-architecture.md`, `docs/08-data-model.md`, `docs/06-workflow.md`.

## Global Constraints

- No `any`; `tsc --noEmit` strict must pass; no `console.log`; no unused imports.
- No dependency outside ADR-14 without justification in the PR; pin Better Auth to an exact version.
- `company_id` comes from the session only, never from input.
- Only `src/lib/env.ts` reads `process.env`.
- `server-only` on `modules/`, `db/`, `lib/auth`, `lib/storage`.
- Money `NUMERIC(14,2)`; timestamps `timestamptz`; business dates `date`.
- Out-of-scope record → `NOT_FOUND`, never `FORBIDDEN`.
- Migrations generated with `drizzle-kit generate`, committed, never hand-edited; no `push`.
- Audit rows are written in the same transaction as the change; redact `password`, `token`, `secret` keys.
- Conventional commits; one task ID per PR/branch (`sagar/d1-xx-slug`); PR < ~500 lines excl. migrations/lockfile.
- No hard-coded production password; Super Admin created by invitation.
- Tailwind utilities only — no invented CSS classes (Shubhangi owns `components/`; D1 pages stay bare until her kit lands).

## Review Focus

- Suspended user with a live session cookie → must be rejected on next `getActor()` (test in D1-02/D1-03).
- Permission set empty (new role) → `can()` false for every key (deny-by-default test, D1-03).
- Two concurrent `nextCode` calls for the same kind → distinct codes (D1-03).
- Cross-company FK insert (task in company A pointing at project of company B) → DB error (D1-01).
- Audit payload containing `password`/`token` keys → stripped; `UPDATE`/`DELETE` on audit tables rejected (D1-03).

---

## File Structure (Sprint 1)

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `drizzle.config.ts` | tooling |
| `docker-compose.yml`, `.env.example` | local Postgres/MinIO/Mailpit, all env vars |
| `.github/workflows/ci.yml`, `pull_request_template.md`, `CODEOWNERS` | CI + review rules (CODEOWNERS block from `07-file-architecture.md` §4) |
| `src/lib/env.ts` | Zod-validated env |
| `src/db/index.ts` | `db`, `withTransaction` |
| `src/db/schema/{company,auth,rbac,employees,clients,projects,tasks,files,audit,index}.ts` | tables |
| `src/lib/auth/{auth,auth-client,actor,session}.ts` | Better Auth config + `getActor` |
| `src/lib/permissions/{catalog,roles,can,require,scope}.ts` | RBAC |
| `src/lib/errors/{domain-error,to-action-result}.ts` | errors |
| `src/lib/codes/next-code.ts` | code sequences |
| `src/modules/audit/{record,redact,queries,index}.ts` | audit |
| `src/db/seed.ts` | company, permissions, system roles, demo data, Super Admin invitation |
| `src/test/{setup,factories,actors}.ts` | test DB + factories |
| `src/app/(auth)/login/page.tsx`, `src/app/api/auth/[...all]/route.ts`, `proxy.ts` | login + optimistic redirect |

---

### Task 1: D1-00 Scaffold

**Files:**
- Create: everything in the tooling/CI rows above, `src/lib/env.ts`, empty folder skeleton (add `.gitkeep` only where a folder is needed by an import rule), `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `env: { DATABASE_URL: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; APP_URL: string; S3_*: string; EMAIL_FROM: string; SMTP_URL: string; CRON_SECRET: string; SEED_DEMO: boolean; UPLOAD_MAX_BYTES: number }` from `@/lib/env`; path alias `@/*` → `src/*`; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed`.

- [ ] **Step 1: Write failing test** `env.test.ts`: `parseEnv({})` throws listing missing `DATABASE_URL`; `parseEnv(valid).SEED_DEMO === false` when unset; `"true"` → `true`; `UPLOAD_MAX_BYTES` defaults `10485760`.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/env.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3:** `pnpm create next-app` (TS, App Router, Tailwind, `src/`, pnpm, no Turbopack flags beyond default) in repo root without overwriting `docs/`/`.git`; enable `strict`; add Prettier, Vitest, Drizzle, Zod, `server-only`. Implement `parseEnv(raw: Record<string,string|undefined>)` and exported `env` in `src/lib/env.ts` per Interfaces.
- [ ] **Step 4:** `docker-compose.yml` with `postgres` (db `automora`, plus `automora_test`), `minio`, `mailpit`; `.env.example` listing every variable from `02-contracts.md` §7.
- [ ] **Step 5:** ESLint flat config with `no-restricted-imports` implementing the 5 rules in `07-file-architecture.md` §6 (app/components can't import `@/db`; modules only via `index.ts`; components can't import modules; only `env.ts` may reference `process.env` via `no-restricted-properties`).
- [ ] **Step 6:** `.github/workflows/ci.yml`: Postgres service → `pnpm i --frozen-lockfile` → lint → typecheck → test → build. Add `pull_request_template.md` (DoD checklist from `06-workflow.md`) and `CODEOWNERS` (block from `07-file-architecture.md` §4).
- [ ] **Step 7: Verify** — `pnpm i && docker compose up -d && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0; `pnpm dev` serves `/`.
- [ ] **Step 8: Commit** `chore: scaffold next.js app, tooling, docker, ci` on `sagar/d1-00-scaffold`. **Open PR and merge within 1–2 days; mark D1-00 in `docs/progress.md`.**

---

### Task 2: D1-01 DB baseline

**Files:**
- Create: `src/db/index.ts`, `src/db/schema/*.ts` (company, auth, rbac, employees, clients, projects, tasks, files, audit, index), first migration in `src/db/migrations/`, `src/test/setup.ts` (migrate `automora_test` once, truncate between tests)
- Test: `src/db/schema/constraints.test.ts`

**Interfaces:**
- Consumes: `env.DATABASE_URL`.
- Produces: `db` (Drizzle client), `withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>`, `type Tx`; all tables exported from `@/db/schema` named per `08-data-model.md` / `02-contracts.md` §1 (e.g. `companies`, `companySettings`, `codeSequences`, `users` (Better Auth), `invitations`, `roles`, `permissions`, `rolePermissions`, `userRoles`, `employees`, `clients`, `clientNotes`, `projects`, `projectMembers`, `projectMilestones`, `tasks`, `taskAssignees`, `taskComments`, `taskAttachments`, `taskActivityLogs`, `files`, `activityLogs`).

- [ ] **Step 1: Write failing tests** in `constraints.test.ts` (real DB), one per constraint:
  - task in company A with `project_id` of a company-B project → rejects (composite FK).
  - duplicate `task_code` in same company → rejects; same code in different company → ok.
  - `Client` project with null `client_id` → rejects (CHECK); `Internal` project with null → ok.
  - task `start_date > due_date` → rejects; project likewise.
  - `UNIQUE (company_id, employee_code)` and for client/project/task codes.
- [ ] **Step 2: Run** `pnpm vitest run src/db` — Expected: FAIL.
- [ ] **Step 3:** Generate Better Auth schema with its CLI into `auth.ts` (map `user` as the blueprint `users`; add `status`, `last_login_at`, `company_id`); add `invitations` (`company_id, email, employee_id, role_id, token_hash, expires_at, used_at, created_by`). Define remaining tables with `company_id NOT NULL`, `UNIQUE (id, company_id)` on parents, composite FKs on children, status enums as `text + CHECK` with TS `as const` lists, indexes from `08-data-model.md` ("Key constraints"). Task status list: `Pending, In Progress, In Review, Completed` (Blocked excluded per open decision #10); priority `Low, Medium, High, Urgent` (**my guess — confirm against blueprint §4.5**).
- [ ] **Step 4:** `db:generate`; inspect the SQL once; commit it. `withTransaction` wraps `db.transaction`.
- [ ] **Step 5: Run** tests — Expected: PASS (migration applies on empty DB).
- [ ] **Step 6: Commit** `feat(db): baseline schema and constraints` (branch `sagar/d1-01-db-baseline`).

---

### Task 3: D1-03a Errors, codes, permissions catalogue (pure + DB-light)

Done before auth so unit-testable pieces exist early.

**Files:**
- Create: `src/lib/errors/{domain-error,to-action-result}.ts`, `src/lib/codes/next-code.ts`, `src/lib/permissions/{catalog,roles,can,require}.ts`
- Test: `errors.test.ts`, `next-code.test.ts` (DB), `can.test.ts`

**Interfaces:**
- Produces:
  - `class DomainError extends Error { code: ErrorCode; details?: unknown }`; `type ErrorCode = "UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"VALIDATION"|"CONFLICT"|"INTERNAL"`; `toActionResult<T>(fn: () => Promise<T>): Promise<{ok:true;data:T}|{ok:false;error:{code:ErrorCode;message:string;fieldErrors?:Record<string,string[]>}}>` (maps `ZodError` → `VALIDATION` with fieldErrors; unknown errors → `INTERNAL` with generic message, no stack).
  - `nextCode(tx: Tx, companyId: string, kind: CodeKind): Promise<string>`, `CodeKind = "TSK"|"PRJ"|"CLI"|"EMP"|"INV"|"EXP"`; format `TSK-000123`; implemented with `INSERT … ON CONFLICT DO UPDATE SET next_value = next_value + 1 RETURNING`.
  - `PERMISSIONS` (const object from the v1 catalogue in `02-contracts.md` §2, every key), `type PermissionKey`, `SYSTEM_ROLES` with default sets (Super Admin = all; Manager/Employee per table), `can(actor, key): boolean`, `requirePermission(actor, key): void` (throws `FORBIDDEN`).
  - `type Actor = { userId; companyId; employeeId: string|null; roles: string[]; permissions: ReadonlySet<PermissionKey>; timezone: string }` (exported from `@/lib/auth/actor`, declared here as a type-only file to avoid a cycle).

- [ ] **Step 1: Write failing tests:** `DomainError("NOT_FOUND")` mapped correctly; ZodError → fieldErrors; 50 parallel `nextCode(…,"TSK")` in separate transactions return 50 distinct values with no gaps; first code is `TSK-000001`; `can()` is false for an empty permission set for every key in `PERMISSIONS` (deny-by-default); `requirePermission` throws `FORBIDDEN`; Manager default set contains no key starting `finance.` and no `users.`/`roles.`; Super Admin contains every key.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(foundation): errors, codes, permission catalogue`.

---

### Task 4: D1-02 Better Auth login/logout

**Files:**
- Create: `src/lib/auth/{auth,auth-client,session}.ts`, `src/app/api/auth/[...all]/route.ts`, `proxy.ts`, `src/app/(auth)/login/page.tsx` (bare form, server action), `src/lib/email/send.ts` (SMTP via `env.SMTP_URL`, used by later tasks)
- Test: `src/lib/auth/auth.test.ts`

**Interfaces:**
- Consumes: schema from Task 2, `env`.
- Produces: `auth` (Better Auth instance: email+password enabled, sign-up disabled, `revokeSessionsOnPasswordReset: true`, ban plugin, built-in rate limiting on sign-in, cookies HttpOnly/SameSite=Lax/Secure in production); `getSession(headers): Promise<Session|null>`.

- [ ] **Step 1: Write failing tests:** valid credentials create a session; wrong password fails; a **banned/suspended** user cannot sign in; banning a user with an existing session invalidates that session on next `getSession`; public sign-up endpoint is rejected; 6th rapid failed login is rate limited.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `auth.ts` with Drizzle adapter (confirm option names via Context7 for the pinned version before coding). `proxy.ts` redirects unauthenticated requests to `/login` for `(workspace)` routes only — comment that it is not a security boundary.
- [ ] **Step 4: Run** — Expected: PASS. Manually verify login + logout in browser against dev server.
- [ ] **Step 5: Commit** `feat(auth): better auth login/logout, rate limit, proxy redirect`.

---

### Task 5: D1-03b Actor, scope, audit

**Files:**
- Create: `src/lib/auth/actor.ts`, `src/lib/permissions/scope.ts`, `src/modules/audit/{record,redact,queries,index}.ts`, audit append-only migration (trigger rejecting UPDATE/DELETE on `activity_logs` and `task_activity_logs`; generated empty migration via `drizzle-kit generate --custom`), `src/test/{factories,actors}.ts`
- Test: `actor.test.ts`, `scope.test.ts`, `audit.test.ts`

**Interfaces:**
- Produces:
  - `getActor(): Promise<Actor>` — reads session from `next/headers`, loads roles + permissions + company timezone, throws `UNAUTHENTICATED` when no session, `FORBIDDEN` when user is suspended/banned. Also `loadActor(userId: string): Promise<Actor>` for tests/services.
  - `taskScope(actor): SQL`, `projectScope(actor): SQL`, `clientScope(actor): SQL` — Drizzle conditions always including `company_id = actor.companyId`; with `tasks.read.all` / `projects.read.all` / `clients.read` → company-wide; otherwise tasks where actor is assignee or member of the task's project, projects where actor is member, clients none-visible (`sql\`false\``) unless `clients.read`.
  - `audit.record(tx: Tx, e: { actor: Actor; entity: string; entityId: string; action: string; before?: unknown; after?: unknown }): Promise<void>`; `redact(value: unknown): unknown` strips keys matching `/pass(word)?|token|secret|hash|credential/i` recursively.
  - Test factories: `createCompany()`, `createUser({companyId, roles?})`, `createEmployee`, `createProject`, `createTask`, `actorFor(user)`.

- [ ] **Step 1: Write failing tests:**
  - `loadActor` for suspended user throws `FORBIDDEN`; for unknown user `UNAUTHENTICATED`.
  - employee A cannot see employee B's unassigned task via `taskScope`; sees tasks where assigned; sees tasks of projects they are a member of; manager sees all in own company; **never** another company's.
  - `redact({password:"x", nested:{apiToken:"y", ok:1}})` → only `ok` survives; `audit.record` stores redacted JSON.
  - audit row rolls back when the surrounding transaction throws.
  - raw `UPDATE`/`DELETE` on `activity_logs` throws.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces. Scope returns conditions only (no fetching).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Document** the final signatures in `docs/02-contracts.md` §4 (replace "proposed" wording), ping Chintan and Shubhangi in the team channel that Sprint 1 foundation is merged.
- [ ] **Step 6: Commit** `feat(foundation): actor, scope helpers, audit`.

---

### Task 6: D1-04 Seed

**Files:**
- Create: `src/db/seed.ts`, `src/db/seed-demo.ts`
- Test: `src/db/seed.test.ts`

**Interfaces:**
- Consumes: `PERMISSIONS`, `SYSTEM_ROLES`, `nextCode`, `invitations`, `sendEmail`.
- Produces: `runSeed(opts: { demo: boolean; adminEmail: string }): Promise<void>` — idempotent: creates company + settings (currency `INR`, timezone `Asia/Kolkata` — **my default, confirm**), all permission rows, system roles with default permissions, a Super Admin **invitation** (hashed single-use token, 7-day expiry; raw accept link printed to stdout and emailed via Mailpit), and, only if `demo`, labelled demo employees/clients/projects/tasks. `pnpm db:seed` reads `SEED_DEMO` and `SEED_ADMIN_EMAIL` (add to `.env.example` and `env.ts`).

- [ ] **Step 1: Write failing tests:** running the seed twice yields no duplicates; Super Admin role has every permission key; Employee role has exactly its 5 keys; no user exists after a non-demo seed, only an invitation whose stored value is a hash (≠ the emailed token); demo data absent unless `demo: true`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** with upsert semantics; token = 32 random bytes base64url, store SHA-256.
- [ ] **Step 4: Run** — Expected: PASS. Manual check: fresh DB → `pnpm db:migrate && pnpm db:seed` → invitation link logged (accept-invite page is D1-05; verification of full login completes in Sprint 2).
- [ ] **Step 5: Commit**, tick D1-00…D1-04 in `docs/progress.md`, add the Better Auth confirmation row status in `docs/decisions.md`.

---

## Roadmap (separate plans, written when each sprint starts)

| Sprint | Tasks | Notes |
|---|---|---|
| 2 | D1-05…D1-11 invitations, reset, roles API, employee CRUD/detail, deactivate, my account | AC-01 |
| 3 | D1-12…D1-17 clients, projects, members, milestones, progress | AC-04 partial, AC-13 partial |
| 4 | D1-18…D1-24 tasks, assignees, status machine, `lib/dates`, activity, lists, pages | AC-02/05/06/07. `lib/dates` is needed by Shubhangi by Sprint 2 end — pull D1-21 forward if she asks |
| 5 | D1-25…D1-29 storage, comments, attachments, board/calendar, bulk | |
| 6–9 | D1-30…D1-34 finance tabs, query perf, security suite, search, UAT | AC-03 |

## Self-Review

- **Spec coverage:** D1-00 → Task 1; D1-01 → Task 2; D1-02 → Task 4; D1-03 → Tasks 3 + 5 (`getActor`, catalogue, `can/requirePermission`, `scope`, `audit.record` + redaction + append-only, `DomainError`, `nextCode`, `withTransaction` in Task 2); D1-04 → Task 6. D1-02's "disabled-user rejection" tested in Tasks 4 and 5.
- **Type consistency:** `Actor`, `Tx`, `PermissionKey`, `CodeKind`, `ErrorCode` defined once (Tasks 2–3) and reused.
- **Review Focus** items each map to a test above.
- **Open items I assumed (my calls, not the docs'):** task priority list, default timezone/currency, `SEED_ADMIN_EMAIL` variable, ordering Task 3 before Task 4.
