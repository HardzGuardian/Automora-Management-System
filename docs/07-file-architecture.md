# File Architecture

Complete target tree for the repository, with an owner for every area. This extends the folder summary in `00-architecture.md` §3. Create files when you need them; don't pre-create empty ones.

Legend: **S** = Sagar · **C** = Chintan · **H** = Shubhangi (Dev 3)

## 1. Repository root

```
/
├─ README.md
├─ docs/                                 these planning docs + decisions.md + ERD
├─ .github/
│  ├─ workflows/ci.yml                   lint, typecheck, test, build                    S
│  ├─ pull_request_template.md           DoD checklist                                   S
│  └─ CODEOWNERS                         per-folder reviewers (see §4)                   S
├─ docker-compose.yml                    postgres, minio, mailpit                        S
├─ Dockerfile                            production image                                H
├─ drizzle.config.ts                                                                      S
├─ next.config.ts                        security headers, server-only config             H
├─ proxy.ts                              optimistic auth redirect only                    S
├─ tsconfig.json  eslint.config.mjs  .prettierrc  vitest.config.ts  playwright.config.ts  S
├─ .env.example                          every variable, no secrets                      all
├─ package.json  pnpm-lock.yaml
├─ public/                               static assets, logo
├─ e2e/                                  Playwright specs (see §3)
└─ src/
```

## 2. `src/` tree

```
src/
├─ app/
│  ├─ layout.tsx  globals.css  not-found.tsx  error.tsx  loading.tsx            H
│  ├─ (auth)/                                                                   S (pages) / H (styling)
│  │  ├─ login/page.tsx
│  │  ├─ forgot-password/page.tsx
│  │  ├─ reset-password/page.tsx
│  │  └─ accept-invite/page.tsx
│  ├─ (workspace)/
│  │  ├─ layout.tsx                      shell: sidebar + header + profile menu      H
│  │  ├─ dashboard/                      page.tsx, _components/                      H
│  │  ├─ my-tasks/                       page.tsx                                    S
│  │  ├─ tasks/                          page.tsx, [id]/page.tsx, new/page.tsx       S
│  │  ├─ projects/                       page.tsx, [id]/(overview|members|milestones|tasks|finance)  new/  S
│  │  ├─ employees/                      page.tsx, [id]/(overview|tasks|projects|activity), new/       S
│  │  ├─ clients/                        page.tsx, [id]/ , new/                      S
│  │  ├─ profile/                        page.tsx  (current user: own profile, change password, sessions)  S
│  │  ├─ invoices/                       page.tsx, [id]/, new/                       C
│  │  ├─ payments/                       page.tsx, [id]/                             C
│  │  ├─ expenses/                       page.tsx, [id]/, new/                       C
│  │  ├─ finance-reports/                page.tsx                                    C
│  │  ├─ reports/                        page.tsx, [report]/page.tsx                 H
│  │  ├─ notifications/                  page.tsx                                    H
│  │  └─ settings/                       company/, preferences/, roles/, numbering/  H (UI) + S (roles data)
│  └─ api/
│     ├─ auth/[...all]/route.ts          Better Auth handler                         S
│     ├─ files/[id]/route.ts             permission-checked download                 S
│     ├─ exports/[report]/route.ts       CSV/XLSX/PDF                                H (finance: C)
│     ├─ invoices/[id]/pdf/route.ts      printable invoice PDF                       C
│     └─ cron/(reminders|invoice-due)/route.ts  CRON_SECRET protected               H
│
│  Each page folder may contain:  actions.ts (Server Actions) · _components/ (feature-only UI) · loading.tsx · error.tsx
│
├─ modules/                              business logic. Public API = index.ts only.
│  ├─ auth/            service.ts  invitations.ts  schemas.ts  index.ts  *.test.ts      S
│  ├─ employees/       service.ts  queries.ts  schemas.ts  workload.ts  index.ts        S
│  ├─ clients/         service.ts  queries.ts  schemas.ts  index.ts                     S
│  ├─ projects/        service.ts  queries.ts  schemas.ts  progress.ts  index.ts        S
│  ├─ tasks/           service.ts  queries.ts  schemas.ts  status-machine.ts
│  │                   comments.ts  attachments.ts  activity.ts  index.ts               S
│  ├─ audit/           record.ts  queries.ts  redact.ts  index.ts                       S
│  ├─ finance/                                                                          C
│  │  ├─ invoices/     service.ts  queries.ts  schemas.ts  calc.ts  state-machine.ts  numbering.ts  pdf.tsx
│  │  ├─ payments/     service.ts  queries.ts  schemas.ts  allocation.ts  reversal.ts
│  │  ├─ expenses/     service.ts  queries.ts  schemas.ts  categories.ts  attachments.ts
│  │  ├─ expense-payments/  service.ts  queries.ts  schemas.ts  reversal.ts
│  │  ├─ reports/      receivables.ts  cash-movement.ts  project-finance.ts  expense-register.ts
│  │  ├─ summaries.ts  getClientFinanceSummary, getProjectFinanceSummary, getFinanceSnapshot
│  │  └─ index.ts
│  ├─ notifications/   service.ts  queries.ts  notify.ts  reminders.ts  index.ts        H
│  ├─ reports/         dashboard.ts  workload.ts  tasks.ts  projects.ts  clients.ts  index.ts   H
│  └─ settings/        service.ts  schemas.ts  index.ts                                  H (company_settings table is S)
│
├─ components/
│  ├─ ui/              shadcn primitives (button, input, dialog, …)                      H
│  ├─ layout/          sidebar.tsx  header.tsx  profile-menu.tsx  mobile-drawer.tsx  page-header.tsx  breadcrumbs.tsx   H
│  ├─ data-table/      data-table.tsx  toolbar.tsx  pagination.tsx  filters.tsx  column-header.tsx   H
│  ├─ forms/           form-field.tsx  select.tsx  date-picker.tsx  money-input.tsx  user-picker.tsx  unsaved-changes.tsx  H
│  ├─ feedback/        skeletons.tsx  empty-state.tsx  error-state.tsx  confirm-dialog.tsx  toast.tsx  status-badge.tsx   H
│  └─ dashboard/       kpi-card.tsx  status-chart.tsx  priority-chart.tsx  workload-chart.tsx  deadline-list.tsx  activity-feed.tsx   H
│
├─ db/
│  ├─ index.ts         client + withTransaction                                          S
│  ├─ schema/          company.ts auth.ts rbac.ts employees.ts clients.ts projects.ts tasks.ts files.ts audit.ts   S
│  │                   finance.ts                                                       C
│  │                   notifications.ts                                                 H
│  │                   index.ts   re-exports all
│  ├─ migrations/      generated, committed, never hand-edited
│  ├─ seed.ts          roles, permissions, categories, optional demo data              S (finance seed data: C)
│  └─ (append-only guard for audit tables is added as a migration — trigger or DB grants, see ADR-09)  S
│
├─ lib/
│  ├─ auth/            auth.ts (Better Auth config)  auth-client.ts  actor.ts  session.ts   S
│  ├─ permissions/     catalog.ts  roles.ts  can.ts  require.ts  scope.ts               S
│  ├─ validation/      common.ts (uuid, pagination, date, email Zod pieces)             S
│  ├─ errors/          domain-error.ts  to-action-result.ts                             S
│  ├─ codes/           next-code.ts                                                     S
│  ├─ dates/           tz.ts  overdue.ts                                                S
│  ├─ storage/         s3.ts  upload.ts  signed-url.ts  allowlist.ts                    S
│  ├─ money/           money.ts  format.ts  rounding.ts                                 C
│  ├─ idempotency/     with-idempotency.ts                                              C
│  ├─ export/          csv.ts  xlsx.ts  pdf-report.ts                                   H
│  ├─ email/           send.ts  templates/ (invite, reset)                              S
│  └─ env.ts           validated env (Zod)                                              S
│
└─ types/              global.d.ts, shared DTO types that aren't owned by one module
```

