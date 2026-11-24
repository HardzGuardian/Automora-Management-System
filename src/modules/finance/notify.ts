import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { permissions, rolePermissions, user, userRoles } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { notify } from "@/lib/notify";

/** Active users in the company who hold finance.notifications.receive, except the person who did the action. */
async function financeRecipients(actor: Actor): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .innerJoin(user, eq(user.id, userRoles.userId))
    .where(
      and(
        eq(userRoles.companyId, actor.companyId),
        eq(permissions.key, "finance.notifications.receive"),
        eq(user.banned, false),
        ne(userRoles.userId, actor.userId),
      ),
    );
  return rows.map((r) => r.userId);
}

/**
 * Tells finance users about a payment event (recorded, confirmed). Call AFTER the transaction commits.
 * Never throws: a notification problem must not undo a payment.
 */
export async function notifyPaymentEvent(
  actor: Actor,
  event: { kind: "recorded" | "confirmed" | "voided"; paymentId: string; amount: string; invoiceId: string },
): Promise<void> {
  try {
    const userIds = await financeRecipients(actor);
    if (userIds.length === 0) return;
    const verb = event.kind === "recorded" ? "recorded" : event.kind === "confirmed" ? "confirmed" : "voided";
    await notify({
      type: `payment.${event.kind}`,
      userIds,
      entity: { type: "payment", id: event.paymentId },
      eventKey: `payment:${event.paymentId}:${event.kind}`,
      title: `Payment ${verb}: ${event.amount}`,
      body: event.kind === "recorded" ? "A new receipt is waiting for confirmation." : undefined,
    });
  } catch {
    // swallowed on purpose
  }
}
