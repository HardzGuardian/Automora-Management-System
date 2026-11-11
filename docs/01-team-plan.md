# Team Plan

Blueprint rule: *stabilise database, authentication and permission foundations before parallelising modules.* So the plan has one short serial start (Sagar), then three parallel lanes that meet at fixed integration points.

Sprint length is **not fixed** (the blueprint says estimate after repo/hosting review). Sprints below are a dependency order. Suggested starting assumption: 1-week sprints, re-estimate at the end of Sprint 1.

## 1. Critical path

```
D1-00 scaffold ─► D1-01 auth+schema baseline ─► D1-02 RBAC+actor+audit ─► everything else
        │                  │
        │                  └─► core-entity schema (clients/projects/tasks tables) ─► Chintan's FKs
        └─► Shubhangi: shell + design system (works with mock data, no backend needed)
```

Until D1-02 lands, Chintan and Shubhangi work on things that do not need auth/RBAC (pure functions, schema design, UI components). That is deliberate, not idle time.

## 2. Phase / sprint map

| Sprint | Sagar (Dev 1) | Chintan (Dev 2) | Shubhangi (Dev 3) | Integration point at sprint end |
|---|---|---|---|---|
| **1** Foundation | Scaffold, CI, docker, DB baseline, Better Auth login/logout, `getActor`, `requirePermission`, audit helper | `lib/money`, invoice/payment/expense **calculation functions + unit tests** (pure, no DB), finance schema design review | Design tokens, shadcn setup, app shell (sidebar, header, profile menu, responsive), shared form/table/state components with mock data | **I-1:** merged scaffold; login works; shell renders around a real session |
| **2** Access + employees | Invitations, reset password, roles/permissions seed + UI/API, employee CRUD + directory + profile, deactivate/revoke | Finance schema (invoices, items, payments, expenses, expense_payments, categories, idempotency) + migrations; permission keys finalised | Data-table (server pagination/filter), form kit, empty/error/skeleton states, Settings: company profile + preferences | **I-2:** AC-01 passes; finance + core schema in one migration history |
| **3** Clients + projects | Client CRUD/detail/archive/notes; projects, members, milestones, progress, project detail | Invoice service: draft create/edit, line items, totals/tax/discount, numbering, state machine (Draft→Issued→Cancelled) | Clients/Projects/Employees list pages wired to Sagar's services; settings: roles & permission UI shell; dashboard layout with mock data | **I-3:** AC-04, AC-13 (partial); first end-to-end: employee → client → project |
| **4** Tasks | Task CRUD, multi-assignee, status/priority/dates, My Tasks + All Tasks, activity log | Incoming payments: record, confirm, allocate, reverse, outstanding balance; idempotency; invoice status derivation | Task list/board components, notification centre UI (list, read/unread), KPI card + chart components | **I-4:** AC-02, AC-05, AC-06, AC-07 |
| **5** Collaboration | Comments, attachments (`lib/storage` + files), board/calendar views, bulk actions | Expense CRUD, categories, vendor/payee, project link, receipt attachments (uses `lib/storage`) | Calendar view UI, reports page shell + date filter + export buttons, notification triggers wiring | **I-5:** full task workflow incl. files; file permission tests |
| **6** Finance core | Support: finance scope helpers for client/project detail tabs; IDOR/security tests for core | Invoice issue/cancel, printable PDF, partial receipts UI, client outstanding | Invoices/Payments screens (list/detail/forms) integrated; finance snapshot widget | **I-6:** AC-08, AC-09, AC-10 |
| **7** Expenses | Employee workload query hardening; project/client summary queries | Expense payments (partial/full), reversals, expense outstanding, finance reports queries | Expenses screens integrated; Financial Reports screen; project-finance tab | **I-7:** AC-11 |
| **8** Dashboard + reports | Query support for workload/overdue/deadlines; performance indexes | Receivables, cash movement, project finance reports; finance exports | Admin/Manager/Employee dashboards; report pages; CSV/XLSX/PDF export; reconciliation tests | **I-8:** AC-12 |
| **9** Notifications + QA | Security tests (IDOR, escalation, session revocation); fix bugs | Finance edge-case tests; audit coverage | Reminder jobs (due soon/overdue/invoice due), a11y + responsive pass (AC-15), Playwright E2E | **I-9:** all AC-01…AC-15 except AC-14 |
| **10** Launch | Staging UAT fixes | Staging UAT fixes | Deployment coordination, docs | **AC-14:** backup restored in a test environment; production release |

