import "server-only";
import { and, asc, count, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { clients, projectMembers, projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { nextCode } from "@/lib/codes";
import { DomainError } from "@/lib/errors";
import { projectScope, requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { assertAssignable } from "@/modules/employees";
import { toProjectDTO, type ProjectDTO } from "./dto";
import {
  createProjectSchema,
  listProjectsSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ListProjectsInput,
  type UpdateProjectInput,
} from "./schemas";
import { canTransition, type ProjectStatus } from "./status";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Loads through scope (members/read.all); anything else is NOT_FOUND. */
export async function loadProject(tx: Pick<Tx, "select">, actor: Actor, id: string) {
  const [row] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), projectScope(actor)));
  if (!row) throw new DomainError("NOT_FOUND", "Project not found");
  return row;
}

export async function createProject(actor: Actor, input: CreateProjectInput): Promise<ProjectDTO> {
  requirePermission(actor, "projects.create");
  const data = createProjectSchema.parse(input);
  if (data.type === "Client" && !data.clientId) {
    throw new DomainError("VALIDATION", "A client project needs a client");
  }
  if (data.type === "Internal" && data.clientId) {
    throw new DomainError("VALIDATION", "An internal project cannot have a client");
  }

  return withTransaction(async (tx) => {
    if (data.clientId) {
      const [client] = await tx
        .select({ archivedAt: clients.archivedAt })
        .from(clients)
        .where(and(eq(clients.id, data.clientId), eq(clients.companyId, actor.companyId)));
      if (!client) throw new DomainError("NOT_FOUND", "Client not found");
      if (client.archivedAt) throw new DomainError("VALIDATION", "This client is archived");
    }
    await assertAssignable(tx, actor.companyId, data.ownerEmployeeId);

    const [row] = await tx
      .insert(projects)
      .values({
        companyId: actor.companyId,
        projectCode: await nextCode(tx, actor.companyId, "PRJ"),
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        clientId: data.clientId ?? null,
        ownerEmployeeId: data.ownerEmployeeId,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        budgetAmount: data.budgetAmount ?? null,
        ...(data.currency ? { currency: data.currency } : {}),
      })
      .returning();
    await tx.insert(projectMembers).values({
      projectId: row.id,
      companyId: actor.companyId,
      employeeId: data.ownerEmployeeId,
      membershipRole: "owner",
    });
    const dto = toProjectDTO(row, actor);
    await audit.record(tx, { actor, entity: "project", entityId: row.id, action: "project.created", after: dto });
    return dto;
  });
}

export async function updateProject(actor: Actor, id: string, input: UpdateProjectInput): Promise<ProjectDTO> {
  requirePermission(actor, "projects.update");
  const patch = updateProjectSchema.parse(input);
  return withTransaction(async (tx) => {
    const before = await loadProject(tx, actor, id);
    const start = patch.startDate !== undefined ? patch.startDate : before.startDate;
    const due = patch.dueDate !== undefined ? patch.dueDate : before.dueDate;
    if (start && due && start > due) {
      throw new DomainError("VALIDATION", "Due date cannot be before the start date");
    }
    const [row] = await tx
      .update(projects)
      .set(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      .where(and(eq(projects.id, id), eq(projects.companyId, actor.companyId)))
      .returning();
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: id,
      action: "project.updated",
      before: toProjectDTO(before),
      after: toProjectDTO(row),
    });
    return toProjectDTO(row, actor);
  });
}

export async function changeProjectStatus(actor: Actor, id: string, to: ProjectStatus): Promise<ProjectDTO> {
  requirePermission(actor, to === "Archived" ? "projects.archive" : "projects.update");
  return withTransaction(async (tx) => {
    const before = await loadProject(tx, actor, id);
    if (!canTransition(before.status, to)) {
      throw new DomainError("CONFLICT", `A project cannot move from ${before.status} to ${to}`);
    }
    const updated = await tx
      .update(projects)
      .set({ status: to, archivedAt: to === "Archived" ? new Date() : before.archivedAt })
      .where(and(eq(projects.id, id), eq(projects.companyId, actor.companyId), eq(projects.status, before.status)))
      .returning();
    if (updated.length === 0) throw new DomainError("CONFLICT", "The project was changed by someone else; reload and retry");
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: id,
      action: "project.status_changed",
      before: { status: before.status },
      after: { status: to },
    });
    return toProjectDTO(updated[0], actor);
  });
}

export async function getProject(actor: Actor, id: string): Promise<ProjectDTO> {
  return toProjectDTO(await loadProject(db, actor, id), actor);
}

export async function listProjects(
  actor: Actor,
  input: ListProjectsInput,
): Promise<{ rows: ProjectDTO[]; total: number }> {
  const f = listProjectsSchema.parse(input);
  const conds: SQL[] = [projectScope(actor)];
  if (!f.includeArchived) conds.push(isNull(projects.archivedAt));
  if (f.status) conds.push(eq(projects.status, f.status));
  if (f.type) conds.push(eq(projects.type, f.type));
  if (f.clientId) conds.push(eq(projects.clientId, f.clientId));
  if (f.search) {
    const p = `%${escapeLike(f.search)}%`;
    conds.push(or(ilike(projects.name, p), ilike(projects.projectCode, p))!);
  }
  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(asc(projects.name), asc(projects.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(projects).where(where),
  ]);
  return { rows: rows.map((r) => toProjectDTO(r, actor)), total };
}
