# Shared Contracts

Everything two developers both touch is defined here. If code and this document disagree, fix one in a PR — don't let them drift.

## 1. Table and file ownership

One owner per schema file. Others may add a foreign key to it but changes to the table go through the owner's PR review.

| Schema file (`src/db/schema/`) | Tables | Owner |
|---|---|---|
| `company.ts` | companies, company_settings, code_sequences | Sagar |
| `auth.ts` | user, session, account, verification (Better Auth, generated), invitations | Sagar |
| `rbac.ts` | roles, permissions, role_permissions, user_roles | Sagar |
| `employees.ts` | employees | Sagar |
| `clients.ts` | clients, client_notes | Sagar |
| `projects.ts` | projects, project_members, project_milestones | Sagar |
| `tasks.ts` | tasks, task_assignees, task_comments, task_attachments, task_activity_logs | Sagar |
| `files.ts` | files | Sagar |
| `audit.ts` | activity_logs | Sagar |
| `finance.ts` | invoices, invoice_items, payments, payment_allocations, expense_categories, expenses, expense_payments, expense_attachments, idempotency_keys | Chintan |
| `notifications.ts` | notifications, notification_events (dedupe keys) | Shubhangi |

Code ownership: `modules/<x>` is owned by the developer named in the architecture doc; `lib/auth`, `lib/permissions`, `lib/dates`, `lib/storage`, `lib/codes`, `lib/errors` → Sagar; `lib/money`, `lib/idempotency` → Chintan; `components/*`, `lib/export` → Shubhangi.

Notes on tables not in the blueprint's §6.3 list but required by its rules:
`invitations` (invite flow), `code_sequences` (ADR-07), `client_notes` (client notes), `payment_allocations` (§4.6 "allocation"; lets one receipt cover several invoices later; V1 may allocate to one invoice), `idempotency_keys` (§8.4), `notification_events` (dedupe).

## 2. Permission catalogue v1

Format `area.resource.action`. Defined in `src/lib/permissions/catalog.ts`, seeded to `permissions`. **Deny by default.**

**Workspace / system**
`users.read` `users.invite` `users.suspend` `roles.read` `roles.manage` · `settings.read` `settings.manage` · `audit.read`
`dashboard.company.read` (admin full) · `dashboard.operational.read` (manager) · `dashboard.personal.read`
`reports.all.read` `reports.limited.read` `reports.personal.read` · `reports.export`

**People and work**
`employees.read` `employees.create` `employees.update` `employees.deactivate` `employees.workload.read`
`clients.read` `clients.create` `clients.update` `clients.archive`
`projects.read.all` `projects.create` `projects.update` `projects.archive` `projects.members.manage` `projects.milestones.manage`
`tasks.read.all` `tasks.create` `tasks.update` `tasks.assign` `tasks.archive` `tasks.bulk`
`tasks.status.update.own` `tasks.comment` `tasks.attach` *(employee-level; scoped to assigned/member tasks)*
`teams.read` `teams.manage` *(added after v1: departments, teams and team membership; Manager and Super Admin hold both)*

**Finance** *(Admin only by default; manager access is a configurable grant)*
`finance.invoices.read` `finance.invoices.create` `finance.invoices.update` `finance.invoices.issue` `finance.invoices.cancel`
`finance.payments.read` `finance.payments.record` `finance.payments.confirm` `finance.payments.reverse`
`finance.expenses.read` `finance.expenses.create` `finance.expenses.update` `finance.expenses.pay` `finance.expenses.reverse`
`finance.categories.manage` `finance.reports.read` `finance.reports.export` `finance.notifications.receive`

**Default role seed**
| Role | Permissions |
|---|---|
| Super Admin | every key |
| Manager | all People-and-work keys, `employees.read`, `reports.limited.read`, `dashboard.operational.read`, `dashboard.personal.read`, `tasks.*` employee keys. **No `finance.*`** and no `users.*`/`roles.*`/`settings.manage` |
| Employee | `tasks.status.update.own`, `tasks.comment`, `tasks.attach`, `dashboard.personal.read`, `reports.personal.read`. Nothing else |

