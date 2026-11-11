import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction } from "@/db";
import { account, session } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { auth } from "@/lib/auth/auth";
import { DomainError } from "@/lib/errors";
import { audit } from "@/modules/audit";

export type SessionDTO = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

const changePasswordSchema = z.object({
  current: z.string().min(1).max(128),
  next: z.string().min(10, "Use at least 10 characters").max(128),
  keepSessionId: z.string().optional(),
});

/** Verifies the current password, sets the new one, and signs out every other session. */
export async function changePassword(
  actor: Actor,
  input: { current: string; next: string; keepSessionId?: string },
): Promise<void> {
  const data = changePasswordSchema.parse(input);
  const ctx = await auth.$context;

  await withTransaction(async (tx) => {
    const [acc] = await tx
      .select()
      .from(account)
      .where(and(eq(account.userId, actor.userId), eq(account.providerId, "credential")))
      .for("update");
    if (!acc?.password) throw new DomainError("NOT_FOUND", "Password sign-in is not set up for this account");

    const ok = await ctx.password.verify({ hash: acc.password, password: data.current });
    if (!ok) throw new DomainError("VALIDATION", "Your current password is incorrect");

    await tx.update(account).set({ password: await ctx.password.hash(data.next) }).where(eq(account.id, acc.id));
    await tx
      .delete(session)
      .where(
        data.keepSessionId
          ? and(eq(session.userId, actor.userId), ne(session.id, data.keepSessionId))
          : eq(session.userId, actor.userId),
      );
    await audit.record(tx, { actor, entity: "user", entityId: actor.userId, action: "user.password_changed" });
  });
}

export async function listMySessions(actor: Actor, currentSessionId?: string): Promise<SessionDTO[]> {
  const rows = await db
    .select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    })
    .from(session)
    .where(eq(session.userId, actor.userId))
    .orderBy(session.createdAt);
  return rows.map((r) => ({ ...r, isCurrent: r.id === currentSessionId }));
}

/** Only the owner can revoke; any other id is NOT_FOUND so existence is never confirmed. */
export async function revokeSession(actor: Actor, sessionId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const deleted = await tx
      .delete(session)
      .where(and(eq(session.id, sessionId), eq(session.userId, actor.userId)))
      .returning({ id: session.id });
    if (deleted.length === 0) throw new DomainError("NOT_FOUND", "Session not found");
    await audit.record(tx, { actor, entity: "session", entityId: sessionId, action: "session.revoked" });
  });
}
