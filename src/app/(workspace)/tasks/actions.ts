"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { DomainError } from "@/lib/errors";
import { archiveTask, assignTask, bulkArchive, bulkAssign, bulkChangeStatus, changeTaskStatus, createTask, logActualHours, setTaskAssignee, unarchiveTask, unassignTask, updateTask } from "@/modules/tasks";
import { flashed, setFlash } from "@/lib/flash";

export type TaskFormState = { error?: string; fieldErrors?: Record<string, string[]>; saved?: boolean };
export type MoveResult = { ok: boolean; error?: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: FormDataEntryValue | null) => (str(v).trim() === "" ? null : str(v).trim());
const uuid = z.string().uuid();

export async function updateTaskAction(_prev: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const priority = z.enum(["Low", "Medium", "High", "Critical"]).parse(str(fd.get("priority")));
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
  await flashed(() => setTaskAssignee(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/tasks/${id}`);
}

export async function archiveTaskAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await flashed(() => archiveTask(actor, id));
  revalidatePath("/tasks");
  redirect("/tasks");
}


export async function restoreTaskAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await flashed(() => unarchiveTask(actor, id));
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

export type CreateTaskState = { error?: string; fieldErrors?: Record<string, string[]> };

/** Full "New task" form: details, dates, hours, client and any number of assignees. */
export async function createTaskAction(_prev: CreateTaskState, fd: FormData): Promise<CreateTaskState> {
  const actor = await requireActor();
  const priority = z.enum(["Low", "Medium", "High", "Critical"]).catch("Medium").parse(str(fd.get("priority")));
  const assigneeIds = fd.getAll("assigneeIds").map(String).filter(Boolean);
  const r = await toActionResult(() =>
    createTask(actor, {
      title: str(fd.get("title")),
      description: nullable(fd.get("description")),
      priority,
      projectId: nullable(fd.get("projectId")),
      clientId: nullable(fd.get("clientId")),
      startDate: nullable(fd.get("startDate")),
      dueDate: nullable(fd.get("dueDate")),
      estimatedHours: nullable(fd.get("estimatedHours")),
      assigneeIds,
    }),
  );
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
  redirect(`/tasks/${r.data.id}`);
}

/** Adds one more person to a task (tasks can have several assignees). */
export async function addAssigneeAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await flashed(() => assignTask(actor, id, [uuid.parse(fd.get("employeeId"))]));
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
}

export async function removeAssigneeAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await flashed(() => unassignTask(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
}

/** Bulk bar on the task list: status / assign / archive for every ticked task. */
export async function bulkTasksAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const ids = fd.getAll("taskId").map(String).filter((v) => uuid.safeParse(v).success);
  const op = str(fd.get("op"));
  const returnTo = str(fd.get("returnTo")).startsWith("/tasks") ? str(fd.get("returnTo")) : "/tasks";
  if (ids.length === 0) {
    await setFlash("Tick at least one task first.", "error");
    redirect(returnTo);
  }
  const r = await flashed(() => {
    if (op === "archive") return bulkArchive(actor, ids);
    if (op === "status") return bulkChangeStatus(actor, ids, str(fd.get("status")));
    if (op === "assign") return bulkAssign(actor, ids, uuid.parse(fd.get("employeeId")));
    throw new DomainError("VALIDATION", "Choose an action");
  });
  if (r.ok) {
    const { succeeded, failed } = r.data;
    const first = r.data.results.find((x) => !x.ok);
    await setFlash(
      failed === 0 ? `${succeeded} task${succeeded === 1 ? "" : "s"} updated.` : `${succeeded} updated, ${failed} failed${first && !first.ok ? `: ${first.error.message}` : ""}`,
      failed === 0 ? "success" : "error",
    );
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect(returnTo);
}
