# Developer 3 — Shubhangi: Dashboard, UI & System Integration

Final deliverable: a consistent, responsive application where all modules look and behave as one product, with dashboards, reports, notifications and settings working on real data — and the integrator role for the whole project.

Read first: `00-architecture.md`, `02-contracts.md`, `07-file-architecture.md`. Blueprint sections: §3, §4.1, §9, §10.1, §11, §12 (AC-12, AC-15).

You can start **on day 1** without any backend: build the shell and design system against mock data, then wire in real services as each lands.

## Design contract (blueprint §9)
- Palette: Automora green `#167C50`, white/light neutral backgrounds, charcoal text. **No purple.**
- Status colours: green = completed/paid · blue = in progress/info · amber = pending · red = overdue/critical. **Always with text**, never colour alone.
- Font: Inter (or similar). Compact hierarchy. Subtle borders, restrained shadows.
- Desktop: persistent left sidebar. Tablet: collapsible. Mobile: drawer, stacked KPIs, single-column forms, touch-friendly controls.
- Required states on every list/detail: loading skeleton, empty (with next action), error (with retry), success (only after server confirms).
- Confirmation dialogs for archive, cancel invoice, reverse payment, permission changes.
- Tokens (colours, spacing, radius, type scale) are defined once as CSS variables / Tailwind theme in `globals.css`. Other developers use only those tokens and Tailwind utilities — no invented class names.

## Task list

