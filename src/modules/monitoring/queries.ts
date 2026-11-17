import "server-only";
import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { SECURITY_EVENT_TYPES, securityEvents, user, type SecurityEventType } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";

export type SecurityEventRow = {
  id: string;
  type: SecurityEventType;
  subject: string | null;
  ip: string | null;
  actorName: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
};

export type SecurityEventList = { rows: SecurityEventRow[]; total: number; page: number; pageSize: number };

/** The actor's own company, plus events that belong to no company (unknown emails, scheduled jobs). */
const visibleTo = (actor: Actor) => or(eq(securityEvents.companyId, actor.companyId), isNull(securityEvents.companyId));

export function isSecurityEventType(v: unknown): v is SecurityEventType {
  return typeof v === "string" && (SECURITY_EVENT_TYPES as readonly string[]).includes(v);
}

export async function listSecurityEvents(
  actor: Actor,
  input: { type?: string; page?: number; pageSize?: number } = {},
): Promise<SecurityEventList> {
  requirePermission(actor, "audit.read");
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25)));
  const where = and(visibleTo(actor), isSecurityEventType(input.type) ? eq(securityEvents.type, input.type) : undefined);
  const [total] = await db.select({ n: count() }).from(securityEvents).where(where);
  const rows = await db
    .select({
      id: securityEvents.id,
      type: securityEvents.type,
      subject: securityEvents.subject,
      ip: securityEvents.ip,
      actorName: user.name,
      detail: securityEvents.detail,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .leftJoin(user, eq(user.id, securityEvents.actorId))
    .where(where)
    .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    rows: rows.map((r) => ({ ...r, type: r.type as SecurityEventType, detail: (r.detail as Record<string, unknown> | null) ?? null })),
    total: total?.n ?? 0,
    page,
    pageSize,
  };
}

/** How many events of each type in the last 24 hours. */
export async function getSecuritySummary(actor: Actor, now = new Date()): Promise<Record<SecurityEventType, number>> {
  requirePermission(actor, "audit.read");
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const rows = await db
    .select({ type: securityEvents.type, n: count() })
    .from(securityEvents)
    .where(and(visibleTo(actor), gte(securityEvents.createdAt, since)))
    .groupBy(securityEvents.type);
  const out = Object.fromEntries(SECURITY_EVENT_TYPES.map((t) => [t, 0])) as Record<SecurityEventType, number>;
  for (const r of rows) if (isSecurityEventType(r.type)) out[r.type] = r.n;
  return out;
}
