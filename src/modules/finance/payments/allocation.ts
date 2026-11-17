import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { withTransaction } from "@/db";
import { toMinor } from "@/lib/money";
import { DomainError } from "@/lib/errors";
import { paymentAllocations, payments } from "@/db/schema";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

/** V1 creates one allocation equal to the full receipt; the table supports multiple allocations later. */
export async function allocateReceiptToInvoice(
  tx: FinanceTransaction,
  input: { companyId: string; paymentId: string; invoiceId: string; amount: string; actorId: string },
): Promise<void> {
  const requestedMinor = toMinor(input.amount);
  if (requestedMinor <= 0) throw new DomainError("VALIDATION", "Allocation amount must be positive.");
  const [payment] = await tx.select({
    invoiceId: payments.invoiceId,
    amount: payments.amount,
    status: payments.status,
  }).from(payments).where(and(
    eq(payments.id, input.paymentId),
    eq(payments.companyId, input.companyId),
  )).limit(1).for("update");
  if (!payment || payment.invoiceId !== input.invoiceId || payment.status === "reversed") {
    throw new DomainError("CONFLICT", "Allocation must match an active payment and its invoice.");
  }

  const [allocated] = await tx.select({
    amount: sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric`,
  }).from(paymentAllocations).where(and(
    eq(paymentAllocations.paymentId, input.paymentId),
    eq(paymentAllocations.companyId, input.companyId),
  ));
  if (BigInt(toMinor(allocated?.amount ?? "0")) + BigInt(requestedMinor) > BigInt(toMinor(payment.amount))) {
    throw new DomainError("CONFLICT", "Allocations cannot exceed the payment amount.");
  }

  await tx.insert(paymentAllocations).values({
    companyId: input.companyId,
    paymentId: input.paymentId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    createdBy: input.actorId,
  });
}
