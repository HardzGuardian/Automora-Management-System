"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { AUTH_LIMITS, clientIp, consumeRateLimit, isRateLimited } from "@/lib/auth/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  // Server actions call auth.api directly, which skips Better Auth's HTTP rate limiter, so limit here.
  // Only FAILED attempts count (brute force), so a whole office behind one IP can still sign in.
  const email = parsed.data.email.trim().toLowerCase();
  const ip = await clientIp();
  const ipKey = { key: `sign-in-failed:ip:${ip}`, ...AUTH_LIMITS.signInIp };
  const emailKey = { key: `sign-in-failed:email:${email}`, ...AUTH_LIMITS.signInEmail };
  const limited =
    (await isRateLimited(ipKey.key, ipKey.limit, ipKey.windowMs)) || (await isRateLimited(emailKey.key, emailKey.limit, emailKey.windowMs));
  if (limited) return { error: "Too many failed attempts. Please wait a few minutes and try again." };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (e) {
    await Promise.all([
      consumeRateLimit(ipKey.key, ipKey.limit, ipKey.windowMs),
      consumeRateLimit(emailKey.key, emailKey.limit, emailKey.windowMs),
    ]);
    if (e instanceof APIError && e.statusCode === 429) {
      return { error: "Too many attempts. Please wait a minute and try again." };
    }
    if (e instanceof APIError && e.statusCode === 403) {
      return { error: "This account is suspended. Contact your administrator." };
    }
    return { error: "Invalid email or password." };
  }
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
