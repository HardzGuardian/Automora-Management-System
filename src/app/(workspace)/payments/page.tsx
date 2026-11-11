import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { listReceipts } from "@/modules/finance";

export default async function PaymentsPage() {
  const actor = await getActor();
  const result = await listReceipts(actor, { page: 1, pageSize: 50 });
  return (
    <main>
      <h1>Receipts</h1>
      {result.rows.length === 0
        ? <p>No receipts recorded.</p>
        : <table>
            <thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody>{result.rows.map((receipt) => (
              <tr key={receipt.id}>
                <td>{receipt.paymentDate}</td>
                <td><Link href={`/payments/${receipt.id}`}>{receipt.invoiceNumber ?? "Invoice"}</Link></td>
                <td>{receipt.method.replaceAll("_", " ")}</td>
                <td>{receipt.reference ?? "—"}</td>
                <td>{receipt.status}</td>
                <td>{receipt.currency} {receipt.amount}</td>
              </tr>
            ))}</tbody>
          </table>}
    </main>
  );
}
