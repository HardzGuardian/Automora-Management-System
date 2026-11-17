# Progress

Update the row in the same PR that finishes the task. Status: `todo` · `doing` · `review` · `done` · `blocked`.


## Sagar (Dev 1)

| ID | Task | Status | PR |
|---|---|---|---|
| D1-00 | Scaffold | review | |
| D1-01 | DB baseline | review | |
| D1-02 | Better Auth | review | |
| D1-03 | Foundation libs | review | |
| D1-04 | Seed | review | |
| D1-05 | Invitations & account lifecycle | review | |
| D1-06 | Forgot / reset password | review | |
| D1-07 | Roles & permissions API | review | |
| D1-08 | Employee CRUD | review | |
| D1-09 | Employee detail | review | |
| D1-10 | Deactivate / reactivate / suspend | review | |
| D1-11 | My account: change password, list/revoke own sessions | review | |
| D1-12 | Client CRUD | review | |
| D1-13 | Project CRUD | review | |
| D1-14 | Project members | review | |
| D1-15 | Milestones: CRUD, status, completed_at | review | |
| D1-16 | Progress: progress.ts = completed ÷ non-cancelled eligible tasks, 0% when none; unit tests | review | |
| D1-17 | Project detail (overview, members, milestones, tasks; budget/finance tabs via finance modu | review | |
| D1-18 | Task CRUD | review | |
| D1-19 | Assignees | review | |
| D1-20 | Status machine | review | |
| D1-21 | lib/dates | review | |
| D1-22 | Task activity log | review | |
| D1-23 | My Tasks / All Tasks services | review | |
| D1-24 | Task pages: My Tasks (list/board toggle), All Tasks (table), Task Detail | review | |
| D1-25 | lib/storage + files | review | |
| D1-26 | Task comments: add/edit own/delete rules, activity logged | review | |
| D1-27 | Task attachments: upload, list, download, remove; inherits task visibility | review | |
| D1-28 | Board view (drag between statuses uses the status machine) and Calendar view (due dates) | review | |
| D1-29 | Bulk actions: bulk status / reassign / archive; permission checked per record; audited | review | |
| D1-30 | Finance-aware client/project detail tabs once Chintan's summaries exist | review | |
| D1-31 | Query performance | review | |
| D1-32 | Security test suite | review | |
| D1-33 | Global search (authorised records only) if time permits (blueprint §3 global pattern) | review | |
| D1-34 | Bug-fix and UAT support; README sections for auth, RBAC, tasks | review | |

## Chintan (Dev 2)

| ID | Task | Status | PR |
|---|---|---|---|
| F-01 | lib/money | review | |
| F-02 | Invoice calculation (calc.ts) | review | |
| F-03 | Balance calculation | review | |
| F-04 | Expense balance & status equivalents | review | |
| F-05 | State machines | review | |
| F-06 | Choose PDF approach and write a 1-page note in docs/decisions.md | review | |
| F-07 | db/schema/finance.ts | doing | |
| F-08 | Finance permission keys reviewed with team; categories seed (default expense categories) | review | |
| F-09 | Invoice service | doing | |
| F-10 | Numbering | doing | |
| F-11 | Invoice list/detail queries with filters (status, client, project, date range), server pag | doing | |
| F-12 | recordReceipt | doing | |
| F-13 | confirmReceipt | review | |
| F-14 | reverseReceipt | review | |
| F-15 | Allocation (payment_allocations) | review | |
| F-16 | Cancelled/Draft invoice refuses receipts | review | |
| F-17 | Client outstanding balance query (for Sagar's client detail) | review | |
| F-18 | Expense categories CRUD (activate/deactivate, not delete) | review | |
| F-19 | Expense CRUD | review | |
| F-20 | Receipt/bill attachments through lib/storage (Sagar); downloads require finance.expenses.r | review | |
| F-21 | issueInvoice | review | |
| F-22 | cancelInvoice: rules — no confirmed receipts (or require reversal first); reason; audit | review | |
| F-23 | Printable invoice PDF (company details, items, tax, totals, balance) via /api/invoices/[id | review | |
| F-24 | Invoice and receipt screens (list/detail/forms) — with Shubhangi's components | review | |
| F-25 | Overdue invoice derivation (due date < company-local today and balance > 0) — uses Sagar's | review | |
| F-26 | recordExpensePayment (full/partial), confirm, reverse, idempotency, row lock | review | |
| F-27 | Expense outstanding & status (Unpaid/Partially Paid/Paid) | review | |
| F-28 | Expense screens (list/detail/payment dialogs) | review | |
| F-29 | Project finance summary | review | |
| F-30 | Queries | review | |
| F-31 | getFinanceSnapshot(actor, range) for the dashboard, with period-total vs point-in-time lab | review | |
| F-32 | Finance report exports use the same filters/scope; exports are audited | review | |
| F-33 | Edge-case suite | review | |
| F-34 | Audit coverage check | review | |
| F-35 | Permission pass | doing | |

## Shubhangi (Dev 3)

| ID | Task | Status | PR |
|---|---|---|---|
| U-01 | Design tokens + Tailwind theme + shadcn/ui setup + Inter font; light theme (dark mode out  | review | no shadcn package: hand-built accessible components + /dev/ui gallery |
| U-02 | App shell | review |  |
| U-03 | Nav is permission-aware (hides items the actor can't use) — convenience only, services sti | review |  |
| U-04 | Base components | review |  |
| U-05 | DataTable (TanStack) | review |  |
| U-06 | Form kit (React Hook Form + Zod) | review |  |
| U-07 | State components | review |  |
| U-08 | Settings – company profile & preferences | review |  |
| U-09 | Security headers + CSP in next.config.ts; Dockerfile draft | review | headers+CSP live; Dockerfile untested (no Docker) |
| U-10 | Employees, Clients, Projects list pages on the DataTable (using Sagar's services; he owns  | review |  |
| U-11 | Settings – roles & permissions UI (matrix by permission group, confirmation on change) on  | review |  |
| U-12 | Dashboard layout with mock data | review |  |
| U-13 | db/schema/notifications.ts (notifications, notification_events with unique dedupe key); no | review |  |
| U-14 | Notification centre page + header bell with unread badge; read/unread; links to entities;  | review |  |
| U-15 | Chart components (Recharts) | review |  |
| U-16 | Deadline list and overdue list components | review |  |
| U-17 | Calendar component (month/week, due dates) used by Sagar's task calendar | todo | task calendar exists (Sagar's page); not extracted as a shared component |
| U-18 | Reports & Analytics shell | review |  |
| U-19 | lib/export | review |  |
| U-20 | Invoices / Payments / Expenses screens' shared parts (status badges, money display, filter | review |  |
| U-21 | Dashboard finance snapshot widget on Chintan's getFinanceSnapshot (hidden without finance  | review |  |
| U-22 | Financial Reports page frame + project-finance tab placeholders replaced with real data | review |  |
| U-23 | modules/reports/dashboard.ts | review |  |
| U-24 | KPIs | review |  |
| U-25 | Reports | review |  |
| U-26 | Reconciliation tests (AC-12) | review |  |
| U-27 | PDF report interfaces for selected reports | review |  |
| U-28 | Reminder jobs (/api/cron/*, protected by CRON_SECRET) | review |  |
| U-29 | Accessibility pass: keyboard, focus, labels, contrast, non-colour status cues | review |  |
| U-30 | Responsive pass on every screen; Playwright viewports (mobile/tablet/desktop) | review | Playwright 375/768/1280 over ~23 routes |
| U-31 | Playwright E2E for the main workflows (login, client→project→task, employee update, invoic | review | Playwright: auth, client→project→task, employee, invoice→receipt, expense→payment, reports |
| U-32 | Error boundaries, 404/500 pages, global loading states | review |  |
| U-33 | Deployment | review | Dockerfile + runbook + restore drill done; image not built here (no Docker) and no staging deploy |
