import { auditChatterEntries } from "../../_components/audit-chatter";
import { Chatter } from "@/components/ui/chatter";
import { FieldGrid, FormView, SheetTitle, StatusBar } from "@/components/ui/odoo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getReceiptDetail } from "@/modules/finance";
import { methodLabel, money, notSet } from "../../invoices/_components/finance-ui";
import { ReceiptActions } from "./_components/receipt-actions";
import { isUuid } from "@/lib/pagination";

export const metadata = { title: "Receipt" };

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let receipt: Awaited<ReturnType<typeof getReceiptDetail>>;
  try {
    receipt = await getReceiptDetail(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.code === "PAYMENT_NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  const canConfirm = actor.permissions.has("finance.payments.confirm") && receipt.status === "pending" && !receipt.awaitingSecondPerson;
  const canReverse = actor.permissions.has("finance.payments.reverse") && receipt.status === "confirmed";
  const canVoid = receipt.status === "pending" && (actor.permissions.has("finance.payments.record") || actor.permissions.has("finance.payments.reverse"));
  const invoiceName = receipt.invoiceNumber ?? receipt.invoiceId;

  const historyEntries = await auditChatterEntries(actor, "payment", receipt.id);
  const receiptStages = receipt.status === "reversed" ? ["pending", "confirmed", "reversed"] : ["pending", "confirmed"];
  const receiptAt = receiptStages.indexOf(receipt.status);
  const RECEIPT_LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", reversed: "Reversed" };

  return (
    <FormView
      crumbs={[{ label: "Payments", href: "/finance?tab=payments" }, { label: `Receipt ${receipt.paymentDate}` }]}
      actions={canConfirm || canReverse || canVoid ? <ReceiptActions paymentId={receipt.id} canConfirm={canConfirm} canReverse={canReverse} canVoid={canVoid} /> : null}
      statusbar={
        <StatusBar
          label="Receipt status"
          stages={receiptStages.map((k, i) => ({ key: k, label: RECEIPT_LABEL[k] ?? k, state: i < receiptAt ? "done" : i === receiptAt ? "current" : "todo" }))}
        />
      }
      chatter={historyEntries ? <Chatter entries={historyEntries} timeZone={actor.timezone} title="History" empty="No changes recorded yet." /> : undefined}
    >
      <SheetTitle code="Receipt" title={money(receipt.currency, receipt.amount)} badges={<StatusBadge status={receipt.status} />} />
      {receipt.status === "pending" ? (
        <p className="-mt-3 mb-4 text-sm text-muted">
          {receipt.awaitingSecondPerson
            ? "Waiting for another person to confirm this receipt, because you recorded it. It does not reduce the invoice balance until then."
            : "This receipt is pending and does not reduce the invoice balance until it is confirmed."}
        </p>
      ) : null}
      {receipt.status === "reversed" ? <p className="-mt-3 mb-4 text-sm text-muted">This receipt was reversed and no longer counts toward the invoice balance.</p> : null}
      <FieldGrid
        items={[
          {
            label: "Invoice",
            value: (
              <Link href={`/invoices/${receipt.invoiceId}`} className="font-medium text-primary-ink underline">
                {invoiceName}
              </Link>
            ),
          },
          { label: "Amount", value: money(receipt.currency, receipt.amount) },
          { label: "Payment date", value: receipt.paymentDate },
          { label: "Method", value: methodLabel(receipt.method) },
          { label: "Reference", value: receipt.reference ?? notSet },
          { label: "Notes", value: receipt.notes ?? notSet },
        ]}
      />
    </FormView>
  );
}
