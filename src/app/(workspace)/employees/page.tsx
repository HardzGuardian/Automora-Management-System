import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";

const PAGE_SIZE = 20;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const actor = await requireActor();
  if (!can(actor, "employees.read")) {
    return <main className="p-8">You do not have access to the employee directory.</main>;
  }
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status === "Active" || sp.status === "Inactive" || sp.status === "Suspended" ? sp.status : undefined;
  const { rows, total } = await listEmployees(actor, { page, pageSize: PAGE_SIZE, search: sp.q, status });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees ({total})</h1>
        {can(actor, "employees.create") ? (
          <Link href="/employees/new" className="rounded bg-black px-3 py-2 text-white">
            New employee
          </Link>
        ) : null}
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search name, email or code" className="rounded border border-gray-300 px-3 py-2" />
        <select name="status" defaultValue={status ?? ""} className="rounded border border-gray-300 px-3 py-2">
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>Suspended</option>
        </select>
        <button type="submit" className="rounded border border-gray-300 px-3 py-2">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No employees match.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-2">{e.employeeCode}</td>
                <td>
                  <Link href={`/employees/${e.id}`} className="underline">
                    {e.fullName}
                  </Link>
                </td>
                <td>{e.designation ?? "—"}</td>
                <td>{e.department ?? "—"}</td>
                <td>{e.employmentStatus}</td>
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
