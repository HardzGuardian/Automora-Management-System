import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { withTransaction, type Tx } from "@/db";
import { employees, taskAssignees } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { requirePermission } from "@/lib/permissions";
import { assertAssignable } from "@/modules/employees";
import { loadTask, logTaskActivity } from "./core";
import { assigneeIdsSchema } from "./schemas";

export type AssignedInfo = { employeeId: string; userId: string | null; assignedAt: Date };

/**
 * Adds assignees inside the caller's transaction. Already-assigned employees are skipped.
 * Every new assignee must be an active employee of this company.
 */
export async function addAssignees(tx: Tx, actor: Actor, taskId: string, employeeIds: readonly string[]): Promise<AssignedInfo[]> {
  const unique = [...new Set(employeeIds)];
  if (unique.length === 0) return [];
  const existing = await tx
    .select({ employeeId: taskAssignees.employeeId })
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), inArray(taskAssignees.employeeId, unique)));
  const have = new Set(existing.map((e) => e.employeeId));
  const added: AssignedInfo[] = [];
  for (const employeeId of unique) {
    if (have.has(employeeId)) continue;
    await assertAssignable(tx, actor.companyId, employeeId);
    const [row] = await tx
      .insert(taskAssignees)
      .values({ taskId, companyId: actor.companyId, employeeId, assignedBy: actor.userId })
      .returning({ assignedAt: taskAssignees.assignedAt });
    const [emp] = await tx.select({ userId: employees.userId }).from(employees).where(eq(employees.id, employeeId));
    await logTaskActivity(tx, actor, taskId, "assigned", undefined, { employeeId });
    added.push({ employeeId, userId: emp?.userId ?? null, assignedAt: row.assignedAt });
  }
  return added;
}

/** Call AFTER the transaction commits. Employees without an account are skipped. */
export async function notifyAssigned(taskId: string, title: string, assigned: AssignedInfo[]): Promise<void> {
  for (const a of assigned) {
    if (!a.userId) continue;
    await notify({
      type: "task.assigned",
      userIds: [a.userId],
      entity: { type: "task", id: taskId },
      eventKey: `task:${taskId}:assigned:${a.employeeId}:${a.assignedAt.toISOString()}`,
      title: `You were assigned: ${title}`,
    });
  }
}

export async function assignTask(actor: Actor, taskId: string, employeeIds: string[]): Promise<void> {
  requirePermission(actor, "tasks.assign");
  const ids = assigneeIdsSchema.parse(employeeIds);
  const { assigned, title } = await withTransaction(async (tx) => {
    const task = await loadTask(tx, actor, taskId);
    if (task.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot be assigned");
    return { assigned: await addAssignees(tx, actor, taskId, ids), title: task.title };
  });
  await notifyAssigned(taskId, title, assigned);
}

export async function unassignTask(actor: Actor, taskId: string, employeeId: string): Promise<void> {
  requirePermission(actor, "tasks.assign");
  await withTransaction(async (tx) => {
    await loadTask(tx, actor, taskId);
    const [current] = await tx
      .select({ viaTeamId: taskAssignees.viaTeamId })
      .from(taskAssignees)
      .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, employeeId), eq(taskAssignees.companyId, actor.companyId)));
    if (current?.viaTeamId) {
      throw new DomainError("CONFLICT", "This person has the task through a team. Remove the team from the task, or take them out of the team.");
    }
    const removed = await tx
      .delete(taskAssignees)
      .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, employeeId), eq(taskAssignees.companyId, actor.companyId)))
      .returning({ employeeId: taskAssignees.employeeId });
    if (removed.length === 0) throw new DomainError("NOT_FOUND", "That employee is not assigned to this task");
    await logTaskActivity(tx, actor, taskId, "unassigned", { employeeId }, undefined);
  });
}

export async function reassignTask(actor: Actor, taskId: string, fromEmployeeId: string, toEmployeeId: string): Promise<void> {
  requirePermission(actor, "tasks.assign");
  const { assigned, title } = await withTransaction(async (tx) => {
    const task = await loadTask(tx, actor, taskId);
    if (task.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot be assigned");
    const removed = await tx
      .delete(taskAssignees)
      .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, fromEmployeeId), eq(taskAssignees.companyId, actor.companyId)))
      .returning({ employeeId: taskAssignees.employeeId });
    if (removed.length === 0) throw new DomainError("NOT_FOUND", "That employee is not assigned to this task");
    const added = await addAssignees(tx, actor, taskId, [toEmployeeId]);
    await logTaskActivity(tx, actor, taskId, "reassigned", { employeeId: fromEmployeeId }, { employeeId: toEmployeeId });
    return { assigned: added, title: task.title };
  });
  await notifyAssigned(taskId, title, assigned);
}