## 3. Test layout

```
src/modules/<x>/*.test.ts               unit + DB integration tests next to the service
src/lib/**/*.test.ts                    pure-function tests (money, dates, scope)
src/test/                               setup: test DB, factories (createCompany, createUser, createTask…), actor builders
e2e/
  auth.spec.ts  employees.spec.ts  work-lifecycle.spec.ts  tasks.spec.ts
  invoice-receipt.spec.ts  expense-payment.spec.ts  reports.spec.ts
  security-idor.spec.ts  responsive.spec.ts
```
Test factories (`src/test/`) are owned by Sagar; add your own factory in the same folder when your module needs one.

## 4. CODEOWNERS (suggested)

```
/src/db/schema/finance.ts        @chintan
/src/modules/finance/            @chintan
/src/lib/money/                  @chintan
/src/modules/notifications/      @shubhangi
/src/modules/reports/            @shubhangi
/src/components/                 @shubhangi
/src/lib/export/                 @shubhangi
/src/lib/permissions/catalog.ts  @sagar @chintan @shubhangi   (all three)
*                                @sagar
```
(Replace handles with the real GitHub usernames.)

## 5. Where "profile" things live

"Profile" appears in three different places. Don't mix them:

| What | Meaning | Files | Owner |
|---|---|---|---|
| **Employee profile** | HR-style record of a person (code, designation, joining date, photo, status) and its tabs: Overview, Assigned/Completed/Overdue Tasks, Projects, Activity | `app/(workspace)/employees/[id]/…`, `modules/employees/*`, `db/schema/employees.ts` | S |
| **My account page** | The signed-in user's own page: change password, active sessions (revoke), view own employee record | `app/(workspace)/profile/page.tsx`, `modules/auth/service.ts` (`changePassword`, `listMySessions`, `revokeSession`) | S |
| **Profile menu** | Header dropdown (avatar, name, role, link to profile, sign out) | `components/layout/profile-menu.tsx` | H (data from `getActor()`) |
| **Company profile** | Company name, address, currency, timezone | `app/(workspace)/settings/company/`, `modules/settings/*`, `db/schema/company.ts` | H (UI) / S (table) |

Profile image: stored through `lib/storage` as a `files` row; `employees.profile_image_file_id` references it; shown via the permission-checked `/api/files/[id]` route (employees can see colleagues' avatars only if they hold `employees.read`; their own avatar is always allowed).

## 6. Import rules (enforce with ESLint `no-restricted-imports`)

1. `app/**` and `components/**` may import `modules/*/index.ts`, `lib/*`, `components/*`. Never `db/*` directly.
2. `modules/a` may import `modules/b` only via `modules/b/index.ts`.
3. `components/**` never imports `modules/**` (they receive props); feature `_components/` inside `app/**` may.
4. Client Components (`"use client"`) never import `server-only` modules; anything they need from the server arrives as props or via Server Actions.
5. Only `lib/env.ts` reads `process.env`.
