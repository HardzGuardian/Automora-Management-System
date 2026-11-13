import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { parsePage } from "@/lib/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Clients" };

const PAGE_SIZE = 20;
const COLUMNS: DataColumn[] = [
  { key: "clientCode", header: "Code" },
  { key: "name", header: "Name", kind: "link", href: "/clients/{id}" },
  { key: "contactPerson", header: "Contact" },
  { key: "serviceType", header: "Service" },
  { key: "statusLabel", header: "Status", kind: "status" },
  { key: "email", header: "Email", defaultHidden: true },
  { key: "phone", header: "Phone", defaultHidden: true },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; archived?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "clients.read")) return <p>You do not have access to clients.</p>;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const includeArchived = sp.archived === "1";
  const { rows, total } = await listClients(actor, { page, pageSize: PAGE_SIZE, search: sp.q, includeArchived });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Clients" actions={can(actor, "clients.create") ? <Link href="/clients/new" className={buttonClass("primary")}>New client</Link> : null} />
      <FilterBar label="Filter clients">
        <input name="q" defaultValue={sp.q} aria-label="Search" placeholder="Search clients" className={`${inputClass} max-w-xs`} />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} /> Include archived
        </label>
      </FilterBar>
      <DataTable
        caption="Clients"
        columns={COLUMNS}
        rows={rows.map((c) => ({ id: c.id, clientCode: c.clientCode, name: c.name, contactPerson: c.contactPerson, serviceType: c.serviceType, statusLabel: c.archived ? "Archived" : c.status, email: c.email, phone: c.phone }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/clients"
        params={{ q: sp.q, archived: includeArchived ? "1" : undefined }}
        emptyTitle="No clients match"
        emptyDescription="Clients you add will be listed here."
        emptyAction={can(actor, "clients.create") ? { href: "/clients/new", label: "Add a client" } : undefined}
      />
    </div>
  );
}
