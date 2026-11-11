import "server-only";
import { and, eq } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { clients, projects, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { nextCode } from "@/lib/codes";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { addAssignees, notifyAssigned } from "./assignees";
import { loadTask, loadTaskDTO, logTaskActivity } from "./core";
import type { TaskDTO } from "./dto";
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from "./schemas";

const TRACKED = [
  "title",
  "description",
  "priority",
  "projectId",
  "clientId",
  "startDate",
  "dueDate",
  "estimatedHours",
  "actualHours",
] as const;

/**
 * Resolves and validates project/client. A task's client must equal its project's client
 * (an internal project has none). Without a project, any non-archived company client is allowed.
 */
async function resolveRefs(
  tx: Tx,
  companyId: string,
  projectId: string | null | undefined,
  clientId: string | null | undefined,
): Promise<{ projectId: string | null; clientId: string | null }> {
  if (projectId) {
    const [p] = await tx
      .select({ clientId: projects.clientId, archivedAt: projects.archivedAt })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)));
    if (!p) throw new DomainError("NOT_FOUND", "Project not found");
    if (p.archivedAt) throw new DomainError("VALIDATION", "This project is archived");
    if (clientId && clientId !== p.clientId) {
      throw new DomainError("VALIDATION", "The task's client must match the project's client");
    }
    return { projectId, clientId: p.clientId };
  }
  if (clientId) {
    const [c] = await tx
      .select({ archivedAt: clients.archivedAt })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
    if (!c) throw new DomainError("NOT_FOUND", "Client not found");
    if (c.archivedAt) throw new DomainError("VALIDATION", "This client is archived");
  }
  return { projectId: null, clientId: clientId ?? null };
}

export async function createTask(actor: Actor, input: CreateTaskInput): Promise<TaskDTO> {
  requirePermission(actor, "tasks.create");
  const data = createTaskSchema.parse(input);

  const { dto, assigned } = await withTransaction(async (tx) => {
    const refs = await resolveRefs(tx, actor.companyId, data.projectId, data.clientId);
    const [row] = await tx
      .insert(tasks)
      .values({
        companyId: actor.companyId,
        taskCode: await nextCode(tx, actor.companyId, "TSK"),
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? "Medium",
        projectId: refs.projectId,
        clientId: refs.clientId,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        estimatedHours: data.estimatedHours ?? null,
        actualHours: data.actualHours ?? null,
        createdBy: actor.userId,
      })
      .returning();
    await logTaskActivity(tx, actor, row.id, "created", undefined, { title: row.title, taskCode: row.taskCode });
    const assigned = await addAssignees(tx, actor, row.id, data.assigneeIds ?? []);
    return { dto: await loadTaskDTO(tx, actor, row.id), assigned };
  });

  await notifyAssigned(dto.id, dto.title, assigned); // after commit; never throws
  return dto;
}

export async function updateTask(actor: Actor, id: string, input: UpdateTaskInput): Promise<TaskDTO> {
  requirePermission(actor, "tasks.update");
  const patch = updateTaskSchema.parse(input);

  return withTransaction(async (tx) => {
    const before = await loadTask(tx, actor, id);

    const start = patch.startDate !== undefined ? patch.startDate : before.startDate;
    const due = patch.dueDate !== undefined ? patch.dueDate : before.dueDate;
    if (start && due && start > due) throw new DomainError("VALIDATION", "Due date cannot be before the start date");

    const set: Record<string, unknown> = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (patch.projectId !== undefined || patch.clientId !== undefined) {
      const projectId = patch.projectId !== undefined ? patch.projectId : before.projectId;
      const clientInput =
        patch.clientId !== undefined ? patch.clientId : patch.projectId ? undefined : before.clientId;
      const refs = await resolveRefs(tx, actor.companyId, projectId, clientInput);
      set.projectId = refs.projectId;
      set.clientId = refs.clientId;
    }
    if (Object.keys(set).length === 0) return loadTaskDTO(tx, actor, id);

    const [after] = await tx
      .update(tasks)
      .set(set)
      .where(and(eq(tasks.id, id), eq(tasks.companyId, actor.companyId)))
      .returning();

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const k of TRACKED) {
      if (before[k] !== after[k]) {
        oldValue[k] = before[k];
        newValue[k] = after[k];
      }
    }
    if (Object.keys(newValue).length > 0) await logTaskActivity(tx, actor, id, "updated", oldValue, newValue);
    return loadTaskDTO(tx, actor, id);
  });
}

/** Visibility is decided by scope (assignee / project member / tasks.read.all). */
export async function getTask(actor: Actor, id: string): Promise<TaskDTO> {
  return loadTaskDTO(db, actor, id);
}

export async function archiveTask(actor: Actor, id: string): Promise<TaskDTO> {
  requirePermission(actor, "tasks.archive");
  return withTransaction(async (tx) => {
    const before = await loadTask(tx, actor, id);
    if (before.archivedAt) throw new DomainError("CONFLICT", "Task is already archived");
    await tx
      .update(tasks)
      .set({ archivedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.companyId, actor.companyId)));
    await logTaskActivity(tx, actor, id, "archived");
    return loadTaskDTO(tx, actor, id);
  });
}
