import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";

const PAGE_SIZE = 20;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; archived?: string }>;
}) {
  const actor = await requireActor();
  if (!can(actor, "clients.read")) return <main className="p-8">You do not have access to clients.</main>;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listClients(actor, {
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    includeArchived: sp.archived === "1",
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <main className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients ({total})</h1>
        {can(actor, "clients.create") ? (
          <Link href="/clients/new" className="rounded bg-black px-3 py-2 text-white">
            New client
          </Link>
        ) : null}
      </div>
      <form className="flex items-center gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search clients" className="rounded border border-gray-300 px-3 py-2" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} /> Include archived
        </label>
        <button type="submit" className="rounded border border-gray-300 px-3 py-2">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No clients match.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Service</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2">{c.clientCode}</td>
                <td>
                  <Link href={`/clients/${c.id}`} className="underline">
                    {c.name}
                  </Link>
                </td>
                <td>{c.contactPerson ?? "—"}</td>
                <td>{c.serviceType ?? "—"}</td>
                <td>{c.archived ? "Archived" : c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <nav className="flex items-center gap-3 text-sm">
        {page > 1 ? (
          <Link href={{ query: { ...sp, page: page - 1 } }} className="underline">
            Previous
          </Link>
        ) : null}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={{ query: { ...sp, page: page + 1 } }} className="underline">
            Next
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
