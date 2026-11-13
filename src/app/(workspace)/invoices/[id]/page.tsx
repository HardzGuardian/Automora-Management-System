import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getInvoiceDetail, listReceipts } from "@/modules/finance";
import type { InvoiceDetailDTO } from "@/modules/finance";
import {
  BackLink,
  DetailHeader,
  DetailList,
  Figures,
  Section,
  TableShell,
  methodLabel,
  money,
  notSet,
  tdClass,
  tdNumClass,
  thClass,
  thNumClass,
} from "../_components/finance-ui";
import { loadProjectOptions } from "../_components/project-options";
import { InvoiceActions } from "./_components/invoice-actions";
import { InvoiceDraftEditor } from "./_components/invoice-draft-editor";
import { NewReceiptForm } from "../../payments/_components/new-receipt-form";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  let invoice: InvoiceDetailDTO;
  try {
    invoice = await getInvoiceDetail(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.code === "INVOICE_NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  const receipts = actor.permissions.has("finance.payments.read")
    ? await listReceipts(actor, { page: 1, pageSize: 100, invoiceId: id })
    : null;
  const canEditDraft = invoice.status === "draft" && actor.permissions.has("finance.invoices.update");
  const projects = canEditDraft || invoice.projectId ? await loadProjectOptions(actor, invoice.projectId) : [];
  const projectLabel = invoice.projectId ? projects.find((p) => p.id === invoice.projectId)?.label ?? "Linked project" : null;
  const canIssue = actor.permissions.has("finance.invoices.issue") && invoice.status === "draft";
  const canCancel = actor.permissions.has("finance.invoices.cancel") && (invoice.status === "draft" || invoice.status === "issued");
  const hasPdf = Boolean(invoice.invoiceNumber);
  const outstandingTone = invoice.status === "overdue" ? "danger" : invoice.status === "paid" ? "success" : "default";

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/invoices">Invoices</BackLink>
      <DetailHeader
        title={invoice.invoiceNumber ?? "Draft invoice"}
        badge={<StatusBadge status={invoice.status} />}
        facts={
          <>
            {invoice.clientName} · Due {invoice.dueDate ?? "not set"}
          </>
        }
      />
      <Figures
        items={[
          { label: "Total", value: money(invoice.currency, invoice.total) },
          { label: "Received", value: money(invoice.currency, invoice.confirmedReceipts) },
          { label: "Outstanding", value: money(invoice.currency, invoice.outstanding), tone: outstandingTone },
        ]}
      />

      {hasPdf || canIssue || canCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          {hasPdf ? (
            <a href={`/api/invoices/${invoice.id}/pdf`} className={buttonClass("secondary")}>
              Download PDF
            </a>
          ) : null}
          <InvoiceActions invoiceId={invoice.id} canIssue={canIssue} canCancel={canCancel} />
          {canIssue ? <p className="basis-full text-xs text-muted">Issuing assigns the next invoice number and locks the lines.</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Section title="Line items">
            <TableShell caption="Invoice line items" minWidth="38rem">
              <thead className="bg-primary-soft">
                <tr>
                  <th scope="col" className={thClass}>Description</th>
                  <th scope="col" className={thNumClass}>Quantity</th>
                  <th scope="col" className={thNumClass}>Unit price</th>
                  <th scope="col" className={thNumClass}>Discount</th>
                  <th scope="col" className={thNumClass}>Tax rate</th>
                  <th scope="col" className={thNumClass}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className={tdClass}>{item.description}</td>
                    <td className={tdNumClass}>{item.quantity}</td>
                    <td className={tdNumClass}>{money(invoice.currency, item.unitPrice)}</td>
                    <td className={tdNumClass}>{money(invoice.currency, item.discount)}</td>
                    <td className={tdNumClass}>{item.taxRate}%</td>
                    <td className={tdNumClass}>{money(invoice.currency, item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {[
                  ["Subtotal", invoice.subtotal, false],
                  ["Discount", invoice.discountTotal, false],
                  ["Tax", invoice.taxTotal, false],
                  ["Total", invoice.total, true],
                ].map(([label, value, strong]) => (
                  <tr key={String(label)} className={strong ? "border-t border-border font-semibold" : "border-t border-border text-muted"}>
                    <th scope="row" colSpan={5} className="px-3 py-2 text-right font-medium">
                      {label as string}
                    </th>
                    <td className={tdNumClass}>{money(invoice.currency, value as string)}</td>
                  </tr>
                ))}
              </tfoot>
            </TableShell>
          </Section>

          {canEditDraft && (
            <InvoiceDraftEditor
              invoiceId={invoice.id}
              clientId={invoice.clientId}
              projectId={invoice.projectId}
              dueDate={invoice.dueDate}
              items={invoice.items}
              projects={projects}
            />
          )}

          {invoice.status === "issued" && actor.permissions.has("finance.payments.record") && <NewReceiptForm invoiceId={invoice.id} />}

          {receipts && (
            <Section title="Receipts">
              {receipts.rows.length === 0 ? (
                <p className="text-sm text-muted">No receipts recorded yet.{invoice.status === "issued" ? " Record one above when a payment arrives." : ""}</p>
              ) : (
                <TableShell caption="Receipts for this invoice" minWidth="30rem">
                  <thead className="bg-primary-soft">
                    <tr>
                      <th scope="col" className={thClass}>Date</th>
                      <th scope="col" className={thClass}>Method</th>
                      <th scope="col" className={thClass}>Reference</th>
                      <th scope="col" className={thClass}>Status</th>
                      <th scope="col" className={thNumClass}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.rows.map((receipt) => (
                      <tr key={receipt.id} className="border-t border-border">
                        <td className={tdClass}>
                          <Link href={`/payments/${receipt.id}`} className="font-medium underline">
                            {receipt.paymentDate}
                          </Link>
                        </td>
                        <td className={tdClass}>{methodLabel(receipt.method)}</td>
                        <td className={tdClass}>{receipt.reference ?? notSet}</td>
                        <td className={tdClass}>
                          <StatusBadge status={receipt.status} />
                        </td>
                        <td className={tdNumClass}>{money(receipt.currency, receipt.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              )}
            </Section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Section title="Details">
            <DetailList
              rows={[
                ["Client", invoice.clientName],
                ["Project", projectLabel ?? notSet],
                ["Issue date", invoice.issueDate ?? notSet],
                ["Due date", invoice.dueDate ?? notSet],
                ["Currency", invoice.currency],
              ]}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}
