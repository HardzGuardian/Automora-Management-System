import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { listInvoices } from "@/modules/finance";

export default async function InvoicesPage() {
  const actor = await getActor();
  const result = await listInvoices(actor, { page: 1, pageSize: 50 });
  return (
    <main>
      <h1>Invoices</h1>
      {actor.permissions.has("finance.invoices.create") && <p><Link href="/invoices/new">Create invoice</Link></p>}
      {result.rows.length === 0
        ? <p>No invoices yet.</p>
        : <table>
            <thead><tr><th>Number</th><th>Client</th><th>Status</th><th>Due</th><th>Total</th><th>Outstanding</th></tr></thead>
            <tbody>{result.rows.map((invoice) => (
              <tr key={invoice.id}>
                <td><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber ?? "Draft"}</Link></td>
                <td>{invoice.clientName}</td>
                <td>{invoice.status.replaceAll("_", " ")}</td>
                <td>{invoice.dueDate ?? "—"}</td>
                <td>{invoice.currency} {invoice.total}</td>
                <td>{invoice.currency} {invoice.outstanding}</td>
              </tr>
            ))}</tbody>
          </table>}
    </main>
  );
}
