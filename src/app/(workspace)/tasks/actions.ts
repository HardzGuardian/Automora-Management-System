"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { archiveTask, changeTaskStatus, logActualHours, setTaskAssignee, unarchiveTask, updateTask } from "@/modules/tasks";

export type TaskFormState = { error?: string; fieldErrors?: Record<string, string[]>; saved?: boolean };
export type MoveResult = { ok: boolean; error?: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: FormDataEntryValue | null) => (str(v).trim() === "" ? null : str(v).trim());
const uuid = z.string().uuid();

export async function updateTaskAction(_prev: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const priority = z.enum(["Low", "Medium", "High"]).parse(str(fd.get("priority")));
  const r = await toActionResult(() =>
    updateTask(actor, id, {
      title: str(fd.get("title")),
      description: nullable(fd.get("description")),
      priority,
      startDate: nullable(fd.get("startDate")),
      dueDate: nullable(fd.get("dueDate")),
      estimatedHours: nullable(fd.get("estimatedHours")),
      actualHours: nullable(fd.get("actualHours")),
    }),
  );
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath(`/tasks/${id}`);
  return { saved: true };
}

/** Used by forms (task page) and by the board's drag-and-drop (returns the outcome). */
export async function moveTaskAction(taskId: string, to: string): Promise<MoveResult> {
  const actor = await requireActor();
  const r = await toActionResult(() => changeTaskStatus(actor, uuid.parse(taskId), to));
  revalidatePath("/my-tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error.message };
}

export async function changeStatusFormAction(fd: FormData): Promise<void> {
  await moveTaskAction(str(fd.get("id")), str(fd.get("to")));
}

export async function assignAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => setTaskAssignee(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/tasks/${id}`);
}

export async function archiveTaskAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => archiveTask(actor, id));
  revalidatePath("/tasks");
  redirect("/tasks");
}


export async function restoreTaskAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => unarchiveTask(actor, id));
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
}

export async function logHoursAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => logActualHours(actor, id, str(fd.get("hours"))));
  revalidatePath(`/tasks/${id}`);
  if (!r.ok) redirect(`/tasks/${id}?error=${encodeURIComponent(r.error.message)}`);
}
