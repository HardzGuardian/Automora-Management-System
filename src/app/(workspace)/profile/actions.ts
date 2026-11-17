"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { toActionResult } from "@/lib/errors";
import { changePassword, revokeSession } from "@/modules/auth";

export type PasswordState = { error?: string; ok?: boolean };

const schema = z
  .object({ current: z.string().min(1), next: z.string().min(10, "Use at least 10 characters"), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const actor = await requireActor();
  const current = (await getSession())?.session.id;
  const result = await toActionResult(() =>
    changePassword(actor, { current: parsed.data.current, next: parsed.data.next, keepSessionId: current }),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().min(1).parse(formData.get("sessionId"));
  await toActionResult(() => revokeSession(actor, id));
  revalidatePath("/profile");
}
