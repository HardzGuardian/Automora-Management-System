import "server-only";
import type { Tx } from "@/db";
import { activityLogs } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { redact } from "./redact";

export type AuditEvent = {
  actor: Actor;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

/** Writes inside the caller's transaction: if the change rolls back, so does the audit row. */
export async function record(tx: Tx, e: AuditEvent): Promise<void> {
  await tx.insert(activityLogs).values({
    companyId: e.actor.companyId,
    actorId: e.actor.userId,
    entity: e.entity,
    entityId: e.entityId,
    action: e.action,
    before: e.before === undefined ? null : redact(e.before),
    after: e.after === undefined ? null : redact(e.after),
  });
}
