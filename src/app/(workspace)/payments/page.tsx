import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { getActor } from "@/lib/auth/actor";
import { listReceipts } from "@/modules/finance";
import { methodLabel, money } from "../invoices/_components/finance-ui";

export const metadata = { title: "Receipts" };

const PAGE_SIZE = 25;
const STATUSES = ["pending", "confirmed", "reversed"] as const;

// The invoice number is the link: it opens the receipt (the receipt page links on to the invoice).
const COLUMNS: DataColumn[] = [
  { key: "paymentDate", header: "Date" },
  { key: "invoice", header: "Invoice", kind: "link", href: "/payments/{id}" },
  { key: "method", header: "Method" },
  { key: "reference", header: "Reference" },
  { key: "status", header: "Status", kind: "status" },
  { key: "amount", header: "Amount", kind: "number" },
];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const actor = await getActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const result = await listReceipts(actor, { page, pageSize: PAGE_SIZE, status });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Receipts"
        description="Money received against invoices. A receipt counts toward the balance only once it is confirmed. New receipts are recorded from the invoice."
      />
      <form className="flex flex-wrap items-end gap-2" role="search" aria-label="Filter receipts">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status ?? ""} className={`${inputClass} w-44`}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
      </form>
      <DataTable
        caption="Receipts"
        columns={COLUMNS}
        rows={result.rows.map((receipt) => ({
          id: receipt.id,
          paymentDate: receipt.paymentDate,
          invoice: receipt.invoiceNumber ?? "Invoice",
          method: methodLabel(receipt.method),
          reference: receipt.reference,
          status: receipt.status,
          amount: money(receipt.currency, receipt.amount),
        }))}
        total={result.total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/payments"
        params={{ status }}
        emptyTitle={status ? "No receipts match" : "No receipts recorded yet"}
        emptyDescription={status ? "Try a different status." : "Open an issued invoice and use “Record receipt” when a payment arrives."}
        emptyAction={status ? undefined : { href: "/invoices?status=issued", label: "View issued invoices" }}
      />
    </div>
  );
}
