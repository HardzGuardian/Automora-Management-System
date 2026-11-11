import "server-only";
import { withTransaction } from "@/db";
import { paymentAllocations } from "@/db/schema";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

/** V1 creates one allocation equal to the full receipt; the table supports multiple allocations later. */
export async function allocateReceiptToInvoice(
  tx: FinanceTransaction,
  input: { companyId: string; paymentId: string; invoiceId: string; amount: string; actorId: string },
): Promise<void> {
  await tx.insert(paymentAllocations).values({
    companyId: input.companyId,
    paymentId: input.paymentId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    createdBy: input.actorId,
  });
}
