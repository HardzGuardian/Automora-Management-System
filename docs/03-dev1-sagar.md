# Developer 1 — Sagar: Foundation & Core Operations

Final deliverable: complete **employee → client → project → task** workflow, secured by RBAC, plus the foundation libraries the other two build on.

Read first: `00-architecture.md`, `02-contracts.md`. Blueprint sections: §2, §4.2–4.5, §5.1–5.3, §5.6, §6, §10.2–10.3.

You are the critical path for Sprints 1–2. Land the foundation small and early; polish later.

## Task list

IDs are used in branch names and `progress.md`. "AC" = blueprint acceptance test.

### Sprint 1 — Foundation
| ID | Task | Done when |
|---|---|---|
| D1-00 | **Scaffold**: Next.js + TS strict, pnpm, ESLint/Prettier, Vitest, `docker-compose.yml` (Postgres, MinIO, Mailpit), Drizzle config, `lib/env.ts`, folder skeleton from `07-file-architecture.md`, GitHub Actions CI, PR template, CODEOWNERS, `.env.example`, ESLint import rules | Clone → `pnpm i && docker compose up -d && pnpm dev` works; CI green on an empty PR. **Merge within 1–2 days** |
| D1-01 | **DB baseline**: schemas `company`, `auth` (Better Auth generated + `invitations`), `rbac`, `employees`, `clients`, `projects`, `tasks`, `files`, `audit`; `code_sequences`; composite company FKs; unique/check constraints and indexes from blueprint §6.4; first migration | Migration applies on empty DB; integration test proves a cross-company FK fails |
| D1-02 | **Better Auth**: Drizzle adapter, email+password, login/logout pages, session cookie settings, rate limiting, `proxy.ts` redirect, disabled-user rejection | Login works; suspended user cannot sign in and existing sessions die |
| D1-03 | **Foundation libs**: `getActor()`, permission `catalog.ts` + seed, `can/requirePermission`, `scope.ts` (first version: tasks/projects), `audit.record` (+ redaction + append-only guard), `DomainError`, `nextCode`, `withTransaction` | Documented in `02-contracts.md` §4; unit tests; Chintan and Shubhangi unblocked |
| D1-04 | **Seed**: company, Super Admin invitation flow (no hard-coded password), system roles with default permissions (per `02-contracts.md` §2), `SEED_DEMO` demo data | Fresh DB + seed → Admin can accept invite and log in |

### Sprint 2 — Access + employees
| ID | Task | Done when |
|---|---|---|
| D1-05 | **Invitations & account lifecycle**: create invite (hashed single-use token, expiry), email via `lib/email`, accept-invite page (set password, activates user, links employee), resend/revoke invite | AC-01 first half; token reuse and expiry tested |
| D1-06 | **Forgot / reset password**: rate-limited, single-use, short-lived, revoke other sessions on reset | Tested incl. replayed token |
| D1-07 | **Roles & permissions API**: list roles, create role (no perms by default), edit permission set, assign/remove role to user; audited; confirm-needed actions exposed as separate service calls | Deny-by-default test; role change audited |
| D1-08 | **Employee CRUD**: create profile (before invitation), edit, directory (search/filter/paginate), `employee_code` via `nextCode`, profile image via storage placeholder | Directory visible to `employees.read` only |
| D1-09 | **Employee detail**: tabs Overview, Assigned, Completed, Overdue, Projects, Activity; `getWorkload(actor, employeeId?)` (open / in-progress / overdue / completed-in-period) — stub with tests, real data after tasks exist | Matches blueprint §4.2; workload query reusable by dashboard |
| D1-10 | **Deactivate / reactivate / suspend**: employment status, user ban + session revoke, history and assignments retained; deactivated employee cannot be newly assigned | AC-01 second half |
| D1-11 | **My account**: change password, list/revoke own sessions | Revoked session is rejected on next request |

