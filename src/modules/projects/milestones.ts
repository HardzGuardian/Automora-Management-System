import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction } from "@/db";
import { MILESTONE_STATUSES, projectMilestones } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { loadProject } from "./service";

export type MilestoneDTO = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  completedAt: Date | null;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .strict();
const updateSchema = createSchema.partial().extend({ status: z.enum(MILESTONE_STATUSES).optional() }).strict();

export type CreateMilestoneInput = z.input<typeof createSchema>;
export type UpdateMilestoneInput = z.input<typeof updateSchema>;

const toDTO = (r: typeof projectMilestones.$inferSelect): MilestoneDTO => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  description: r.description,
  dueDate: r.dueDate,
  status: r.status,
  completedAt: r.completedAt,
});

export async function listMilestones(actor: Actor, projectId: string): Promise<MilestoneDTO[]> {
  await loadProject(db, actor, projectId);
  const rows = await db
    .select()
    .from(projectMilestones)
    .where(and(eq(projectMilestones.projectId, projectId), eq(projectMilestones.companyId, actor.companyId)))
    .orderBy(sql`${projectMilestones.dueDate} ASC NULLS LAST`, asc(projectMilestones.createdAt), asc(projectMilestones.id));
  return rows.map(toDTO);
}

export async function createMilestone(actor: Actor, projectId: string, input: CreateMilestoneInput): Promise<MilestoneDTO> {
  requirePermission(actor, "projects.milestones.manage");
  const data = createSchema.parse(input);
  return withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    const [row] = await tx
      .insert(projectMilestones)
      .values({
        companyId: actor.companyId,
        projectId,
        name: data.name,
        description: data.description ?? null,
        dueDate: data.dueDate ?? null,
      })
      .returning();
    await audit.record(tx, { actor, entity: "project", entityId: projectId, action: "milestone.created", after: toDTO(row) });
    return toDTO(row);
  });
}

async function loadMilestone(tx: Pick<typeof db, "select">, actor: Actor, projectId: string, id: string) {
  await loadProject(tx, actor, projectId);
  const [m] = await tx
    .select()
    .from(projectMilestones)
    .where(
      and(eq(projectMilestones.id, id), eq(projectMilestones.projectId, projectId), eq(projectMilestones.companyId, actor.companyId)),
    );
  if (!m) throw new DomainError("NOT_FOUND", "Milestone not found");
  return m;
}

export async function updateMilestone(
  actor: Actor,
  projectId: string,
  id: string,
  input: UpdateMilestoneInput,
): Promise<MilestoneDTO> {
  requirePermission(actor, "projects.milestones.manage");
  const patch = updateSchema.parse(input);
  return withTransaction(async (tx) => {
    const before = await loadMilestone(tx, actor, projectId, id);
    const set: Partial<typeof projectMilestones.$inferInsert> = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (patch.status && patch.status !== before.status) {
      set.completedAt = patch.status === "Completed" ? new Date() : null;
    }
    const [row] = await tx.update(projectMilestones).set(set).where(eq(projectMilestones.id, id)).returning();
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: patch.status && patch.status !== before.status ? "milestone.status_changed" : "milestone.updated",
      before: toDTO(before),
      after: toDTO(row),
    });
    return toDTO(row);
  });
}

export async function deleteMilestone(actor: Actor, projectId: string, id: string): Promise<void> {
  requirePermission(actor, "projects.milestones.manage");
  await withTransaction(async (tx) => {
    const before = await loadMilestone(tx, actor, projectId, id);
    await tx.delete(projectMilestones).where(eq(projectMilestones.id, id));
    await audit.record(tx, { actor, entity: "project", entityId: projectId, action: "milestone.deleted", before: toDTO(before) });
  });
}
