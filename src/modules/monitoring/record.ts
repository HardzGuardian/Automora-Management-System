import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { securityEvents, user, type SecurityEventType } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { redact } from "@/modules/audit";

export type SecurityEventInput = {
  type: SecurityEventType;
  companyId?: string | null;
  actorId?: string | null;
  subject?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
};

/**
 * Writes one monitoring event. It never throws: a problem in the monitoring log must not break a
 * sign-in, a permission check or a scheduled job. Sensitive keys are stripped from `detail`.
 */
export async function recordSecurityEvent(e: SecurityEventInput): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      type: e.type,
      companyId: e.companyId ?? null,
      actorId: e.actorId ?? null,
      subject: e.subject?.slice(0, 200) ?? null,
      ip: e.ip?.slice(0, 64) ?? null,
      detail: e.detail ? redact(e.detail) : null,
    });
  } catch (err) {
    logger.error("could not record security event", { type: e.type, err });
  }
}

export type LoginFailureReason = "invalid" | "suspended" | "too_many_attempts";

/**
 * A failed or blocked sign-in. When the email belongs to a user the event is attributed to their
 * company; an unknown email is recorded without one (a probe, or a typo).
 */
export async function recordLoginFailure(input: { email: string; ip: string | null; reason: LoginFailureReason }): Promise<void> {
  let companyId: string | null = null;
  let actorId: string | null = null;
  try {
    const email = input.email.trim().toLowerCase();
    const [u] = await db.select({ id: user.id, companyId: user.companyId }).from(user).where(eq(sql`lower(${user.email})`, email)).limit(1);
    companyId = u?.companyId ?? null;
    actorId = u?.id ?? null;
  } catch {
    // attribution is best effort
  }
  await recordSecurityEvent({
    type: input.reason === "too_many_attempts" ? "login_blocked" : "login_failed",
    companyId,
    actorId,
    subject: input.email.trim().toLowerCase(),
    ip: input.ip,
    detail: { reason: input.reason },
  });
}

/**
 * Runs a scheduled job and records it when it throws or reports failed items, then lets the result
 * (or the error) through unchanged so the route still answers 207/500 as before.
 */
export async function runMonitoredJob<T extends { failures: unknown[] }>(job: string, run: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (e) {
    await recordJobFailure(job, e instanceof Error ? e.message : String(e));
    throw e;
  }
  if (result.failures.length > 0) await recordJobFailure(job, `${result.failures.length} item(s) failed`, { failures: result.failures.length });
  return result;
}

/** A scheduled job that failed. Jobs run for the whole installation, so there is no company. */
export async function recordJobFailure(job: string, message: string, detail?: Record<string, unknown>): Promise<void> {
  await recordSecurityEvent({ type: "job_failed", subject: job, detail: { message: message.slice(0, 500), ...detail } });
}

// One event per person and permission per minute: a page that is refreshed, or a script probing the
// same URL, must not fill the log.
const DENIAL_WINDOW_MS = 60_000;
const DENIAL_MAX_TRACKED = 2000;
const recentDenials = new Map<string, number>();

export function resetDenialThrottle(): void {
  recentDenials.clear();
}

/** Called when a permission check fails. Fire-and-forget; throttled. */
export function recordPermissionDenied(actor: Actor, permission: string, now = Date.now()): void {
  const key = `${actor.userId}:${permission}`;
  const last = recentDenials.get(key);
  if (last !== undefined && now - last < DENIAL_WINDOW_MS) return;
  if (recentDenials.size >= DENIAL_MAX_TRACKED) recentDenials.clear();
  recentDenials.set(key, now);
  void recordSecurityEvent({ type: "permission_denied", companyId: actor.companyId, actorId: actor.userId, subject: permission });
}
