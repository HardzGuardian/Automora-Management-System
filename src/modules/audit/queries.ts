import "server-only";
import { and, count, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  actorName: string | null;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
};

export type AuditLogFilter = {
  entity?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Everything recorded by audit.record, newest first, across every module. Needs audit.read. Company-scoped. */
export async function listAuditLog(actor: Actor, f: AuditLogFilter = {}): Promise<{ rows: AuditLogRow[]; total: number; entities: string[] }> {
  requirePermission(actor, "audit.read");
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const conds: SQL[] = [eq(activityLogs.companyId, actor.companyId)];
  if (f.entity) conds.push(eq(activityLogs.entity, f.entity));
  if (f.action?.trim()) conds.push(ilike(activityLogs.action, `%${escapeLike(f.action.trim().slice(0, 80))}%`));
  if (f.actorId) conds.push(eq(activityLogs.actorId, f.actorId));
  if (f.from && ISO.test(f.from)) conds.push(gte(activityLogs.createdAt, sql`(${f.from}::date)::timestamptz`));
  if (f.to && ISO.test(f.to)) conds.push(lte(activityLogs.createdAt, sql`((${f.to}::date) + interval '1 day')::timestamptz - interval '1 millisecond'`));
  const where = and(...conds);

  const [rows, [{ total }], entityRows] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        createdAt: activityLogs.createdAt,
        actorName: user.name,
        entity: activityLogs.entity,
        entityId: activityLogs.entityId,
        action: activityLogs.action,
        before: activityLogs.before,
        after: activityLogs.after,
      })
      .from(activityLogs)
      .leftJoin(user, eq(user.id, activityLogs.actorId))
      .where(where)
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(activityLogs).where(where),
    db.selectDistinct({ entity: activityLogs.entity }).from(activityLogs).where(eq(activityLogs.companyId, actor.companyId)),
  ]);
  return { rows, total, entities: entityRows.map((e) => e.entity).sort() };
}

/** History of one record (an invoice, a payment, an expense...) for its detail page. */
export async function listEntityHistory(actor: Actor, entity: string, entityId: string, limit = 50): Promise<AuditLogRow[]> {
  requirePermission(actor, "audit.read");
  return db
    .select({
      id: activityLogs.id,
      createdAt: activityLogs.createdAt,
      actorName: user.name,
      entity: activityLogs.entity,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      before: activityLogs.before,
      after: activityLogs.after,
    })
    .from(activityLogs)
    .leftJoin(user, eq(user.id, activityLogs.actorId))
    .where(and(eq(activityLogs.companyId, actor.companyId), eq(activityLogs.entity, entity), eq(activityLogs.entityId, entityId)))
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(limit);
}
