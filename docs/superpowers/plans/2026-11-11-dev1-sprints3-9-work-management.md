# Developer 1 (Sagar) — Sprints 3–9: Clients, Projects, Tasks, Collaboration, Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task; run commands sequentially (never write a test file while a full test run is in flight).

**Goal:** Finish Developer 1's scope: client → project → task workflow with RBAC, collaboration (comments, attachments, board/calendar, bulk), performance, security tests, docs.

**Architecture/Stack/Constraints:** as `2026-11-11-dev1-sprint1-foundation.md` and Sprint 2 plan. Service order: `requirePermission` → scoped load → validate → transaction (mutation + audit) → DTO. Out-of-scope → NOT_FOUND. Bare pages (shared UI kit is Shubhangi's).

**Spec:** `docs/03-dev1-sagar.md` D1-12…D1-34, `docs/02-contracts.md`, `docs/08-data-model.md`.

## Review Focus
- Task whose `client_id` differs from its project's client must be rejected (D1-18).
- Concurrent status transitions on one task: exactly one wins (D1-20).
- Deactivated/foreign-company employee cannot be assigned (D1-19).
- Due-today is not overdue; completed/archived never overdue; company-timezone boundary (D1-21).
- Attachment/comment access for a user outside the task's scope → NOT_FOUND (D1-25/26/27).
- Upload with disallowed type, oversize, or path-traversal filename is rejected; storage key never uses the user filename.
- Bulk action with mixed permitted/forbidden records reports per-record results, applies none of the forbidden (D1-29).
- Archived client keeps its projects/tasks (AC-13).

## Tasks (each: tests first → implement → lint/typecheck → commit → task-done)

1. **Clients (D1-12)** `modules/clients/{service,queries,schemas,dto,index}.ts`: `createClient/updateClient/getClient/listClients/archiveClient/unarchiveClient`, `addClientNote/listClientNotes`; permissions `clients.*`; `clientScope`; code `CLI-`; archive hides from default list, keeps projects/tasks.
2. **Projects CRUD + status machine (D1-13)** `modules/projects/*`: Client project needs active client; Internal has none; owner must be assignable employee (auto-added as `owner` member); budget/currency; date validation; transitions Planning→Active→On Hold↔Active→Completed|Cancelled→Archived (table-tested); `listProjects/getProject` via `projectScope`.
3. **Members (D1-14)**: `addMember/removeMember/setMemberRole`; owner is protected (change owner via `changeOwner`); only assignable employees; `projects.members.manage`.
4. **Milestones (D1-15)**: CRUD, status, `completed_at` set/cleared; `projects.milestones.manage`.
5. **Progress (D1-16)** `modules/projects/progress.ts`: `calcProgress(done,total)` (0 when none, integer %), `getProjectProgress`. Eligible = non-archived tasks of the project.
6. **Client/project pages (D1-12/17)** bare list/new/detail (tabs: overview, members, milestones, tasks; finance tab placeholder hidden).
7. **lib/dates complete + status machine + notify port (D1-21, D1-20 core)**: `isOverdue`, `dueTodayCondition`, `upcomingCondition(days)`; `modules/tasks/status-machine.ts` pure transition table; `lib/notify.ts` no-op registry (`setNotifier`, `notify`) since `@/modules/notifications` is Shubhangi's and not yet present.
8. **Task CRUD + assignees + status + activity (D1-18/19/20/22)** `modules/tasks/*`: create/update/get/archive; client/project consistency; assign/unassign/reassign (assertAssignable, `notify` after commit); `changeStatus` with `WHERE status=:expected`; employees limited to permitted transitions on own tasks; every change writes `task_activity_logs` in the same tx.
9. **Task queries (D1-23)** `listTasks(actor,{view:'mine'|'all', status, priority, assigneeId, clientId, projectId, dueFrom, dueTo, search, sort, page, pageSize})` + `getTask`, scoped.
10. **Task pages (D1-24)** My Tasks (list/board toggle), All Tasks table, Task detail with status/comment hooks.
11. **Storage + files (D1-25)** `lib/storage` (local + s3 drivers, allowlist 10 MB pdf/png/jpg/docx/xlsx/csv/txt, server-generated keys), `modules/files`, `/api/files/[id]` permission-checked.
12. **Comments (D1-26)**: add/edit own/delete own (or `tasks.update`), activity logged.
13. **Attachments (D1-27)**: upload/list/download/remove, inherits task visibility.
14. **Board + calendar (D1-28)**: board drag → `changeStatus`; calendar by due date (bare).
15. **Bulk actions (D1-29)**: bulk status / reassign / archive with per-record result.
16. **Finance tabs (D1-30)**: blocked on Chintan's `@/modules/finance`; add nothing speculative — document the integration point and ledger as blocked.
17. **Performance (D1-31)**: seed 10k tasks in test DB; `EXPLAIN` task list/overdue/workload; add indexes via migration if a seq scan on large tables appears.
18. **Security suite (D1-32)**: cross-user and cross-company IDOR across every module read/write, privilege escalation, session revocation, upload validation.
19. **Global search (D1-33)** authorised records only (employees, clients, projects, tasks).
20. **Docs (D1-34)**: README sections (auth, RBAC, tasks, local setup, scripts), progress.md, contracts update.

## Self-review
Covers D1-12…D1-34 except D1-30 (external dependency, explicitly blocked). AC-04/05/06/07/13 owned here map to tasks 2–3, 8, 8/22, 7, 1.
