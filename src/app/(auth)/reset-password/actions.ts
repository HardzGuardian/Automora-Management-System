"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";

export type ResetState = { error?: string };

const schema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError && e.statusCode === 429) return { error: "Too many attempts. Try again in a minute." };
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  redirect("/login?activated=1");
}
