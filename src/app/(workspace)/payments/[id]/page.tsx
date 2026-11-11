import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getReceiptDetail } from "@/modules/finance";
import { ReceiptActions } from "./_components/receipt-actions";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  let receipt: Awaited<ReturnType<typeof getReceiptDetail>>;
  try {
    receipt = await getReceiptDetail(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.code === "PAYMENT_NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  return (
    <main>
      <p><Link href="/payments">Receipts</Link></p>
      <h1>Receipt</h1>
      <p><Link href={`/invoices/${receipt.invoiceId}`}>Invoice {receipt.invoiceNumber ?? receipt.invoiceId}</Link></p>
      <dl>
        <dt>Status</dt><dd>{receipt.status}</dd>
        <dt>Amount</dt><dd>{receipt.currency} {receipt.amount}</dd>
        <dt>Payment date</dt><dd>{receipt.paymentDate}</dd>
        <dt>Method</dt><dd>{receipt.method.replaceAll("_", " ")}</dd>
        <dt>Reference</dt><dd>{receipt.reference ?? "—"}</dd>
        <dt>Notes</dt><dd>{receipt.notes ?? "—"}</dd>
      </dl>
      <ReceiptActions
        paymentId={receipt.id}
        canConfirm={actor.permissions.has("finance.payments.confirm") && receipt.status === "pending"}
        canReverse={actor.permissions.has("finance.payments.reverse") && receipt.status === "confirmed"}
      />
    </main>
  );
}
