# Progress

Update the row in the same PR that finishes the task. Status: `todo` · `doing` · `review` · `done` · `blocked`.


## Sagar (Dev 1)

| ID | Task | Status | PR |
|---|---|---|---|
| D1-00 | Scaffold | todo | |
| D1-01 | DB baseline | todo | |
| D1-02 | Better Auth | todo | |
| D1-03 | Foundation libs | todo | |
| D1-04 | Seed | todo | |
| D1-05 | Invitations & account lifecycle | todo | |
| D1-06 | Forgot / reset password | todo | |
| D1-07 | Roles & permissions API | todo | |
| D1-08 | Employee CRUD | todo | |
| D1-09 | Employee detail | todo | |
| D1-10 | Deactivate / reactivate / suspend | todo | |
| D1-11 | My account: change password, list/revoke own sessions | todo | |
| D1-12 | Client CRUD | todo | |
| D1-13 | Project CRUD | todo | |
| D1-14 | Project members | todo | |
| D1-15 | Milestones: CRUD, status, completed_at | todo | |
| D1-16 | Progress: progress.ts = completed ÷ non-cancelled eligible tasks, 0% when none; unit tests | todo | |
| D1-17 | Project detail (overview, members, milestones, tasks; budget/finance tabs via finance modu | todo | |
| D1-18 | Task CRUD | todo | |
| D1-19 | Assignees | todo | |
| D1-20 | Status machine | todo | |
| D1-21 | lib/dates | todo | |
| D1-22 | Task activity log | todo | |
| D1-23 | My Tasks / All Tasks services | todo | |
| D1-24 | Task pages: My Tasks (list/board toggle), All Tasks (table), Task Detail | todo | |
| D1-25 | lib/storage + files | todo | |
| D1-26 | Task comments: add/edit own/delete rules, activity logged | todo | |
| D1-27 | Task attachments: upload, list, download, remove; inherits task visibility | todo | |
| D1-28 | Board view (drag between statuses uses the status machine) and Calendar view (due dates) | todo | |
| D1-29 | Bulk actions: bulk status / reassign / archive; permission checked per record; audited | todo | |
| D1-30 | Finance-aware client/project detail tabs once Chintan's summaries exist | todo | |
| D1-31 | Query performance | todo | |
| D1-32 | Security test suite | todo | |
| D1-33 | Global search (authorised records only) if time permits (blueprint §3 global pattern) | todo | |
| D1-34 | Bug-fix and UAT support; README sections for auth, RBAC, tasks | todo | |

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
| F-27 | Expense outstanding & status (Unpaid/Partially Paid/Paid) | todo | |
| F-28 | Expense screens (list/detail/payment dialogs) | todo | |
| F-29 | Project finance summary | todo | |
| F-30 | Queries | todo | |
| F-31 | getFinanceSnapshot(actor, range) for the dashboard, with period-total vs point-in-time lab | todo | |
| F-32 | Finance report exports use the same filters/scope; exports are audited | todo | |
| F-33 | Edge-case suite | todo | |
| F-34 | Audit coverage check | todo | |
| F-35 | Permission pass | todo | |

## Shubhangi (Dev 3)

| ID | Task | Status | PR |
|---|---|---|---|
| U-01 | Design tokens + Tailwind theme + shadcn/ui setup + Inter font; light theme (dark mode out  | todo | |
| U-02 | App shell | todo | |
| U-03 | Nav is permission-aware (hides items the actor can't use) — convenience only, services sti | todo | |
| U-04 | Base components | todo | |
| U-05 | DataTable (TanStack) | todo | |
| U-06 | Form kit (React Hook Form + Zod) | todo | |
| U-07 | State components | todo | |
| U-08 | Settings – company profile & preferences | todo | |
| U-09 | Security headers + CSP in next.config.ts; Dockerfile draft | todo | |
| U-10 | Employees, Clients, Projects list pages on the DataTable (using Sagar's services; he owns  | todo | |
| U-11 | Settings – roles & permissions UI (matrix by permission group, confirmation on change) on  | todo | |
| U-12 | Dashboard layout with mock data | todo | |
| U-13 | db/schema/notifications.ts (notifications, notification_events with unique dedupe key); no | todo | |
| U-14 | Notification centre page + header bell with unread badge; read/unread; links to entities;  | todo | |
| U-15 | Chart components (Recharts) | todo | |
| U-16 | Deadline list and overdue list components | todo | |
| U-17 | Calendar component (month/week, due dates) used by Sagar's task calendar | todo | |
| U-18 | Reports & Analytics shell | todo | |
| U-19 | lib/export | todo | |
| U-20 | Invoices / Payments / Expenses screens' shared parts (status badges, money display, filter | todo | |
| U-21 | Dashboard finance snapshot widget on Chintan's getFinanceSnapshot (hidden without finance  | todo | |
| U-22 | Financial Reports page frame + project-finance tab placeholders replaced with real data | todo | |
| U-23 | modules/reports/dashboard.ts | todo | |
| U-24 | KPIs | todo | |
| U-25 | Reports | todo | |
| U-26 | Reconciliation tests (AC-12) | todo | |
| U-27 | PDF report interfaces for selected reports | todo | |
| U-28 | Reminder jobs (/api/cron/*, protected by CRON_SECRET) | todo | |
| U-29 | Accessibility pass: keyboard, focus, labels, contrast, non-colour status cues | todo | |
| U-30 | Responsive pass on every screen; Playwright viewports (mobile/tablet/desktop) | todo | |
| U-31 | Playwright E2E for the main workflows (login, client→project→task, employee update, invoic | todo | |
| U-32 | Error boundaries, 404/500 pages, global loading states | todo | |
| U-33 | Deployment | todo | |
