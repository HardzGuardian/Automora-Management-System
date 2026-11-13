"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { createInvitation } from "@/modules/auth";
import { toActionResult } from "@/lib/errors";
import {
  createEmployee,
  deactivateEmployee,
  reactivateEmployee,
  suspendEmployee,
} from "@/modules/employees";

export type EmployeeFormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createEmployeeAction(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const actor = await requireActor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const result = await toActionResult(() =>
    createEmployee(actor, {
      fullName: raw.fullName ?? "",
      workEmail: raw.workEmail ?? "",
      phone: raw.phone ?? null,
      designation: raw.designation ?? null,
      department: raw.department ?? null,
      joiningDate: raw.joiningDate ? raw.joiningDate : null,
    }),
  );
  if (!result.ok) return { error: result.error.message, fieldErrors: result.error.fieldErrors };
  revalidatePath("/employees");
  redirect(`/employees/${result.data.id}`);
}

const idSchema = z.string().uuid();

async function lifecycle(formData: FormData, op: "deactivate" | "suspend" | "reactivate"): Promise<void> {
  const actor = await requireActor();
  const parsedId = idSchema.safeParse(formData.get("id"));
  if (!parsedId.success) redirect("/employees");
  const id = parsedId.data;
  const reason = String(formData.get("reason") ?? "") || undefined;
  const result = await toActionResult(() =>
    op === "deactivate"
      ? deactivateEmployee(actor, id, { reason })
      : op === "suspend"
        ? suspendEmployee(actor, id, { reason })
        : reactivateEmployee(actor, id),
  );
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  // Show why it failed (e.g. "At least one active Super Admin must remain") instead of doing nothing.
  if (!result.ok) redirect(`/employees/${id}?error=${encodeURIComponent(result.error.message)}`);
}

export async function deactivateAction(formData: FormData): Promise<void> {
  await lifecycle(formData, "deactivate");
}
export async function suspendAction(formData: FormData): Promise<void> {
  await lifecycle(formData, "suspend");
}
export async function reactivateAction(formData: FormData): Promise<void> {
  await lifecycle(formData, "reactivate");
}

export type InviteState = { error?: string; acceptUrl?: string };

export async function inviteEmployeeAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const actor = await requireActor();
  const parsed = z
    .object({ employeeId: z.string().uuid(), roleId: z.string().uuid(), email: z.string().email() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a role." };
  const result = await toActionResult(() =>
    createInvitation(actor, { email: parsed.data.email, roleId: parsed.data.roleId, employeeId: parsed.data.employeeId }),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { acceptUrl: result.data.acceptUrl };
}
