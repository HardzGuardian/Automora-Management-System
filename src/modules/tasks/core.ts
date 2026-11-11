import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { employees, taskActivityLogs, taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { taskScope } from "@/lib/permissions";
import { redact } from "@/modules/audit";
import { toTaskDTO, type TaskAssigneeDTO, type TaskDTO } from "./dto";

type Reader = Pick<Tx, "select">;

/** Loads a task through the actor's scope; anything else is NOT_FOUND. */
export async function loadTask(tx: Reader, actor: Actor, id: string) {
  const [row] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), taskScope(actor)));
  if (!row) throw new DomainError("NOT_FOUND", "Task not found");
  return row;
}

export async function loadAssignees(tx: Reader, companyId: string, taskId: string): Promise<TaskAssigneeDTO[]> {
  return tx
    .select({ employeeId: employees.id, fullName: employees.fullName })
    .from(taskAssignees)
    .innerJoin(employees, and(eq(employees.id, taskAssignees.employeeId), eq(employees.companyId, taskAssignees.companyId)))
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.companyId, companyId)))
    .orderBy(asc(employees.fullName), asc(employees.id));
}

export async function loadTaskDTO(tx: Reader, actor: Actor, id: string): Promise<TaskDTO> {
  const row = await loadTask(tx, actor, id);
  return toTaskDTO(row, await loadAssignees(tx, actor.companyId, id));
}

/** Writes task history in the caller's transaction (old/new JSON, secrets stripped). */
export async function logTaskActivity(
  tx: Tx,
  actor: Actor,
  taskId: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown,
): Promise<void> {
  await tx.insert(taskActivityLogs).values({
    companyId: actor.companyId,
    taskId,
    actorId: actor.userId,
    action,
    oldValue: oldValue === undefined ? null : redact(oldValue),
    newValue: newValue === undefined ? null : redact(newValue),
  });
}

