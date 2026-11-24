import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction, type Tx } from "@/db";
import { employees, taskAssignees, taskComments, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { can, requirePermission } from "@/lib/permissions";
import { loadTask, logTaskActivity } from "./core";

export type CommentDTO = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  edited: boolean;
  createdAt: Date;
};

const bodySchema = z.string().trim().min(1, "Write a comment").max(4000);

type Row = typeof taskComments.$inferSelect;
const toDTO = (r: Row, authorName: string): CommentDTO => ({
  id: r.id,
  taskId: r.taskId,
  authorId: r.authorId,
  authorName,
  body: r.body,
  edited: r.updatedAt.getTime() - r.createdAt.getTime() > 1000,
  createdAt: r.createdAt,
});

async function authorName(tx: Pick<Tx, "select">, userId: string): Promise<string> {
  const [u] = await tx.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return u?.name ?? "Unknown";
}

/** A comment is reachable only through a task the actor can see. */
async function loadComment(tx: Tx, actor: Actor, id: string) {
  const [c] = await tx
    .select()
    .from(taskComments)
    .where(and(eq(taskComments.id, id), eq(taskComments.companyId, actor.companyId), isNull(taskComments.deletedAt)));
  if (!c) throw new DomainError("NOT_FOUND", "Comment not found");
  const task = await loadTask(tx, actor, c.taskId);
  return { comment: c, task };
}

export async function listComments(actor: Actor, taskId: string): Promise<CommentDTO[]> {
  await loadTask(db, actor, taskId);
  const rows = await db
    .select({ c: taskComments, name: user.name })
    .from(taskComments)
    .innerJoin(user, eq(user.id, taskComments.authorId))
    .where(and(eq(taskComments.taskId, taskId), eq(taskComments.companyId, actor.companyId), isNull(taskComments.deletedAt)))
    .orderBy(asc(taskComments.createdAt), asc(taskComments.id));
  return rows.map((r) => toDTO(r.c, r.name));
}

export async function addComment(actor: Actor, taskId: string, body: string): Promise<CommentDTO> {
  requirePermission(actor, "tasks.comment");
  const text = bodySchema.parse(body);
  const { dto, task } = await withTransaction(async (tx) => {
    const task = await loadTask(tx, actor, taskId);
    if (task.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot be commented on");
    const [row] = await tx
      .insert(taskComments)
      .values({ companyId: actor.companyId, taskId, authorId: actor.userId, body: text })
      .returning();
    // History records that a comment exists, never its text.
    await logTaskActivity(tx, actor, taskId, "comment_added", undefined, { commentId: row.id });
    return { dto: toDTO(row, await authorName(tx, actor.userId)), task };
  });
  await notifyTaskComment(actor, task, dto);
  return dto;
}

/** Tells the task's assignees and its creator about a new comment (not the author). After commit; never throws. */
async function notifyTaskComment(actor: Actor, task: { id: string; title: string; createdBy: string | null }, comment: CommentDTO): Promise<void> {
  try {
    const rows = await db
      .select({ userId: employees.userId })
      .from(taskAssignees)
      .innerJoin(employees, and(eq(employees.id, taskAssignees.employeeId), eq(employees.companyId, taskAssignees.companyId)))
      .where(and(eq(taskAssignees.taskId, task.id), eq(taskAssignees.companyId, actor.companyId)));
    const ids = new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)));
    if (task.createdBy) ids.add(task.createdBy);
    ids.delete(actor.userId);
    if (ids.size === 0) return;
    await notify({
      type: "comment.task",
      userIds: [...ids],
      entity: { type: "task", id: task.id },
      eventKey: `task:${task.id}:comment:${comment.id}`,
      title: `New comment on ${task.title}`,
      body: comment.body.length > 120 ? `${comment.body.slice(0, 117)}…` : comment.body,
    });
  } catch {
    // a failed notification never fails the comment
  }
}

export async function editComment(actor: Actor, commentId: string, body: string): Promise<CommentDTO> {
  requirePermission(actor, "tasks.comment");
  const text = bodySchema.parse(body);
  return withTransaction(async (tx) => {
    const { comment, task } = await loadComment(tx, actor, commentId);
    if (comment.authorId !== actor.userId) throw new DomainError("FORBIDDEN", "You can only edit your own comments");
    const [row] = await tx.update(taskComments).set({ body: text }).where(eq(taskComments.id, commentId)).returning();
    await logTaskActivity(tx, actor, task.id, "comment_edited", undefined, { commentId });
    return toDTO(row, await authorName(tx, actor.userId));
  });
}

/** Authors can delete their own comments; tasks.update holders can moderate. Soft delete. */
export async function deleteComment(actor: Actor, commentId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { comment, task } = await loadComment(tx, actor, commentId);
    const own = comment.authorId === actor.userId;
    if (!(own && can(actor, "tasks.comment")) && !can(actor, "tasks.update")) {
      throw new DomainError("FORBIDDEN", "You cannot delete this comment");
    }
    await tx.update(taskComments).set({ deletedAt: new Date() }).where(eq(taskComments.id, commentId));
    await logTaskActivity(tx, actor, task.id, "comment_deleted", undefined, { commentId });
  });
}
