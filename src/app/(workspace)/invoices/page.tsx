import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { getActor } from "@/lib/auth/actor";
import { listInvoiceClients, listInvoices } from "@/modules/finance";
import { money } from "./_components/finance-ui";

export const metadata = { title: "Invoices" };

const PAGE_SIZE = 25;
const STATUSES = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"] as const;
const SORTS = { number: "invoiceNumber", issued: "issueDate", due: "dueDate", total: "total" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS: DataColumn[] = [
  { key: "number", header: "Number", kind: "link", href: "/invoices/{id}", sortable: true, sortKey: "number" },
  { key: "clientName", header: "Client" },
  { key: "status", header: "Status", kind: "status" },
  { key: "issueDate", header: "Issued", sortable: true, sortKey: "issued", defaultHidden: true },
  { key: "dueDate", header: "Due", sortable: true, sortKey: "due" },
  { key: "total", header: "Total", kind: "number", sortable: true, sortKey: "total" },
  { key: "outstanding", header: "Outstanding", kind: "number" },
];

type SP = { page?: string; status?: string; clientId?: string; sort?: string; dir?: string };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const clientId = sp.clientId && UUID.test(sp.clientId) ? sp.clientId : undefined;
  const sort = (Object.keys(SORTS) as Array<keyof typeof SORTS>).find((s) => s === sp.sort);
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const canCreate = actor.permissions.has("finance.invoices.create");

  const [result, clients] = await Promise.all([
    listInvoices(actor, { page, pageSize: PAGE_SIZE, status, clientId, ...(sort ? { sortBy: SORTS[sort], sortDirection: dir } : {}) }),
    canCreate ? listInvoiceClients(actor) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        description="Drafts can be edited. Issued invoices are numbered, locked and can receive payments."
        actions={canCreate ? <Link href="/invoices/new" className={buttonClass("primary")}>Create invoice</Link> : null}
      />
      <form className="flex flex-wrap items-end gap-2" role="search" aria-label="Filter invoices">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status ?? ""} className={`${inputClass} w-44`}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
        {clients.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Client
            <select name="clientId" defaultValue={clientId ?? ""} className={`${inputClass} w-56`}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        {sort ? <input type="hidden" name="dir" value={dir} /> : null}
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
      </form>
      <DataTable
        caption="Invoices"
        columns={COLUMNS}
        rows={result.rows.map((invoice) => ({
          id: invoice.id,
          number: invoice.invoiceNumber ?? "Draft",
          clientName: invoice.clientName,
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          total: money(invoice.currency, invoice.total),
          outstanding: invoice.status === "draft" || invoice.status === "cancelled" ? null : money(invoice.currency, invoice.outstanding),
        }))}
        total={result.total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/invoices"
        params={{ status, clientId, sort, dir: sort ? dir : undefined }}
        emptyTitle={status || clientId ? "No invoices match" : "No invoices yet"}
        emptyDescription={status || clientId ? "Try a different status or client." : "Create a draft, add its lines, then issue it to send it to the client."}
        emptyAction={canCreate && !status && !clientId ? { href: "/invoices/new", label: "Create invoice" } : undefined}
      />
    </div>
  );
}
