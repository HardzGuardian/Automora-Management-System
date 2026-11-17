"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { addComment, attachToTask, deleteComment, removeAttachment } from "@/modules/tasks";

const uuid = z.string().uuid();
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export type CollabState = { error?: string; ok?: boolean };

export async function addCommentAction(_prev: CollabState, fd: FormData): Promise<CollabState> {
  const actor = await requireActor();
  const taskId = uuid.parse(fd.get("taskId"));
  const r = await toActionResult(() => addComment(actor, taskId, str(fd.get("body"))));
  if (!r.ok) return { error: r.error.fieldErrors?.body?.[0] ?? r.error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteCommentAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = uuid.parse(fd.get("taskId"));
  await toActionResult(() => deleteComment(actor, uuid.parse(fd.get("commentId"))));
  revalidatePath(`/tasks/${taskId}`);
}

export async function uploadAttachmentAction(_prev: CollabState, fd: FormData): Promise<CollabState> {
  const actor = await requireActor();
  const taskId = uuid.parse(fd.get("taskId"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const r = await toActionResult(() => attachToTask(actor, taskId, { name: file.name, mime: file.type, bytes }));
  if (!r.ok) return { error: r.error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function removeAttachmentAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = uuid.parse(fd.get("taskId"));
  await toActionResult(() => removeAttachment(actor, taskId, uuid.parse(fd.get("attachmentId"))));
  revalidatePath(`/tasks/${taskId}`);
}
