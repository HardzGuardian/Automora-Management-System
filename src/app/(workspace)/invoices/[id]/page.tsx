import { auditChatterEntries } from "../../_components/audit-chatter";
import { Chatter } from "@/components/ui/chatter";
import { FieldGrid, FormView, SheetTitle, SmartButtons, StatusBar } from "@/components/ui/odoo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getInvoiceDetail, listInvoiceClients, listReceipts } from "@/modules/finance";
import type { InvoiceDetailDTO } from "@/modules/finance";
import {
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
import { isUuid } from "@/lib/pagination";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
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
  const draftClients = canEditDraft && actor.permissions.has("finance.invoices.create") ? await listInvoiceClients(actor).catch(() => []) : [];
  const projectLabel = invoice.projectId ? projects.find((p) => p.id === invoice.projectId)?.label ?? "Linked project" : null;
  const canIssue = actor.permissions.has("finance.invoices.issue") && invoice.status === "draft";
  const canCancel = actor.permissions.has("finance.invoices.cancel") && (invoice.status === "draft" || invoice.status === "issued" || invoice.status === "overdue");
  const hasPdf = Boolean(invoice.invoiceNumber);
  const outstandingTone = invoice.status === "overdue" ? "danger" : invoice.status === "paid" ? "success" : "default";

  const historyEntries = await auditChatterEntries(actor, "invoice", invoice.id);
  const invoicePath = ["draft", "issued", "paid"];
  const invoiceNow = invoice.status === "partially_paid" ? "issued" : invoice.status;
  const invoiceStages = invoicePath.includes(invoiceNow) ? invoicePath : [...invoicePath.slice(0, 2), invoiceNow];
  const invoiceAt = invoiceStages.indexOf(invoiceNow);
  const STAGE_LABEL: Record<string, string> = { draft: "Draft", issued: invoice.status === "partially_paid" ? "Partially paid" : "Issued", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" };

  return (
    <FormView
      crumbs={[{ label: "Invoices", href: "/finance?tab=invoices" }, { label: invoice.invoiceNumber ?? "Draft invoice" }]}
      actions={
        hasPdf || canIssue || canCancel ? (
          <div className="flex flex-wrap items-center gap-2">
            {hasPdf ? (
              <a href={`/api/invoices/${invoice.id}/pdf`} className={buttonClass("secondary", "min-h-9")}>
                Download PDF
              </a>
            ) : null}
            <InvoiceActions invoiceId={invoice.id} canIssue={canIssue} canCancel={canCancel} />
          </div>
        ) : null
      }
      statusbar={
        <StatusBar
          label="Invoice status"
          stages={invoiceStages.map((k, i) => ({ key: k, label: STAGE_LABEL[k] ?? k, state: i < invoiceAt ? "done" : i === invoiceAt ? "current" : "todo" }))}
        />
      }
      chatter={historyEntries ? <Chatter entries={historyEntries} timeZone={actor.timezone} title="History" empty="No changes recorded yet." /> : undefined}
    >
      <SheetTitle
        code="Customer invoice"
        title={invoice.invoiceNumber ?? "Draft invoice"}
        badges={<StatusBadge status={invoice.status} />}
        smart={
          <SmartButtons
            items={[
              { icon: "issued", value: money(invoice.currency, invoice.total), label: "Total" },
              { icon: "completed", value: money(invoice.currency, invoice.confirmedReceipts), label: "Received" },
              { icon: "partial", value: money(invoice.currency, invoice.outstanding), label: "Outstanding", tone: outstandingTone === "danger" ? "danger" : undefined },
            ]}
          />
        }
      />
      {canIssue ? <p className="-mt-3 mb-4 text-xs text-muted">Issuing assigns the next invoice number and locks the lines.</p> : null}
      <FieldGrid
        items={[
          { label: "Client", value: invoice.clientName },
          { label: "Project", value: projectLabel ?? notSet },
          { label: "Issue date", value: invoice.issueDate ?? notSet },
          { label: "Due date", value: invoice.dueDate ?? notSet },
          { label: "Currency", value: invoice.currency },
        ]}
      />
      <div className="mt-2 flex flex-col gap-4">
          <Section title="Line items">
            <TableShell caption="Invoice line items" minWidth="38rem">
              <thead className="text-muted">
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
              clients={draftClients}
            />
          )}

          {(invoice.status === "issued" || invoice.status === "partially_paid" || invoice.status === "overdue") && actor.permissions.has("finance.payments.record") && <NewReceiptForm invoiceId={invoice.id} />}

          {receipts && (
            <Section title="Receipts">
              {receipts.rows.length === 0 ? (
                <p className="text-sm text-muted">No receipts recorded yet.{invoice.status === "issued" || invoice.status === "overdue" ? " Record one above when a payment arrives." : ""}</p>
              ) : (
                <TableShell caption="Receipts for this invoice" minWidth="30rem">
                  <thead className="text-muted">
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
    </FormView>
  );
}