Adding a key: PR touching `catalog.ts` + this table; all three review.

## 3. Service conventions

```ts
// modules/<x>/service.ts
export async function createTask(actor: Actor, input: CreateTaskInput): Promise<TaskDTO> { … }
```

- `Actor = { userId, companyId, employeeId | null, roles: string[], permissions: ReadonlySet<PermissionKey>, timezone }`, produced **only** by `getActor()` (reads the Better Auth session, loads roles/permissions, rejects suspended users). Services never read headers or cookies.
- A service function, in this order: `requirePermission(actor, key)` → load record **through scope** → validate business rules → transaction (mutation + `audit.record(tx, …)`) → return DTO.
- Errors: `throw new DomainError("TASK_NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | …, message)`. Out-of-scope records return **NOT_FOUND**, not FORBIDDEN (don't confirm existence).
- Lists: `(actor, { page, pageSize, sort, filters })` → `{ rows, total }`, server-side only. Max `pageSize` 100.
- Server Action result shape: `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.
- Naming: tables snake_case plural; columns snake_case; TS camelCase; permission keys dotted lowercase; enums as Postgres enums or `text + CHECK`, same list in a TS `as const`.
- Soft delete via `archived_at`; confirmed financial rows are never deleted.
- Every mutation touching sensitive data calls `audit.record`.

## 4. Libraries exported by Sagar (the foundation API)

| Import | Provides |
|---|---|
| `@/lib/auth/actor` | `getActor()`, `Actor` |
| `@/lib/permissions` | `PERMISSIONS`, `can(actor,key)`, `requirePermission(actor,key)` |
| `@/lib/permissions/scope` | `taskScope(actor)`, `projectScope(actor)`, `clientScope(actor)` → Drizzle conditions |
| `@/modules/audit` | `audit.record(tx, {actor, entity, entityId, action, before?, after?})` |
| `@/lib/errors` | `DomainError`, `toActionResult` |
| `@/lib/codes` | `nextCode(tx, companyId, kind)` |
| `@/lib/dates` | `todayInTz(tz)`, `isOverdue()`, `overdueCondition(today)`, `dueTodayCondition`, `upcomingCondition(days)` |
| `@/lib/storage` | `putObject`, `getSignedUrl`, `deleteObject`, `files` helpers (Sprint 5) |
| `@/db` | `db`, `withTransaction(fn)` |

### Foundation API as implemented (Sprint 1)

- `Actor = { userId, companyId, employeeId | null, roles: string[], permissions: ReadonlySet<PermissionKey>, timezone }` — `@/lib/auth/actor`.
- `getActor()` (app code, reads the session) and `loadActor(userId)` (`@/lib/auth/load-actor`, for tests and jobs). Unknown user → `UNAUTHENTICATED`; suspended (banned) user → `FORBIDDEN`.
- `can(actor, key)`, `requirePermission(actor, key)` (throws `FORBIDDEN`), `PERMISSIONS`, `ALL_PERMISSION_KEYS`, `SYSTEM_ROLES` — `@/lib/permissions`.
- `taskScope(actor)`, `projectScope(actor)`, `clientScope(actor)` return a Drizzle `SQL` condition (always company-scoped; `false` when the actor sees nothing) — `@/lib/permissions/scope`. Use in `.where(...)`.
- `audit.record(tx, { actor, entity, entityId, action, before?, after? })` — `@/modules/audit`. Redacts keys matching `pass|token|secret|hash|credential`. `activity_logs` and `task_activity_logs` reject UPDATE/DELETE via DB trigger.
- `DomainError(code, message, details?)`, `toActionResult(fn)`, codes `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT | INTERNAL` — `@/lib/errors`.
- `nextCode(tx, companyId, "TSK" | "PRJ" | "CLI" | "EMP" | "INV" | "EXP")` → `"TSK-000123"` — `@/lib/codes`.
- `db`, `withTransaction(fn)`, `type Tx` — `@/db`.
- Test helpers (`src/test/factories.ts`): `createCompany`, `createUser`, `createEmployee`, `createClient`, `createProject`, `createTask`, `grantPermissions`, `buildActor`. Tests run against a real PostgreSQL (`TEST_DATABASE_URL`), migrated fresh on each run.

### Work-management API as implemented (Sprints 3–5)

Import only from the module's `index.ts`. Every function takes `actor` first; out-of-scope records are `NOT_FOUND`.

| Import | Provides |
|---|---|
| `@/modules/employees` | `createEmployee`, `updateEmployee`, `getEmployee`, `listEmployees`, **`getWorkload(actor, employeeId?, {periodDays})`** → `{open, inProgress, overdue, completedInPeriod}`, `getEmployeeTasks`, `deactivateEmployee`, `suspendEmployee`, `reactivateEmployee`, `assertAssignable(tx, companyId, employeeId)` |
| `@/modules/clients` | `createClient`, `updateClient`, `getClient`, `listClients`, `archiveClient`, `unarchiveClient`, `addClientNote`, `listClientNotes` |
| `@/modules/projects` | `createProject`, `updateProject`, `changeProjectStatus`, `getProject`, `listProjects`, members (`addMember`, `removeMember`, `setMemberRole`, `changeOwner`, `listMembers`), milestones, **`getProjectProgress`**, **`getProgressForProjects(actor, ids)`** → `Map<id, {done,total,percent}>` |
| `@/modules/tasks` | `createTask`, `updateTask`, `getTask`, `archiveTask`, `assignTask`/`unassignTask`/`reassignTask`, `changeTaskStatus`, **`listTasks(actor, {view:'mine'|'all', status[], priority[], assigneeId, clientId, projectId, dueFrom, dueTo, overdue, search, sort, dir, page, pageSize<=100})`**, `listTaskActivity`, `listCalendarTasks`, comments, attachments, `bulkChangeStatus`/`bulkReassign`/`bulkArchive`, `canAccessTaskAttachment` |
| `@/modules/files` | `saveUpload`, `readFile(actor, fileId, checkers)`, `removeFileRow`, `purgeObjects`, type `FileAccessChecker` — **Chintan:** store receipts with `saveUpload`, link them in your own table, and add a `FileAccessChecker` for them to `CHECKERS` in `src/app/api/files/[id]/route.ts` |
| `@/modules/search` | `globalSearch(actor, query)` |
| `@/lib/dates` | `todayInTz(tz)`, `addDays`, **`isOverdue(task, today)`**, `overdueCondition(today)`, `dueTodayCondition(today)`, `upcomingCondition(today, days)` — the one overdue rule; dashboards and reminder jobs must use it |
| `@/lib/notify` | `notify(event)` (never throws, call after commit), `setNotifier(fn)` — **Shubhangi:** register your implementation with `setNotifier` when `modules/notifications` exists. Events emitted: `task.assigned`, `task.review`, `task.completed` (keys per section 6) |
| `@/lib/storage` | `putObject`, `getObject`, `deleteObject`, `validateUpload`, `sanitizeFileName`, `newStorageKey` |

Task status rules: Pending → In Progress → In Review → Completed, reopen = Completed → In Progress. Assignees may move their own task among the first three; **completing or reopening needs `tasks.update`** (a ruling; change `isOwnTransitionAllowed` if the business wants otherwise).

### UI / reports / notifications / settings API as implemented (Developer 3 lane)

| Import | Provides |
|---|---|
| `@/components/ui/*` | `Button`/`buttonClass`/`inputClass`, `Field`, `StatusBadge` (task, project, invoice, payment statuses; icon + text), `EmptyState`/`ErrorState`/`TableSkeleton`, `ConfirmDialog`/`ConfirmForm` (native `<dialog>`), `PageHeader`, `useToast` |
| `@/components/data-table/data-table` | `DataTable`: server-side sort/pagination via URL params, optional selection and column visibility. Pass plain rows + `DataColumn[]` (`kind: text|status|link|number`) |
| `@/components/forms/form-kit` | React Hook Form helpers: `TextField`, `DateField`, `MoneyField` (canonical via `lib/money`), `PickerField`, `SubmitRow`, `useUnsavedChangesWarning` |
| `@/components/charts/bar-chart-card` | Accessible chart (always has a "View as table") |
| `@/modules/notifications` | `deliver(event)` (idempotent per `eventKey`+user; finance events only to `finance.notifications.receive`), `registerNotifier()` (called from `src/instrumentation.ts`), `listForUser`, `unreadCount`, `markRead`, `markAllRead`, `runReminders()` |
| `@/modules/reports` | `getDashboard(actor, {preset|from|to})`, `availableReports`, `runReport`, `iterateReport`, `exportReport(actor, key, "csv"|"xlsx"|"pdf", filters)`, `exportFinanceReportResponse`, `resolveRange` (company-local dates) |
| `@/modules/settings` | `getCompanyProfile`/`updateCompanyProfile` (timezone drives "today"), `getPreferences`/`updatePreferences`, `getNumbering` |
| `@/lib/export` | `toCsv`/`toCsvStream`, `toXlsx`/`toXlsxStream`, `toPdf`, `escapeCell` — the column list is the export allowlist |

Chintan: emit `notify({ type: "payment.recorded", userIds, entity: { type: "payment", id }, eventKey: "payment:{id}", title })` after commit; `invoice.*`/`payment.*`/`expense.*`/`finance.*` events are delivered only to users with `finance.notifications.receive`. Report permissions: `reports.all.read` (all), `reports.limited.read` (task register, project status, workload if `employees.workload.read`, clients if `clients.read`), `reports.personal.read` (own task register); exporting needs `reports.export`.

## 5. Libraries exported by others

| Owner | Import | Provides |
|---|---|---|
| Chintan | `@/lib/money` | `toMinor(str)`, `fromMinor(int)`, `add/sub/mul`, `roundHalfUp`, `formatMoney(minor, currency)` |
| Chintan | `@/modules/finance` | `getClientFinanceSummary(actor, clientId)`, `getProjectFinanceSummary(actor, projectId)`, `getFinanceSnapshot(actor, range)` |
| Shubhangi | `@/modules/notifications` | `notify(event)` (post-commit, dedupe key), `markRead`, `listForUser` |
| Shubhangi | `@/components/*` | UI kit, `DataTable`, form components, state components |
| Shubhangi | `@/lib/export` | `toCsv`, `toXlsx`, `streamExport` |

Finance data shown on Sagar's client/project detail pages comes **only** through `@/modules/finance`; the actor's finance permission is checked there, and if absent those tabs are not rendered.

## 6. Cross-module events (who notifies whom)

| Trigger (owner of trigger) | Calls | Event key |
|---|---|---|
| Task assigned/reassigned (Sagar) | `notify({type:"task.assigned", userIds, entity})` | `task:{id}:assigned:{assigneeId}:{assignedAt}` |
| Task → In Review (Sagar) | `notify({type:"task.review", …})` | `task:{id}:review:{updatedAt}` |
| Task completed (Sagar) | `notify({type:"task.completed", …})` | `task:{id}:completed:{completedAt}` |
| Receipt / expense payment confirmed (Chintan) | `notify({type:"payment.recorded", …})` finance-permitted users only | `payment:{id}` |
| Due soon / overdue (Shubhangi job, uses Sagar's date helpers) | `notify` | `task:{id}:overdue:{date}` |
| Invoice due/overdue (Shubhangi job, uses Chintan's queries) | `notify` | `invoice:{id}:due:{date}` |

## 7. Environment variables (keep `.env.example` current)

`DATABASE_URL` · `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `S3_ENDPOINT` `S3_REGION` `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` · `EMAIL_FROM` `SMTP_URL` (or provider key) · `CRON_SECRET` · `APP_URL` · `SEED_DEMO` · `UPLOAD_MAX_BYTES`.
