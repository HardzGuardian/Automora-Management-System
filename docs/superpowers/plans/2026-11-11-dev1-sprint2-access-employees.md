# Developer 1 (Sagar) — Sprint 2 Access + Employees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Invitations and account activation, password reset, roles/permissions API, employee CRUD/directory/detail/workload, suspend/reactivate, and "my account" — satisfying AC-01.

**Architecture:** Same as Sprint 1. Services take `Actor` first: `requirePermission` → scoped load → validate → `withTransaction` (mutation + `audit.record`) → DTO. Pages/actions are thin and bare (no shared UI kit yet). Better Auth internals (`auth.$context.internalAdapter`) create users/accounts and revoke sessions.

**Tech Stack:** as Sprint 1. No new dependencies.

**Spec:** `docs/03-dev1-sagar.md` (D1-05…D1-11), `docs/02-contracts.md`, `docs/00-architecture.md` ADR-02/03/09.

## Global Constraints
Same as Sprint 1 plan. Additionally: invitation/reset tokens single-use, short-lived, stored hashed; out-of-scope → NOT_FOUND; never delete an employee/user referenced by history; permission-denied test for every service function; every sensitive mutation audited.

## Review Focus
- Replayed or expired invitation token must fail (D1-05, D1-06).
- Accepting an invitation for an email that already has a user must not create a duplicate/hijack an account.
- Reset-password must revoke other sessions; replayed reset token fails.
- Deactivated employee cannot be assigned/ cannot sign in; history retained.
- Employee A cannot read employee B's directory entry without `employees.read` (NOT_FOUND/FORBIDDEN as per contract).
- Role with zero permissions grants nothing; system roles cannot be deleted/renamed.

---

### Task 1: Invitations service (D1-05, service half)
**Files:** Create `src/modules/auth/{invitations.ts,schemas.ts,index.ts}`, `src/modules/auth/invitations.test.ts`.
**Interfaces — Produces:**
- `createInvitation(actor, { email, roleId, employeeId? }): Promise<{ invitationId: string; acceptUrl: string }>` — needs `users.invite`; role must belong to actor's company; email lowercased; rejects if a user with the email exists (CONFLICT) or a live invitation exists for it (CONFLICT); emails the link (failure to send does not fail creation); audited.
- `resendInvitation(actor, invitationId)` → revokes the old token, issues a new one (7-day expiry). `revokeInvitation(actor, invitationId)`.
- `getInvitationPreview(token): Promise<{ email; roleName; companyName } | null>` — public; null if unknown/used/revoked/expired.
- `acceptInvitation({ token, name, password }): Promise<{ userId }>` — public; creates Better Auth user + credential account (password ≥10 chars), `user_roles` row, links `employees.user_id` if `employeeId` set, marks `used_at`, all in one transaction; replayed/expired/revoked → VALIDATION; audited.
- [ ] Tests (RED first): create requires permission; token stored hashed; duplicate live invite/existing user → CONFLICT; foreign-company role → NOT_FOUND; accept creates user that can sign in via `auth.handler`; replay fails; expired fails; revoked fails; resend invalidates old token; accept links employee; employee-less accept works.
- [ ] Implement; `pnpm test` green; commit `feat(auth): invitations service`.

### Task 2: Invite pages and email (D1-05, UI half)
**Files:** Create `src/app/(auth)/accept-invite/{page.tsx,accept-form.tsx,actions.ts}`; Modify `src/db/seed.ts` unchanged. Email text in `src/modules/auth/emails.ts`.
- [ ] Page shows preview or "invalid/expired" state; action calls `acceptInvitation`, then redirects to `/login?activated=1`.
- [ ] Verify by HTTP: seed invite link → accept → sign in. Commit `feat(auth): accept-invite page`.

### Task 3: Forgot / reset password (D1-06)
**Files:** Modify `src/lib/auth/auth.ts` (`sendResetPassword`, token TTL 3600s); Create `src/app/(auth)/{forgot-password,reset-password}/…`, `src/modules/auth/reset.test.ts`.
- [ ] Tests: request for unknown email returns same response (no enumeration); valid token resets and old password stops working; replayed token fails; other sessions revoked after reset; request is rate-limited.
- [ ] Implement; commit `feat(auth): forgot/reset password`.

### Task 4: Roles & permissions service (D1-07)
**Files:** Create `src/modules/auth/roles.ts`, `roles.test.ts`.
**Produces:** `listRoles(actor)` (`roles.read`), `createRole(actor,{name,description?})` (no perms), `setRolePermissions(actor, roleId, keys[])` (`roles.manage`; unknown keys → VALIDATION; system "Super Admin" immutable), `assignRole(actor,userId,roleId)`, `removeRole(actor,userId,roleId)` (cannot remove the last Super Admin), all audited with before/after.
- [ ] Tests: deny-by-default, new role empty, edit audited, cross-company role/user → NOT_FOUND, last Super Admin protected, system role names protected.
- [ ] Implement; commit.

### Task 5: Employee CRUD + directory (D1-08)
**Files:** Create `src/modules/employees/{service.ts,queries.ts,schemas.ts,index.ts,*.test.ts}`.
**Produces:** `createEmployee(actor,input)` (`employees.create`, code via `nextCode`), `updateEmployee`, `getEmployee(actor,id)`, `listEmployees(actor,{page,pageSize,search?,status?,department?,sort?})` → `{rows,total}` (`employees.read`, max pageSize 100); DTO excludes `userId` internals except `hasAccount`.
- [ ] Tests: happy path, denied, out-of-company NOT_FOUND, validation, duplicate work email CONFLICT, search/filter/pagination, code uniqueness under concurrency.
- [ ] Implement; commit.

### Task 6: Employee detail + workload (D1-09)
**Files:** `src/modules/employees/workload.ts`, tests.
**Produces:** `getWorkload(actor, employeeId?)` → `{ open, inProgress, overdue, completedInPeriod }` (own workload always allowed; others need `employees.workload.read`); `getEmployeeTasks(actor, employeeId, tab)` for Assigned/Completed/Overdue; uses an `isOverdue` SQL condition local to tasks (to be replaced by `lib/dates` in D1-21 — note in code).
- [ ] Tests with seeded tasks, boundary due-today not overdue, completed excluded, permission cases. Commit.

### Task 7: Suspend / reactivate / deactivate (D1-10)
**Files:** `src/modules/employees/lifecycle.ts`, tests.
**Produces:** `deactivateEmployee`, `suspendEmployee`, `reactivateEmployee` (`employees.deactivate` / `users.suspend`): set `employment_status`, ban user + delete sessions via Better Auth internal adapter, keep history and assignments; `assertAssignable(tx, companyId, employeeId)` helper exported for task assignment (deactivated → VALIDATION).
- [ ] Tests: banned user can't sign in; existing sessions die; reactivation restores sign-in; assignable check; audited; cannot deactivate self. Commit.

### Task 8: My account (D1-11) + minimal employee pages
**Files:** `src/modules/auth/account.ts`, tests; bare pages `src/app/(workspace)/{profile,employees}/…`.
**Produces:** `changePassword(actor, current, next)`, `listMySessions(actor)`, `revokeSession(actor, sessionId)` (only own; revoked session rejected next request).
- [ ] Tests incl. revoking someone else's session → NOT_FOUND. Pages bare (list, new, detail, profile). Commit.

## Self-review
Covers D1-05…D1-11. AC-01 = Tasks 1,2 (invite→activate→login) + 7 (suspend). Interfaces defined once above.
