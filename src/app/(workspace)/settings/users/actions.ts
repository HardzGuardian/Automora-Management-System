"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { assignRole, removeRole } from "@/modules/auth";

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

export async function addRoleAction(fd: FormData): Promise<void> {
  await run(fd, assignRole);
}

export async function removeRoleAction(fd: FormData): Promise<void> {
  await run(fd, removeRole);
}
