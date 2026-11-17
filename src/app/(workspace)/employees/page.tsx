import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { Pager } from "@/components/ui/pager";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { departmentNamesForEmployees } from "@/modules/teams";

export const metadata = { title: "Employees" };

const PAGE_SIZE = 20;
const STATUSES = ["Active", "Inactive", "Suspended"] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "employees.read")) {
    return <p className="rounded-lg border border-border bg-surface p-5 text-muted">You do not have access to the employee directory.</p>;
  }
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const status = STATUSES.find((s) => s === sp.status);
  const [{ rows, total }, ...counts] = await Promise.all([
    listEmployees(actor, { page, pageSize: PAGE_SIZE, search: sp.q, status, sort: "name", dir: "asc" }),
    listEmployees(actor, { pageSize: 1, search: sp.q }),
    ...STATUSES.map((s) => listEmployees(actor, { pageSize: 1, search: sp.q, status: s })),
  ]);
  // Department comes from team membership; the legacy free-text value is only a fallback.
  const departments = await departmentNamesForEmployees(actor, rows.map((e) => e.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (patch: { status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (sp.q) qs.set("q", sp.q);
    const st = "status" in patch ? patch.status : status;
    if (st) qs.set("status", st);
    if (patch.page && patch.page > 1) qs.set("page", String(patch.page));
    const s = qs.toString();
    return s ? `/employees?${s}` : "/employees";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Employees</h1>
          <p className="mt-1 text-muted">Everyone in the company. Open a person to invite them, change their details or role.</p>
        </div>
        {can(actor, "employees.create") ? (
          <Link href="/employees/new" className={buttonClass("primary", "gap-2")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            New employee
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <form role="search" className="relative max-w-[360px] min-w-60 flex-1">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="emp-q" className="sr-only">Search employees</label>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-[11px] text-muted" />
          <input
            id="emp-q"
            name="q"
            type="search"
            defaultValue={sp.q}
            placeholder="Search name, email or code"
            className="h-10 w-full rounded-lg border border-field bg-surface pl-10 pr-3 text-foreground placeholder:text-muted"
          />
        </form>
        <FilterPills
          label="Filter by status"
          pills={[
            { label: "All", href: link({ status: undefined }), count: counts[0].total, active: !status },
            ...STATUSES.map((s, i) => ({ label: s, href: link({ status: s }), count: counts[i + 1].total, active: status === s })),
          ]}
        />
      </div>

      <section aria-label="Employees" tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">{sp.q || status ? "No employees match." : "No employees yet."}</p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-3.5 pl-6 pr-3 font-medium">Name</th>
                <th scope="col" className="px-3 py-3.5 font-medium">Designation</th>
                <th scope="col" className="px-3 py-3.5 font-medium">Team</th>
                <th scope="col" className="py-3.5 pl-3 pr-6 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="py-4 pl-6 pr-3">
                    <Link href={`/employees/${e.id}`} className="font-semibold text-foreground hover:text-primary-ink">
                      {e.fullName}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted">{e.workEmail}</div>
                  </td>
                  <td className="px-3 py-4 text-body">{e.designation ?? "—"}</td>
                  <td className="px-3 py-4 text-body">{departments.get(e.id)?.join(", ") ?? e.department ?? "—"}</td>
                  <td className="py-4 pl-3 pr-6">
                    <StatusBadge status={e.employmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Pager page={page} pages={pages} prevHref={page > 1 ? link({ page: page - 1 }) : undefined} nextHref={page < pages ? link({ page: page + 1 }) : undefined} />
    </div>
  );
}
