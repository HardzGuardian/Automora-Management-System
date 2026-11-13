import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getReceiptDetail } from "@/modules/finance";
import { BackLink, DetailHeader, DetailList, Section, methodLabel, money, notSet } from "../../invoices/_components/finance-ui";
import { ReceiptActions } from "./_components/receipt-actions";

export const metadata = { title: "Receipt" };

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
  const canConfirm = actor.permissions.has("finance.payments.confirm") && receipt.status === "pending";
  const canReverse = actor.permissions.has("finance.payments.reverse") && receipt.status === "confirmed";
  const invoiceName = receipt.invoiceNumber ?? receipt.invoiceId;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/payments">Receipts</BackLink>
      <DetailHeader
        title="Receipt"
        badge={<StatusBadge status={receipt.status} />}
        facts={
          <>
            {money(receipt.currency, receipt.amount)} · {receipt.paymentDate} ·{" "}
            <Link href={`/invoices/${receipt.invoiceId}`} className="underline">
              Invoice {invoiceName}
            </Link>
          </>
        }
      />
      {receipt.status === "pending" ? (
        <p className="text-sm text-muted">This receipt is pending and does not reduce the invoice balance until it is confirmed.</p>
      ) : null}
      {receipt.status === "reversed" ? (
        <p className="text-sm text-muted">This receipt was reversed and no longer counts toward the invoice balance.</p>
      ) : null}
      {canConfirm || canReverse ? <ReceiptActions paymentId={receipt.id} canConfirm={canConfirm} canReverse={canReverse} /> : null}

      <Section title="Details" className="max-w-2xl">
        <DetailList
          rows={[
            ["Amount", money(receipt.currency, receipt.amount)],
            ["Payment date", receipt.paymentDate],
            ["Method", methodLabel(receipt.method)],
            ["Reference", receipt.reference ?? notSet],
            ["Notes", receipt.notes ?? notSet],
          ]}
        />
      </Section>
    </div>
  );
}
