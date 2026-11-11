"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";

export type ForgotState = { done?: boolean; error?: string };

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data, redirectTo: `${env.APP_URL}/reset-password` },
      headers: await headers(),
    });
  } catch {
    // Same response whether or not the account exists or the limiter tripped.
  }
  return { done: true };
}
