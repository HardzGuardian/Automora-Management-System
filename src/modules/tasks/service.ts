import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { clients, projectMembers, projects, taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { nextCode } from "@/lib/codes";
import { DomainError } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
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

/**
 * The "create tasks in projects they are on" rule for people without tasks.create (employees): the task must
 * sit in a project where they are an owner or member, and may only be given to people on that same project.
 * With nobody chosen it is assigned to the creator. Returns the assignee ids to use.
 */
async function memberTaskAssignees(tx: Tx, actor: Actor, projectId: string | null | undefined, chosen: string[]): Promise<string[]> {
  if (!projectId) throw new DomainError("VALIDATION", "Choose the project this task belongs to");
  if (!actor.employeeId) throw new DomainError("FORBIDDEN", "Only people with an employee profile can create tasks");
  const people = await tx
    .select({ employeeId: projectMembers.employeeId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.companyId, actor.companyId),
        inArray(projectMembers.membershipRole, ["owner", "member"]),
      ),
    );
  const onProject = new Set(people.map((p) => p.employeeId));
  if (!onProject.has(actor.employeeId)) throw new DomainError("FORBIDDEN", "You can only create tasks in projects you are on");
  const ids = chosen.length > 0 ? [...new Set(chosen)] : [actor.employeeId];
  if (ids.some((id) => !onProject.has(id))) {
    throw new DomainError("VALIDATION", "You can only give a task to people who are on this project");
  }
  return ids;
}

export async function createTask(actor: Actor, input: CreateTaskInput): Promise<TaskDTO> {
  const full = can(actor, "tasks.create");
  if (!full) requirePermission(actor, "tasks.create.in_project");
  const data = createTaskSchema.parse(input);
  if (full && (data.assigneeIds ?? []).length > 0) requirePermission(actor, "tasks.assign");

  const { dto, assigned } = await withTransaction(async (tx) => {
    const assigneeIds = full ? (data.assigneeIds ?? []) : await memberTaskAssignees(tx, actor, data.projectId, data.assigneeIds ?? []);
    // The client always comes from the project for employee-created tasks.
    const refs = await resolveRefs(tx, actor.companyId, data.projectId, full ? data.clientId : undefined);
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
    const assigned = await addAssignees(tx, actor, row.id, assigneeIds);
    return { dto: await loadTaskDTO(tx, actor, row.id), assigned };
  });

  // Nobody needs a notification for assigning a task to themselves.
  await notifyAssigned(dto.id, dto.title, full ? assigned : assigned.filter((a) => a.employeeId !== actor.employeeId)); // after commit; never throws
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

/**
 * The person doing the task records the time they spent (a total, not an addition). Managers can do it
 * on any task; everyone else only on a task assigned to them.
 */
export async function logActualHours(actor: Actor, taskId: string, hoursInput: string): Promise<void> {
  const hours = hoursInput.trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(hours)) throw new DomainError("VALIDATION", "Enter the hours as a number, for example 2.5.");
  await withTransaction(async (tx) => {
    const before = await loadTask(tx, actor, taskId);
    if (before.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot be changed.");
    if (!can(actor, "tasks.update")) {
      requirePermission(actor, "tasks.status.update.own");
      const mine = actor.employeeId
        ? await tx
            .select({ id: taskAssignees.employeeId })
            .from(taskAssignees)
            .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, actor.employeeId)))
        : [];
      if (mine.length === 0) throw new DomainError("FORBIDDEN", "You can only log time on your own tasks.");
    }
    await tx.update(tasks).set({ actualHours: hours }).where(and(eq(tasks.id, taskId), eq(tasks.companyId, actor.companyId)));
    await logTaskActivity(tx, actor, taskId, "updated", { actualHours: before.actualHours }, { actualHours: hours });
  });
}

export async function unarchiveTask(actor: Actor, id: string): Promise<TaskDTO> {
  requirePermission(actor, "tasks.archive");
  return withTransaction(async (tx) => {
    const before = await loadTask(tx, actor, id);
    if (!before.archivedAt) throw new DomainError("CONFLICT", "Task is not archived");
    await tx.update(tasks).set({ archivedAt: null }).where(and(eq(tasks.id, id), eq(tasks.companyId, actor.companyId)));
    await logTaskActivity(tx, actor, id, "restored");
    return loadTaskDTO(tx, actor, id);
  });
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
