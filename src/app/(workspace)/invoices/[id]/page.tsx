import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getInvoiceDetail, listReceipts } from "@/modules/finance";
import type { InvoiceDetailDTO } from "@/modules/finance";
import { InvoiceActions } from "./_components/invoice-actions";
import { InvoiceDraftEditor } from "./_components/invoice-draft-editor";
import { NewReceiptForm } from "../../payments/_components/new-receipt-form";

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
  return (
    <main>
      <p><Link href="/invoices">Invoices</Link></p>
      <h1>{invoice.invoiceNumber ?? "Draft invoice"}</h1>
      <p>Status: {invoice.status.replaceAll("_", " ")}</p>
      <p>Client: {invoice.clientName}</p>
      <p>Due: {invoice.dueDate ?? "Not set"}</p>
      <table>
        <thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Discount</th><th>Tax rate</th><th>Total</th></tr></thead>
        <tbody>{invoice.items.map((item) => (
          <tr key={item.id}>
            <td>{item.description}</td><td>{item.quantity}</td><td>{invoice.currency} {item.unitPrice}</td>
            <td>{invoice.currency} {item.discount}</td><td>{item.taxRate}%</td><td>{invoice.currency} {item.lineTotal}</td>
          </tr>
        ))}</tbody>
      </table>
      <dl>
        <dt>Subtotal</dt><dd>{invoice.currency} {invoice.subtotal}</dd>
        <dt>Discount</dt><dd>{invoice.currency} {invoice.discountTotal}</dd>
        <dt>Tax</dt><dd>{invoice.currency} {invoice.taxTotal}</dd>
        <dt>Total</dt><dd>{invoice.currency} {invoice.total}</dd>
        <dt>Confirmed receipts</dt><dd>{invoice.currency} {invoice.confirmedReceipts}</dd>
        <dt>Outstanding</dt><dd>{invoice.currency} {invoice.outstanding}</dd>
      </dl>
      {invoice.invoiceNumber && <p><a href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a></p>}
      <InvoiceActions
        invoiceId={invoice.id}
        canIssue={actor.permissions.has("finance.invoices.issue") && invoice.status === "draft"}
        canCancel={actor.permissions.has("finance.invoices.cancel") && (invoice.status === "draft" || invoice.status === "issued")}
      />
      {invoice.status === "draft" && actor.permissions.has("finance.invoices.update") && <InvoiceDraftEditor
        invoiceId={invoice.id}
        clientId={invoice.clientId}
        projectId={invoice.projectId}
        dueDate={invoice.dueDate}
        items={invoice.items}
      />}
      {invoice.status === "issued" && actor.permissions.has("finance.payments.record") && <NewReceiptForm invoiceId={invoice.id} />}
      {receipts && <>
        <h2>Receipts</h2>
        {receipts.rows.length === 0
          ? <p>No receipts recorded.</p>
          : <ul>{receipts.rows.map((receipt) => (
              <li key={receipt.id}><Link href={`/payments/${receipt.id}`}>{receipt.paymentDate} · {receipt.status} · {receipt.currency} {receipt.amount}</Link></li>
            ))}</ul>}
      </>}
    </main>
  );
}