### Sprint 1 — Shell and design system
| ID | Task | Done when |
|---|---|---|
| U-01 | Design tokens + Tailwind theme + shadcn/ui setup + Inter font; light theme (dark mode out of scope for V1) | Storybook-style `/dev/ui` page (dev only) showing all components |
| U-02 | **App shell**: `(workspace)/layout.tsx`, sidebar with grouped navigation (Workspace / Finance / System), header, **profile menu** (name, role, sign out; data from `getActor()`), mobile drawer, breadcrumbs, page header | Responsive at 375 / 768 / 1280 |
| U-03 | Nav is **permission-aware** (hides items the actor can't use) — convenience only, services still enforce | |
| U-04 | Base components: button, input, select, textarea, checkbox, dialog, dropdown, tabs, badge, toast, tooltip | Keyboard focus visible; labelled |

### Sprint 2 — Data and forms kit
| ID | Task | Done when |
|---|---|---|
| U-05 | **DataTable** (TanStack): server-side pagination/sort/filter driven by URL search params, sticky header, column visibility, row actions, selection for bulk actions | Documented usage; used by Sagar's lists |
| U-06 | **Form kit** (React Hook Form + Zod): field wrapper (label, required marker, inline error), date picker, money input (uses `lib/money`), user/employee picker, unsaved-changes warning, submit state | |
| U-07 | **State components**: skeletons, empty state, error state with retry, `confirm-dialog`, `status-badge` (task/project/invoice/payment statuses with icon + text) | |
| U-08 | **Settings – company profile & preferences**: legal/display name, email, phone, address, currency, timezone (saved to `companies`/`company_settings`; timezone drives "today") | Changing timezone changes overdue results (AC-07 link) |
| U-09 | Security headers + CSP in `next.config.ts`; Dockerfile draft | |

### Sprint 3 — Wire core lists
| ID | Task | Done when |
|---|---|---|
| U-10 | Employees, Clients, Projects list pages on the DataTable (using Sagar's services; he owns detail pages) | |
| U-11 | **Settings – roles & permissions UI** (matrix by permission group, confirmation on change) on Sagar's roles API; system configuration screens (numbering display, preferences) | Changes audited via the API |
| U-12 | **Dashboard layout** with mock data: KPI cards, chart containers, lists, filters (Today / This Week / This Month / Quarter / Custom), "period total vs point-in-time" labels | |

### Sprint 4 — Notifications and task visuals
| ID | Task | Done when |
|---|---|---|
| U-13 | `db/schema/notifications.ts` (notifications, notification_events with unique dedupe key); `notify()` post-commit, `markRead`, `markAllRead`, `listForUser`, unread count | Sagar can call `notify` |
| U-14 | Notification centre page + header bell with unread badge; read/unread; links to entities; finance notifications only to `finance.notifications.receive` | Employee never receives finance notifications |
| U-15 | Chart components (Recharts): task status, priority, workload bars; accessible (legends, text alternatives/tables) | Follow colour rules |
| U-16 | Deadline list and overdue list components | |

### Sprint 5 — Reports shell and calendar
| ID | Task | Done when |
|---|---|---|
| U-17 | Calendar component (month/week, due dates) used by Sagar's task calendar | |
| U-18 | **Reports & Analytics** shell: report picker, date filters, table output, export buttons (CSV / XLSX / PDF) | |
| U-19 | `lib/export`: `toCsv` (escape formulas: prefix `'` for cells starting `= + - @`), `toXlsx`, streamed large exports; exports use identical filters/scope and strip unauthorised fields; finance exports audited | Test with a formula-injection value |

### Sprint 6–7 — Finance screens integration
| ID | Task |
|---|---|
| U-20 | Invoices / Payments / Expenses screens' shared parts (status badges, money display, filters) — Chintan builds the feature screens on your kit |
| U-21 | Dashboard finance snapshot widget on Chintan's `getFinanceSnapshot` (hidden without finance permission) |
| U-22 | Financial Reports page frame + project-finance tab placeholders replaced with real data |

### Sprint 8 — Dashboards and reports (real data)
| ID | Task | Done when |
|---|---|---|
| U-23 | `modules/reports/dashboard.ts`: **Admin** (full), **Manager** (operational, no finance unless granted), **Employee** (personal) dashboards on real data; every query takes `actor`, uses Sagar's scope + date helpers | Counts match the task list for the same filters |
| U-24 | KPIs: active employees, active clients/projects, open/completed/overdue tasks, outstanding invoices; task status; priority (open only); upcoming deadlines (today + 7 days); overdue; workload per employee; recent activity (permission-scoped) | |
| U-25 | Reports: employee workload, task register, project status, client summary (and finance reports from Chintan) with the filters/columns in blueprint §11 | |
| U-26 | **Reconciliation tests (AC-12)**: dashboard + reports totals equal the sum of source records for the same range and actor | |
| U-27 | PDF report interfaces for selected reports | |

### Sprint 9 — Reminders, polish, QA
| ID | Task | Done when |
|---|---|---|
| U-28 | Reminder jobs (`/api/cron/*`, protected by `CRON_SECRET`): task due soon/overdue, project deadline, invoice due/overdue; stable event keys; failures logged and retried independently | Running twice creates no duplicates |
| U-29 | Accessibility pass: keyboard, focus, labels, contrast, non-colour status cues | Automated axe check + manual keyboard pass |
| U-30 | Responsive pass on every screen; Playwright viewports (mobile/tablet/desktop) | AC-15 |
| U-31 | Playwright E2E for the main workflows (login, client→project→task, employee update, invoice→receipt, expense→payment, reports) | CI job |
| U-32 | Error boundaries, 404/500 pages, global loading states | |
| U-33 | Deployment: Dockerfile, env docs, staging deploy, health check, backup + restore test with the team (AC-14), runbook | AC-14 |

## Integrator duties (whole project)
- Keep `main` building and demoable; run the "I-n" demo at each sprint end (see `01-team-plan.md`).
- Maintain `docs/progress.md`.
- UI consistency review on every PR touching `app/**` pages: uses shared components, has all four states, works on mobile.
- Own the end-to-end checklist for the 6 blueprint workflows (§5.1–5.6).

## Acceptance tests you own
AC-12 · AC-15 · AC-14 (coordination) · dashboard counts of AC-06.

## Risks
1. **Three different tables/forms.** Mitigation: ship U-05/U-06 early (Sprint 2); Sagar and Chintan use them rather than writing their own.
2. **Dashboard numbers that disagree with lists.** Always reuse `overdueCondition` and the module query functions; no re-implemented filters.
3. **Chart colour-only meaning.** Add labels/patterns/tables.
4. **Heavy dashboard queries** — add indexes (coordinate with Sagar), cache per request only; no stale-data caching of permission-scoped data across users.
5. **Exports leaking fields** — export column lists are explicit allowlists per report and role.
