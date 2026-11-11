import "server-only";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, type Tx } from "@/db";
import { employees, roles, session, user, userRoles } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { toEmployeeDTO, type EmployeeDTO } from "./dto";
import { loadEmployee } from "./service";

const reasonSchema = z.object({ reason: z.string().trim().max(300).optional() });

type Target = "Inactive" | "Suspended";

/** Bans the linked account and kills its sessions; history and assignments stay untouched. */
async function lockAccount(tx: Tx, userId: string, reason: string | null): Promise<void> {
  await tx.update(user).set({ banned: true, banReason: reason, banExpires: null }).where(eq(user.id, userId));
  await tx.delete(session).where(eq(session.userId, userId));
}

async function assertNotLastSuperAdmin(tx: Tx, companyId: string, userId: string): Promise<void> {
  const holdsSuperAdmin = await tx
    .select({ id: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.name, "Super Admin"), eq(roles.isSystem, true), eq(roles.companyId, companyId)));
  if (holdsSuperAdmin.length === 0) return;
  const [{ others }] = await tx
    .select({ others: count() })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(user, eq(user.id, userRoles.userId))
    .where(
      and(
        eq(roles.name, "Super Admin"),
        eq(roles.isSystem, true),
        eq(roles.companyId, companyId),
        ne(user.id, userId),
        eq(user.banned, false),
      ),
    );
  if (others === 0) throw new DomainError("CONFLICT", "At least one active Super Admin must remain");
}

async function lock(
  actor: Actor,
  id: string,
  input: { reason?: string },
  target: Target,
): Promise<EmployeeDTO> {
  const { reason } = reasonSchema.parse(input);
  return withTransaction(async (tx) => {
    const before = await loadEmployee(tx, actor, id);
    if (before.id === actor.employeeId || (before.userId && before.userId === actor.userId)) {
      throw new DomainError("VALIDATION", "You cannot do this to your own account");
    }
    if (before.employmentStatus === target) {
      throw new DomainError("CONFLICT", `Employee is already ${target.toLowerCase()}`);
    }
    if (before.userId) {
      await assertNotLastSuperAdmin(tx, actor.companyId, before.userId);
      await lockAccount(tx, before.userId, reason ?? null);
    }
    const [row] = await tx
      .update(employees)
      .set({ employmentStatus: target })
      .where(and(eq(employees.id, id), eq(employees.companyId, actor.companyId)))
      .returning();
    await audit.record(tx, {
      actor,
      entity: "employee",
      entityId: id,
      action: target === "Inactive" ? "employee.deactivated" : "employee.suspended",
      before: { employmentStatus: before.employmentStatus },
      after: { employmentStatus: target, reason: reason ?? null },
    });
    return toEmployeeDTO(row);
  });
}

export async function deactivateEmployee(actor: Actor, id: string, input: { reason?: string }): Promise<EmployeeDTO> {
  requirePermission(actor, "employees.deactivate");
  return lock(actor, id, input, "Inactive");
}

export async function suspendEmployee(actor: Actor, id: string, input: { reason?: string }): Promise<EmployeeDTO> {
  requirePermission(actor, "users.suspend");
  return lock(actor, id, input, "Suspended");
}

export async function reactivateEmployee(actor: Actor, id: string): Promise<EmployeeDTO> {
  requirePermission(actor, "employees.deactivate");
  return withTransaction(async (tx) => {
    const before = await loadEmployee(tx, actor, id);
    if (before.employmentStatus === "Suspended") requirePermission(actor, "users.suspend");
    if (before.employmentStatus === "Active") throw new DomainError("CONFLICT", "Employee is already active");
    if (before.userId) {
      await tx.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, before.userId));
    }
    const [row] = await tx
      .update(employees)
      .set({ employmentStatus: "Active" })
      .where(and(eq(employees.id, id), eq(employees.companyId, actor.companyId)))
      .returning();
    await audit.record(tx, {
      actor,
      entity: "employee",
      entityId: id,
      action: "employee.reactivated",
      before: { employmentStatus: before.employmentStatus },
      after: { employmentStatus: "Active" },
    });
    return toEmployeeDTO(row);
  });
}

/** Used by task/project assignment: only active employees of the same company can be assigned. */
export async function assertAssignable(tx: Tx, companyId: string, employeeId: string): Promise<void> {
  const [emp] = await tx
    .select({ status: employees.employmentStatus })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)));
  if (!emp) throw new DomainError("NOT_FOUND", "Employee not found");
  if (emp.status !== "Active") throw new DomainError("VALIDATION", "This employee is not active and cannot be assigned");
}
