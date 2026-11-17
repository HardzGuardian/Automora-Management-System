import "server-only";
import { and, eq } from "drizzle-orm";
import { withTransaction } from "@/db";
import { DomainError } from "@/lib/errors";
import { idempotencyKeys } from "@/db/schema";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export type IdempotencyClaim =
  | { id: string; replay: false }
  | { id: string; replay: true; response: unknown };

export async function beginIdempotentOperation(
  tx: FinanceTransaction,
  input: { companyId: string; key: string; operation: string; requestHash: string },
): Promise<IdempotencyClaim> {
  const inserted = await tx.insert(idempotencyKeys).values({
    companyId: input.companyId,
    idempotencyKey: input.key,
    operation: input.operation,
    requestHash: input.requestHash,
  }).onConflictDoNothing({ target: [idempotencyKeys.companyId, idempotencyKeys.idempotencyKey] })
    .returning({ id: idempotencyKeys.id });
  const newClaim = inserted[0];
  if (newClaim) return { id: newClaim.id, replay: false };

  const [existing] = await tx.select().from(idempotencyKeys).where(and(
    eq(idempotencyKeys.companyId, input.companyId),
    eq(idempotencyKeys.idempotencyKey, input.key),
  )).limit(1);
  if (!existing || existing.operation !== input.operation || existing.requestHash !== input.requestHash) {
    throw new DomainError("CONFLICT", "Idempotency key was already used for a different request.");
  }
  if (existing.response === null) throw new DomainError("CONFLICT", "The original request has not completed.");
  return { id: existing.id, replay: true, response: existing.response };
}

export async function completeIdempotentOperation(
  tx: FinanceTransaction,
  claimId: string,
  resourceType: string,
  resourceId: string,
  response: unknown,
): Promise<void> {
  await tx.update(idempotencyKeys).set({ resourceType, resourceId, response })
    .where(eq(idempotencyKeys.id, claimId));
}
