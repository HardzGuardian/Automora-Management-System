import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";

/**
 * Fixed-window rate limiter on the shared `rate_limit` table (so it holds across instances).
 * Keys are prefixed "app:" so they never collide with Better Auth's own entries.
 * Returns true when the request is allowed. The increment is a single atomic upsert.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const k = `app:${key}`;
  const windowStart = now - windowMs;
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit (id, key, count, last_request)
    VALUES (${randomUUID()}, ${k}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit.last_request <= ${windowStart} THEN 1 ELSE rate_limit.count + 1 END,
      last_request = CASE WHEN rate_limit.last_request <= ${windowStart} THEN ${now} ELSE rate_limit.last_request END
    RETURNING count
  `);
  return Number(result.rows[0].count) <= limit;
}

/** Read-only: true when the key has already used up its allowance in the current window. */
export async function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const result = await db.execute<{ count: number; last_request: number }>(sql`
    SELECT count, last_request FROM rate_limit WHERE key = ${`app:${key}`}
  `);
  const row = result.rows[0];
  if (!row) return false;
  return Number(row.last_request) > now - windowMs && Number(row.count) >= limit;
}

/** Client IP for rate-limit keys: first X-Forwarded-For hop (the proxy must overwrite it), else X-Real-IP. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const MIN = 60_000;
export const AUTH_LIMITS = {
  // failed sign-ins only
  signInIp: { limit: 20, windowMs: 15 * MIN },
  signInEmail: { limit: 5, windowMs: 15 * MIN },
  forgotIp: { limit: 3, windowMs: MIN },
  forgotEmail: { limit: 3, windowMs: 60 * MIN },
  resetIp: { limit: 5, windowMs: MIN },
} as const;

/** All checks must pass; each one is counted even if another fails (an attacker cannot dodge counting). */
export async function allowAll(checks: { key: string; limit: number; windowMs: number }[]): Promise<boolean> {
  const results = await Promise.all(checks.map((c) => consumeRateLimit(c.key, c.limit, c.windowMs)));
  return results.every(Boolean);
}
