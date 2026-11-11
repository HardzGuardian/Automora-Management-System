"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { toActionResult } from "@/lib/errors";
import { acceptInvitation } from "@/modules/auth";

export type AcceptState = { error?: string; fieldErrors?: Record<string, string[]> };

const schema = z
  .object({
    token: z.string().min(1),
    name: z.string().trim().min(1, "Enter your name").max(100),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function acceptInviteAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }
  const { token, name, password } = parsed.data;
  const result = await toActionResult(() => acceptInvitation({ token, name, password }));
  if (!result.ok) return { error: result.error.message };
  redirect("/login?activated=1");
}
