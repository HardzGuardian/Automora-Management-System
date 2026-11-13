import "server-only";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationEvents, notifications, permissions, rolePermissions, userRoles, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { setNotifier, type NotifyEvent } from "@/lib/notify";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

const FINANCE_PREFIXES = ["payment.", "invoice.", "expense.", "finance."];
const isFinanceEvent = (type: string) => FINANCE_PREFIXES.some((p) => type.startsWith(p));

const ROUTES: Record<string, string> = {
  task: "/tasks",
  project: "/projects",
  client: "/clients",
  employee: "/employees",
  invoice: "/invoices",
  payment: "/payments",
  expense: "/expenses",
};

export function hrefFor(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const base = ROUTES[entityType];
  return base ? `${base}/${entityId}` : null;
}

/**
 * Stores notifications for the event's recipients. Idempotent per (eventKey, user), so retries,
 * double clicks and re-run reminder jobs never duplicate. Finance events reach only users with
 * finance.notifications.receive. Banned or unknown users are skipped.
 */
export async function deliver(event: NotifyEvent): Promise<void> {
  const ids = [...new Set(event.userIds)];
  if (ids.length === 0) return;

  let recipients = await db
    .select({ id: user.id, companyId: user.companyId })
    .from(user)
    .where(and(inArray(user.id, ids), sql`${user.banned} IS NOT TRUE`));

  if (isFinanceEvent(event.type) && recipients.length > 0) {
    const allowed = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(and(inArray(userRoles.userId, recipients.map((r) => r.id)), eq(permissions.key, "finance.notifications.receive")));
    const ok = new Set(allowed.map((a) => a.userId));
    recipients = recipients.filter((r) => ok.has(r.id));
  }

  for (const r of recipients) {
    await db.transaction(async (tx) => {
      const claimed = await tx
        .insert(notificationEvents)
        .values({ companyId: r.companyId, eventKey: event.eventKey, userId: r.id })
        .onConflictDoNothing()
        .returning({ id: notificationEvents.id });
      if (claimed.length === 0) return; // already delivered
      await tx.insert(notifications).values({
        companyId: r.companyId,
        userId: r.id,
        type: event.type,
        title: event.title,
        body: event.body ?? null,
        entityType: event.entity.type,
        entityId: event.entity.id,
        createdAt: sql`clock_timestamp()`,
      });
    });
  }
}

/** Connects this module to the shared notify port (called once at server start). */
export function registerNotifier(): void {
  setNotifier(deliver);
}

const listSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  unreadOnly: z.boolean().default(false),
});

export async function listForUser(
  actor: Actor,
  input: z.input<typeof listSchema>,
): Promise<{ rows: NotificationDTO[]; total: number }> {
  const f = listSchema.parse(input);
  const where = and(
    eq(notifications.userId, actor.userId),
    eq(notifications.companyId, actor.companyId),
    f.unreadOnly ? isNull(notifications.readAt) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(notifications).where(where),
  ]);
  return {
    total,
    rows: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: hrefFor(n.entityType, n.entityId),
      read: n.readAt !== null,
      createdAt: n.createdAt,
    })),
  };
}

export async function unreadCount(actor: Actor): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), eq(notifications.companyId, actor.companyId), isNull(notifications.readAt)));
  return n;
}

export async function markRead(actor: Actor, id: string): Promise<void> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, actor.userId), eq(notifications.companyId, actor.companyId)))
    .returning({ id: notifications.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Notification not found");
}

export async function markAllRead(actor: Actor): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.userId), eq(notifications.companyId, actor.companyId), isNull(notifications.readAt)));
}
