"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import {
  archiveTask,
  assignTask,
  changeTaskStatus,
  createTask,
  unassignTask,
  updateTask,
} from "@/modules/tasks";

export type TaskFormState = { error?: string; fieldErrors?: Record<string, string[]>; saved?: boolean };
export type MoveResult = { ok: boolean; error?: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: FormDataEntryValue | null) => (str(v).trim() === "" ? null : str(v).trim());
const uuid = z.string().uuid();

export async function createTaskAction(_prev: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const actor = await requireActor();
  const priority = z.enum(["Low", "Medium", "High", "Urgent"]).catch("Medium").parse(str(fd.get("priority")));
  const r = await toActionResult(() =>
    createTask(actor, {
      title: str(fd.get("title")),
      description: nullable(fd.get("description")),
      priority,
      projectId: nullable(fd.get("projectId")),
      startDate: nullable(fd.get("startDate")),
      dueDate: nullable(fd.get("dueDate")),
      estimatedHours: nullable(fd.get("estimatedHours")),
      assigneeIds: fd.getAll("assigneeIds").map(String).filter(Boolean),
    }),
  );
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  redirect(`/tasks/${r.data.id}`);
}

export async function updateTaskAction(_prev: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const priority = z.enum(["Low", "Medium", "High", "Urgent"]).parse(str(fd.get("priority")));
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
  await toActionResult(() => assignTask(actor, id, [uuid.parse(fd.get("employeeId"))]));
  revalidatePath(`/tasks/${id}`);
}

export async function unassignAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => unassignTask(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/tasks/${id}`);
}

export async function archiveTaskAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => archiveTask(actor, id));
  revalidatePath("/tasks");
  redirect("/tasks");
}
