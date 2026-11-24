"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { flashed, setFlash } from "@/lib/flash";
import { assignRole, createInvitation, removeRole, resendInvitation, revokeInvitation } from "@/modules/auth";
import { reactivateEmployee, suspendEmployee } from "@/modules/employees";

const ids = z.object({ userId: z.string().min(1), roleId: z.string().uuid() });

// ConfirmForm only accepts (FormData) => void, so a failure is passed back to the page as ?error=.
async function run(fd: FormData, fn: typeof assignRole): Promise<void> {
  const actor = await requireActor();
  const parsed = ids.safeParse({ userId: fd.get("userId"), roleId: fd.get("roleId") });
  const back = String(fd.get("returnTo") ?? "");
  const base = back.startsWith("/settings/users") ? back.split("?")[0] : "/settings/users";
  if (!parsed.success) redirect(`${base}?error=${encodeURIComponent("Choose a role first")}`);
  const r = await toActionResult(() => fn(actor, parsed.data.userId, parsed.data.roleId));
  revalidatePath("/settings/users");
  if (!r.ok) redirect(`${base}?error=${encodeURIComponent(r.error.message)}`);
}

const uuid = z.string().uuid();

/** Invite someone by email with a role (they may or may not be an employee yet). */
export async function inviteUserAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const email = String(fd.get("email") ?? "");
  const r = await flashed(() => createInvitation(actor, { email, roleId: uuid.parse(fd.get("roleId")) }));
  if (r.ok) await setFlash(`Invitation sent to ${email}. Link: ${r.data.acceptUrl}`, "success");
  revalidatePath("/settings/users");
}

export async function resendInvitationAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const r = await flashed(() => resendInvitation(actor, uuid.parse(fd.get("invitationId"))));
  if (r.ok) await setFlash("Invitation resent. The previous link no longer works.", "success");
  revalidatePath("/settings/users");
  const back = String(fd.get("returnTo") ?? "");
  if (back.startsWith("/employees/")) revalidatePath(back.split("?")[0]);
}

export async function revokeInvitationAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  await flashed(() => revokeInvitation(actor, uuid.parse(fd.get("invitationId"))), "Invitation revoked.");
  revalidatePath("/settings/users");
  const back = String(fd.get("returnTo") ?? "");
  if (back.startsWith("/employees/")) revalidatePath(back.split("?")[0]);
}

/** Suspend or reactivate the employee behind a user (same rules as the employee page). */
export async function suspendUserAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const reason = String(fd.get("reason") ?? "").trim() || undefined;
  await flashed(() => suspendEmployee(actor, uuid.parse(fd.get("employeeId")), { reason }), "User suspended.");
  revalidatePath("/settings/users");
}

export async function reactivateUserAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  await flashed(() => reactivateEmployee(actor, uuid.parse(fd.get("employeeId"))), "User reactivated.");
  revalidatePath("/settings/users");
}

export async function addRoleAction(fd: FormData): Promise<void> {
  await run(fd, assignRole);
}

export async function removeRoleAction(fd: FormData): Promise<void> {
  await run(fd, removeRole);
}
