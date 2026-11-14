# System overview (current state)

This chapter describes the system as it is built today. The chapters after it are the original plans, contracts and
reference documents; where they differ from this chapter, **this chapter is current**.

## 1. What it is

Automora Company Management System is an internal web application for Automora Tech Solutions LLP. It manages
employees, clients, projects, tasks, departments and teams, and operational finance (invoices, payments, expenses),
with dashboards, reports, notifications and an audit trail. Access is invitation-only and permission-based.

## 2. Technology

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, server actions), React 19, TypeScript (strict) |
| Database | PostgreSQL with Drizzle ORM; SQL migrations `0000` to `0005` |
| Authentication | Better Auth: email and password, database sessions, invitation-only sign-up |
| Validation | Zod on every service input |
| Styling | Tailwind CSS v4 with design tokens in `globals.css`; calm, accessible, no gradients or emoji |
| Tables and charts | TanStack Table, Recharts |
| Documents | exceljs (XLSX), @react-pdf/renderer (PDF), streaming CSV |
| Storage | Local disk or S3-compatible bucket; files served only through an access-checked route |
| Tests | Vitest against a real PostgreSQL database; Playwright with axe for browser and accessibility checks |
| Packaging | `output: "standalone"`, Dockerfile, GitHub Actions CI, backup and restore scripts |

## 3. Modules

| Module | What it does |
|---|---|
| auth | Sign-in, invitations, roles and permissions, sessions, password reset, rate limiting, security events |
| employees | Employee records, lifecycle (active, inactive, suspended), workload |
| clients, projects | Client records; projects with members, milestones, progress, budget (budget visible only to people who may see it) |
| tasks | Tasks with assignees, a status machine, comments, attachments, activity history, board and calendar views, bulk actions |
| **teams** | Departments, teams, members, leads; assigning tasks and projects to a whole team |
| finance | Invoices (with PDF), payments, expenses with receipts, finance reports and exports |
| reports, search | Operational reports with CSV, XLSX and PDF export; global search limited to records the user may see |
| notifications | In-app notifications, email, and scheduled reminders (due soon, overdue, invoices) |
| settings, audit, files | Company settings and numbering; append-only audit log; file storage |

## 4. Screens

Dashboard, My tasks, All tasks (table, board, calendar), Projects, Clients, Employees, **Teams**, Invoices, Payments,
Expenses, Finance reports, Reports, Notifications, Settings (Company, Preferences, Users, Roles and permissions,
Numbering), My account, and Search. The menu shows only what the signed-in user may open; every action is checked
again on the server.

## 5. Departments and teams

Company, then Department (for example Marketing, Software Development), then Team (A, B, C, D), then members.

- Admins with `teams.manage` create departments and teams and add or remove members. A team can have leads.
- A task or project can be assigned to a whole team. Every active member receives it; people who join later receive the
  team's open tasks and live projects; people who leave lose only what they had through the team.
- Direct assignments, project owners and finished tasks are never changed by team changes.
- A person can belong to several teams. A team lead can assign work to their own team only.
- Team-sourced members appear as ordinary assignees, so My tasks, dashboards, notifications, workload and reports work
  without change. Technical detail: `docs/13-teams.md`.

## 6. Security model

- **Deny by default.** Permissions are `area.resource.action` keys; roles are sets of keys. Super Admin always holds all.
- **Record scope in SQL.** A record outside the user's scope is reported as "not found", never "forbidden".
- **Invitation only.** Single-use, hashed, expiring tokens; role grants cannot exceed what the inviter holds.
- **Rate limits** on sign-in, forgot-password and reset-password, stored in the database.
- **Suspended users** cannot sign in and their sessions are removed.
- **Files** have server-generated keys, an allowlist with content checks, and downloads go through an access check.
- **Exports** neutralise spreadsheet formula injection and are audited.
- **Headers:** strict content security policy and security headers on every response.
- **Audit:** every important change is written to an append-only audit log in the same transaction as the change.
- **Money** is stored as exact decimals; company currency is locked once any invoice, payment or expense exists.

## 7. Running it

1. Requirements: Node 22 or newer, pnpm, PostgreSQL 17 or newer.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters) and `SEED_ADMIN_EMAIL`.
3. `pnpm install`, then `pnpm db:migrate`, then `pnpm db:seed`.
4. The seed prints a one-time accept-invite link for the first Super Admin. There is no default password.
   If the link is lost: `pnpm db:admin-invite`.
5. `pnpm dev` and open `http://localhost:3000`.

Useful commands: `pnpm build`, `pnpm lint`, `pnpm test` (unit and integration), `pnpm e2e` (browser tests),
`pnpm db:generate` (new migration after a schema change).

## 8. Deployment and operations

Production uses `pnpm build` and the standalone output, or the Dockerfile. The app refuses to start in production with
unsafe settings. A health endpoint reports database and storage status; scheduled reminders run through a protected cron
endpoint. Backup and restore-check scripts are in `scripts/`. See the deployment runbook chapter.

## 9. Delivery status

| Area | Status |
|---|---|
| Foundation, auth, RBAC, employees, clients, projects, tasks | Built |
| Finance (invoices, payments, expenses, reports, receipts) | Built, integrated, fixes documented for review |
| Dashboards, reports, exports, notifications, settings, search | Built |
| UI redesign and accessibility pass | Built; browser tests pass at 375, 768 and 1280 px widths |
| Security hardening and review findings | Built |
| Departments and teams | Built; production build passes |
| Unit and integration tests | Last full run: 767 of 768 passed. The one failure is a dashboard test about the company time zone deciding "today" and has not been investigated |
| Tests for teams | Written, **not yet run** |
| Browser (Playwright) suite | Passed on the previous build; not re-run after the teams work |

## 10. Known gaps before go-live

- Run the full unit suite and the browser suite, and fix the dashboard time-zone test.
- The Docker image has not been built; no staging deployment has been done.
- The S3 storage driver has not been run against a real bucket.
- A shared calendar component is still duplicated.
- Finance code was fixed during integration; the finance developer should review `docs/10-integration-sagar-chintan.md`.
- Failed sign-ins for unknown email addresses are not written to the security events table (logged and ignored).
- Nothing has been pushed to the shared repository yet; merge order and branch chain are in `docs/06-workflow.md` and git history.
