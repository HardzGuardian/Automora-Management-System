import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import { files, taskAttachments, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { purgeObjects, removeFileRow, saveUpload, type FileAccessChecker } from "@/modules/files";
import { loadTask, logTaskActivity } from "./core";

export type AttachmentDTO = {
  id: string;
  fileId: string;
  name: string;
  mime: string;
  size: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: Date;
};

export async function listAttachments(actor: Actor, taskId: string): Promise<AttachmentDTO[]> {
  await loadTask(db, actor, taskId);
  const rows = await db
    .select({
      id: taskAttachments.id,
      fileId: files.id,
      name: files.originalName,
      mime: files.mimeType,
      size: files.sizeBytes,
      uploadedBy: files.uploadedBy,
      uploadedByName: user.name,
      createdAt: taskAttachments.createdAt,
    })
    .from(taskAttachments)
    .innerJoin(files, and(eq(files.id, taskAttachments.fileId), eq(files.companyId, taskAttachments.companyId)))
    .leftJoin(user, eq(user.id, files.uploadedBy))
    .where(and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.companyId, actor.companyId)))
    .orderBy(asc(taskAttachments.createdAt), asc(taskAttachments.id));
  return rows;
}

export async function attachToTask(
  actor: Actor,
  taskId: string,
  input: { name: string; mime: string; bytes: Buffer },
): Promise<AttachmentDTO> {
  requirePermission(actor, "tasks.attach");
  // Authorise and check the task BEFORE any bytes are stored.
  const pre = await loadTask(db, actor, taskId);
  if (pre.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot receive attachments");

  const file = await saveUpload(actor, input); // validates type, size and signature
  try {
    const id = await withTransaction(async (tx) => {
      await loadTask(tx, actor, taskId);
      const [att] = await tx
        .insert(taskAttachments)
        .values({ companyId: actor.companyId, taskId, fileId: file.id })
        .returning({ id: taskAttachments.id });
      await logTaskActivity(tx, actor, taskId, "attachment_added", undefined, { attachmentId: att.id, name: file.name });
      return att.id;
    });
    return {
      id,
      fileId: file.id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      uploadedBy: actor.userId,
      uploadedByName: null,
      createdAt: file.createdAt,
    };
  } catch (e) {
    // Compensate: never leave a stored file that nothing references.
    const key = await withTransaction((tx) => removeFileRow(tx, actor, file.id)).catch(() => null);
    if (key) await purgeObjects([key]);
    throw e;
  }
}

export async function removeAttachment(actor: Actor, taskId: string, attachmentId: string): Promise<void> {
  const key = await withTransaction(async (tx) => {
    await loadTask(tx, actor, taskId);
    const [row] = await tx
      .select({ id: taskAttachments.id, fileId: taskAttachments.fileId, uploadedBy: files.uploadedBy, name: files.originalName })
      .from(taskAttachments)
      .innerJoin(files, and(eq(files.id, taskAttachments.fileId), eq(files.companyId, taskAttachments.companyId)))
      .where(
        and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, taskId), eq(taskAttachments.companyId, actor.companyId)),
      );
    if (!row) throw new DomainError("NOT_FOUND", "Attachment not found");
    if (row.uploadedBy !== actor.userId && !can(actor, "tasks.update")) {
      throw new DomainError("FORBIDDEN", "You cannot remove this attachment");
    }
    await tx.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));
    const storageKey = await removeFileRow(tx, actor, row.fileId);
    await logTaskActivity(tx, actor, taskId, "attachment_removed", { attachmentId, name: row.name }, undefined);
    return storageKey;
  });
  await purgeObjects([key]); // after commit
}

/** File access rule for task attachments: whoever can see the task can download its files. */
export const canAccessTaskAttachment: FileAccessChecker = async (actor, file) => {
  const links = await db
    .select({ taskId: taskAttachments.taskId })
    .from(taskAttachments)
    .where(and(eq(taskAttachments.fileId, file.id), eq(taskAttachments.companyId, file.companyId)));
  for (const l of links) {
    try {
      await loadTask(db, actor, l.taskId);
      return true;
    } catch {
      // not visible through this task; try the next link
    }
  }
  return false;
};