If a sprint's integration point is missed, the team does not start the next sprint's new features — it fixes integration first.

## 3. Dependency table (who blocks whom)

| Needs | From | By end of | Why |
|---|---|---|---|
| Scaffold + CI + docker compose on `main` | Sagar | day 1–2 of Sprint 1 | Everyone branches from it |
| Core schema: companies, users, employees, clients, projects, tasks (tables only) | Sagar | Sprint 1 | Chintan's FKs (client_id, project_id) |
| `getActor()`, `requirePermission()`, `can()` | Sagar | Sprint 1 | All services |
| `audit.record()` | Sagar | Sprint 1 | Finance audit requirements |
| Permission catalogue v1 agreed | all three | start Sprint 1 | Role seed, UI, services all use keys |
| `nextCode()` | Sagar | Sprint 1 | Invoice/expense codes |
| `lib/dates` (`todayInTz`, `isOverdue`) | Sagar | Sprint 2 | Dashboard, notifications |
| `lib/money` | Chintan | Sprint 1 | Anyone showing money (dashboard, project budget) |
| Shared UI kit (buttons, forms, data-table, states) | Shubhangi | Sprint 2 | Sagar/Chintan screens |
| `lib/storage` + `files` | Sagar | Sprint 5 start | Task attachments, expense receipts |
| `notify()` | Shubhangi | Sprint 4 | Task assignment alerts, payment alerts |
| Employee workload / overdue queries | Sagar | Sprint 4 | Dashboard widgets |
| Finance summary queries (receivables, cash, outstanding) | Chintan | Sprint 7 | Dashboard finance snapshot, client detail |

Anything a teammate needs earlier than this table says: ask in the team channel, don't build a private copy.

## 4. UI ownership rule (avoids three people building three tables)

- **Shubhangi owns shared components** (`components/ui`, `layout`, `data-table`, `forms`, `dashboard`).
- **Feature screens are built by the module owner** (Sagar: tasks/projects/clients/employees pages; Chintan: invoices/payments/expenses pages) using the shared components, **except** where the plan lists them under Shubhangi (list-page wiring, dashboards, reports, notifications, settings).
- Until the shared components exist (Sprint 2), module owners build service + API first and use a bare page.

## 5. Acceptance tests ownership

| AC | Owner | AC | Owner |
|---|---|---|---|
| AC-01 | Sagar | AC-09 | Chintan |
| AC-02 | Sagar | AC-10 | Chintan |
| AC-03 | Sagar (access) + Chintan (finance side) | AC-11 | Chintan |
| AC-04 | Sagar | AC-12 | Shubhangi (with Chintan for finance numbers) |
| AC-05 | Sagar | AC-13 | Sagar (+ Chintan: finance refs retained) |
| AC-06 | Sagar (+ Shubhangi: dashboard counts) | AC-14 | Shubhangi coordinates deploy; whole team |
| AC-07 | Sagar | AC-15 | Shubhangi |
| AC-08 | Chintan | | |

## 6. Meetings and rhythm
- 15-min daily sync (async text is fine): done / next / blocked.
- Integration demo at each "I-n" point: run the listed workflow end to end on `main`.
- One person (Shubhangi, as integrator) owns "does `main` build and demo cleanly".
- Decision log: any change to permission rules, financial calculations or data relationships goes into `docs/decisions.md` via PR *before* implementation (blueprint requirement).
