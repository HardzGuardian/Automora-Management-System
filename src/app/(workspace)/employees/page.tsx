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
import { employeeTeamsAndWork } from "@/modules/teams";

export const metadata = { title: "Employees" };

const PAGE_SIZE = 20;
const STATUSES = ["Active", "Inactive", "Suspended"] as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

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
  const work = await employeeTeamsAndWork(actor, rows.map((e) => e.id));
  const canEdit = can(actor, "employees.update");
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
          <p className="mt-1 text-muted">Everyone in the company, the teams they are on and the work they hold. Open a person to see their details.</p>
        </div>
        {can(actor, "employees.create") ? (
          <Link href="/employees/new" className={buttonClass("primary", "gap-2")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            Add employee
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <form role="search" aria-label="Employee search" className="relative max-w-[360px] min-w-60 flex-1">
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

      <section aria-label="Employees" className="overflow-hidden rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted">{sp.q || status ? "No employees match." : "No employees yet."}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((e) => {
              const w = work.get(e.id) ?? { teams: [], openTasks: 0, totalTasks: 0 };
              const teamLine = w.teams.length === 0 ? "No team yet" : w.teams.map((t) => t.team + (t.role === "lead" ? " (lead)" : "")).join(", ");
              return (
                <li key={e.id} className="flex items-start gap-2 border-t border-border pr-4 first:border-t-0">
                  <details className="group min-w-0 flex-1">
                    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto_auto] items-start gap-x-4 gap-y-1 py-[18px] pl-6 max-md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground">{e.fullName}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{e.workEmail}</span>
                      </span>
                      <span className="min-w-0 text-body max-md:hidden">{e.designation ?? "—"}</span>
                      <span className={w.teams.length === 0 ? "min-w-0 text-muted max-md:hidden" : "min-w-0 text-body max-md:hidden"}>{teamLine}</span>
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted max-md:hidden">{w.openTasks} open</span>
                      <StatusBadge status={e.employmentStatus} />
                      <Icon name="chevronDown" size={18} strokeWidth={2.2} className="mt-0.5 text-body transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mb-4 ml-6 rounded-lg border border-border bg-background px-5 py-4">
                      <dl className="m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Fact label="Employee code">{e.employeeCode}</Fact>
                        <Fact label="Designation">{e.designation ?? "—"}</Fact>
                        <Fact label="Phone">{e.phone ?? "—"}</Fact>
                        <Fact label="Joined">{e.joiningDate ?? "—"}</Fact>
                        <Fact label="Sign-in">{e.hasAccount ? "Has an account" : "Not invited yet"}</Fact>
                        <Fact label="Tasks">{w.totalTasks === 0 ? "None" : `${w.totalTasks} (${w.openTasks} open)`}</Fact>
                        <div className="sm:col-span-2">
                          <Fact label="Teams">
                            {w.teams.length === 0 ? (
                              <span className="text-muted">Not on a team. Add them from the Team tab.</span>
                            ) : (
                              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                                {w.teams.map((t) => (
                                  <li key={t.teamId} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-ink">
                                    {t.team} · {t.department}
                                    {t.role === "lead" ? " · Lead" : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Fact>
                        </div>
                      </dl>
                      <p className="mb-0 mt-4 text-sm">
                        <Link href={`/employees/${e.id}`} className="font-medium text-primary-ink hover:text-primary-hover">
                          Open full profile
                        </Link>
                      </p>
                    </div>
                  </details>
                  {canEdit ? (
                    <Link href={`/employees/${e.id}/edit`} aria-label={`Edit ${e.fullName}`} className={buttonClass("secondary", "mt-3 min-h-9 px-3 text-xs")}>
                      Edit
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pager page={page} pages={pages} prevHref={page > 1 ? link({ page: page - 1 }) : undefined} nextHref={page < pages ? link({ page: page + 1 }) : undefined} />
    </div>
  );
}
