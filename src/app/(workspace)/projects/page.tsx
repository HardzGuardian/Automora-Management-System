import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getProgressForProjects, listProjects } from "@/modules/projects";

const PAGE_SIZE = 20;
const STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled", "Archived"] as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const { rows, total } = await listProjects(actor, {
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    status,
    includeArchived: status === "Archived",
  });
  const progress = await getProgressForProjects(actor, rows.map((r) => r.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects ({total})</h1>
        {can(actor, "projects.create") ? (
          <Link href="/projects/new" className="rounded bg-black px-3 py-2 text-white">
            New project
          </Link>
        ) : null}
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search projects" className="rounded border border-gray-300 px-3 py-2" />
        <select name="status" defaultValue={status ?? ""} className="rounded border border-gray-300 px-3 py-2">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded border border-gray-300 px-3 py-2">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No projects match.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">{p.projectCode}</td>
                <td>
                  <Link href={`/projects/${p.id}`} className="underline">
                    {p.name}
                  </Link>
                </td>
                <td>{p.type}</td>
                <td>{p.status}</td>
                <td>{p.dueDate ?? "—"}</td>
                <td>{progress.get(p.id)?.percent ?? 0}%</td>
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
