"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { createTask, quickTaskOptions, type QuickTaskOptions } from "@/modules/tasks";

// Shapes the panel (a component, which never imports modules) is written against.

export type QuickTaskInput = { title: string; projectId: string; assigneeId: string; dueDate: string; priority: string };
export type QuickTaskResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Loaded when the panel opens, so the page shell stays cheap for everyone who never opens it. */
export async function loadQuickTaskOptions(): Promise<{ ok: true; options: QuickTaskOptions } | { ok: false; error: string }> {
  const actor = await requireActor();
  const r = await toActionResult(() => quickTaskOptions(actor));
  return r.ok ? { ok: true, options: r.data } : { ok: false, error: r.error.message };
}

export async function createQuickTaskAction(input: QuickTaskInput): Promise<QuickTaskResult> {
  const actor = await requireActor();
  const priority = z.enum(["Low", "Medium", "High"]).catch("Medium").parse(input.priority);
  const r = await toActionResult(() =>
    createTask(actor, {
      title: input.title,
      priority,
      projectId: input.projectId || null,
      dueDate: input.dueDate || null,
      assigneeIds: input.assigneeId ? [input.assigneeId] : [],
    }),
  );
  if (!r.ok) return { ok: false, error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}
