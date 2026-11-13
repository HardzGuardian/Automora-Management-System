"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { AUTH_LIMITS, allowAll, clientIp } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";

export type ForgotState = { done?: boolean; error?: string };

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const allowed = await allowAll([
    { key: `forgot:ip:${await clientIp()}`, ...AUTH_LIMITS.forgotIp },
    { key: `forgot:email:${parsed.data.trim().toLowerCase()}`, ...AUTH_LIMITS.forgotEmail },
  ]);
  // Same response either way, so the limiter cannot be used to discover accounts.
  if (!allowed) return { done: true };
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