### Sprint 3 — Clients + projects
| ID | Task | Done when |
|---|---|---|
| D1-12 | **Client CRUD**: fields per §4.3, `client_code`, search, archive (not delete), notes (`client_notes`), client detail page. Finance tab calls `@/modules/finance` and is hidden without finance permission | Archived client keeps projects/tasks (AC-13 part) |
| D1-13 | **Project CRUD**: Client vs Internal rule (client required for Client projects), `project_code`, status transitions (Planning→Active→On Hold→Completed/Cancelled→Archived), budget + currency, dates validation | Rule violations return VALIDATION |
| D1-14 | **Project members**: add/remove, owner/member/viewer; owner must be an active employee; project scope helper for employees | AC-04 membership half |
| D1-15 | **Milestones**: CRUD, status, `completed_at` | |
| D1-16 | **Progress**: `progress.ts` = completed ÷ non-cancelled eligible tasks, 0% when none; unit tests | Table-driven tests |
| D1-17 | **Project detail** (overview, members, milestones, tasks; budget/finance tabs via finance module, hidden without permission) | |

### Sprint 4 — Tasks
| ID | Task | Done when |
|---|---|---|
| D1-18 | **Task CRUD**: `task_code`, title, description (plain text or sanitised rich text), optional project/client with consistency check (task client must equal project's client), priority default Medium, status default Pending, dates validation (start ≤ due), estimated/actual hours, archive | AC-05 |
| D1-19 | **Assignees**: multiple active employees, assign/reassign/unassign, `assigned_by`; fires `notify` (after commit) | AC-04 multi-assignee half |
| D1-20 | **Status machine**: Pending→In Progress→In Review→Completed (+ reopen); employees may only perform permitted transitions on their own tasks; `completed_at` + actor stored; reopen clears and logs | Transition table test |
| D1-21 | **`lib/dates`**: `todayInTz`, `isOverdue`, `overdueCondition`, `dueTodayCondition`, `upcomingCondition`; wire into task queries | AC-07 incl. timezone boundary and excluded states |
| D1-22 | **Task activity log**: every change writes `task_activity_logs` (old/new JSON) in the same transaction | AC-06 history half |
| D1-23 | **My Tasks / All Tasks** services: server-side search, filters (status, priority, assignee, client, project, date range), sort, pagination; employee sees only assigned / project-member tasks | AC-02 |
| D1-24 | **Task pages**: My Tasks (list/board toggle), All Tasks (table), Task Detail | Works at 375px width for view/status/comment/deadline |

### Sprint 5 — Collaboration
| ID | Task | Done when |
|---|---|---|
| D1-25 | **`lib/storage` + `files`**: S3 client, server-generated keys, size/type allowlist, signed URLs, `/api/files/[id]` permission-checked download | Download denied for out-of-scope user (test) |
| D1-26 | **Task comments**: add/edit own/delete rules, activity logged | |
| D1-27 | **Task attachments**: upload, list, download, remove; inherits task visibility | AC-02 files half |
| D1-28 | **Board view** (drag between statuses uses the status machine) and **Calendar view** (due dates) | Invalid drop is rejected server-side |
| D1-29 | **Bulk actions**: bulk status / reassign / archive; permission checked per record; audited | Partial-failure result reported per record |

### Sprints 6–9 — Support and hardening
| ID | Task |
|---|---|
| D1-30 | Finance-aware client/project detail tabs once Chintan's summaries exist |
| D1-31 | Query performance: indexes verified with `EXPLAIN` on task lists at ~10k rows; workload/overdue/deadline queries tuned for dashboard |
| D1-32 | **Security test suite**: cross-user and cross-company IDOR for every module endpoint, privilege escalation (employee calls manager action), session revocation, upload validation (AC-03, AC-02) |
| D1-33 | Global search (authorised records only) if time permits (blueprint §3 global pattern) |
| D1-34 | Bug-fix and UAT support; README sections for auth, RBAC, tasks |

## Acceptance tests you own
AC-01 · AC-02 · AC-03 (access half) · AC-04 · AC-05 · AC-06 · AC-07 · AC-13.

## Risks and notes
1. **Foundation first, then features.** Resist building employee/client screens before D1-03 is merged.
2. **Out-of-scope record → NOT_FOUND**, not FORBIDDEN.
3. **Race conditions**: codes (`nextCode`), and reassigning/transitioning a task concurrently — transitions use `WHERE status = :expected` and check affected rows.
4. **Deactivation vs deletion**: never delete an employee/user referenced by history; deactivate.
5. **Task `client_id` vs `project.client_id`** can drift; enforce in the service and with a DB check where possible.
6. If the "manager finance access" decision (open decision #6) changes, only the role seed changes — nothing else should.
