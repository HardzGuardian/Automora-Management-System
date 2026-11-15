import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, projectClientItems, projectComments, projectMembers, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { requirePermission } from "@/lib/permissions";
import { loadProject } from "./service";

export type ProjectCommentDTO = { id: string; authorName: string; body: string; createdAt: Date };
export type ClientItemDTO = { id: string; title: string; detail: string | null; received: boolean; receivedAt: Date | null };

const MAX_COMMENT = 2000;
const MAX_TITLE = 160;
const MAX_DETAIL = 500;

/** Tells everyone on the project except the person who did it. Runs after the change is saved and never fails it. */
export async function notifyProjectMembers(
  actor: Actor,
  projectId: string,
  event: { type: string; title: string; body?: string; eventKey: string },
): Promise<void> {
  const rows = await db
    .select({ userId: employees.userId })
    .from(projectMembers)
    .innerJoin(employees, and(eq(employees.id, projectMembers.employeeId), eq(employees.companyId, projectMembers.companyId)))
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.companyId, actor.companyId)));
  const userIds = rows.map((r) => r.userId).filter((id): id is string => Boolean(id) && id !== actor.userId);
  if (userIds.length === 0) return;
  await notify({ ...event, userIds, entity: { type: "project", id: projectId } });
}

/** Comments: anyone who can see the project and may comment on work can read and post. */
export async function listProjectComments(actor: Actor, projectId: string): Promise<ProjectCommentDTO[]> {
  await loadProject(db, actor, projectId);
  return db
    .select({ id: projectComments.id, authorName: user.name, body: projectComments.body, createdAt: projectComments.createdAt })
    .from(projectComments)
    .innerJoin(user, eq(user.id, projectComments.authorId))
    .where(and(eq(projectComments.projectId, projectId), eq(projectComments.companyId, actor.companyId)))
    .orderBy(desc(projectComments.createdAt), desc(projectComments.id))
    .limit(200);
}

export async function addProjectComment(actor: Actor, projectId: string, body: string): Promise<void> {
  requirePermission(actor, "tasks.comment");
  const text = body.trim();
  if (!text) throw new DomainError("VALIDATION", "Write a comment first.");
  if (text.length > MAX_COMMENT) throw new DomainError("VALIDATION", `Comments can be up to ${MAX_COMMENT} characters.`);
  const project = await loadProject(db, actor, projectId);
  if (project.archivedAt) throw new DomainError("VALIDATION", "Archived projects cannot be commented on.");
  const [row] = await db
    .insert(projectComments)
    .values({ companyId: actor.companyId, projectId, authorId: actor.userId, body: text })
    .returning({ id: projectComments.id });
  await notifyProjectMembers(actor, projectId, {
    type: "comment.project",
    title: `New comment on ${project.name}`,
    body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    eventKey: `project:${projectId}:comment:${row.id}`,
  });
}

/** Client input: what the team is waiting for. Everyone on the project sees it; people who can update the project change it. */
export async function listClientItems(actor: Actor, projectId: string): Promise<ClientItemDTO[]> {
  await loadProject(db, actor, projectId);
  const rows = await db
    .select()
    .from(projectClientItems)
    .where(and(eq(projectClientItems.projectId, projectId), eq(projectClientItems.companyId, actor.companyId)))
    .orderBy(asc(projectClientItems.createdAt), asc(projectClientItems.id));
  return rows.map((r) => ({ id: r.id, title: r.title, detail: r.detail, received: r.receivedAt !== null, receivedAt: r.receivedAt }));
}

export async function addClientItem(actor: Actor, projectId: string, input: { title: string; detail?: string | null }): Promise<void> {
  requirePermission(actor, "projects.update");
  const title = input.title.trim();
  if (!title) throw new DomainError("VALIDATION", "Say what you are waiting for.");
  if (title.length > MAX_TITLE) throw new DomainError("VALIDATION", `The title can be up to ${MAX_TITLE} characters.`);
  const detail = input.detail?.trim() || null;
  if (detail && detail.length > MAX_DETAIL) throw new DomainError("VALIDATION", `The note can be up to ${MAX_DETAIL} characters.`);
  const project = await loadProject(db, actor, projectId);
  if (project.archivedAt) throw new DomainError("VALIDATION", "Archived projects cannot be changed.");
  await db.insert(projectClientItems).values({ companyId: actor.companyId, projectId, title, detail });
}

export async function setClientItemReceived(actor: Actor, projectId: string, itemId: string, received: boolean): Promise<void> {
  requirePermission(actor, "projects.update");
  await loadProject(db, actor, projectId);
  const updated = await db
    .update(projectClientItems)
    .set({ receivedAt: received ? new Date() : null })
    .where(and(eq(projectClientItems.id, itemId), eq(projectClientItems.projectId, projectId), eq(projectClientItems.companyId, actor.companyId)))
    .returning({ id: projectClientItems.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "That item was not found.");
}
