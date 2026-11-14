import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { projectsOverview } from "@/modules/projects";

export const metadata = { title: "Projects" };

// Design pills. Planning and Cancelled projects still show under All.
const PILLS = [
  { label: "All", status: null },
  { label: "Active", status: "Active" },
  { label: "On hold", status: "On Hold" },
  { label: "Completed", status: "Completed" },
] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const all = await projectsOverview(actor);
  const current = PILLS.find((p) => p.label === sp.status) ?? PILLS[0];
  const rows = current.status ? all.filter((r) => r.status === current.status) : all;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-muted">Create a project, add its documents and give it to a team.</p>
        </div>
        {can(actor, "projects.create") ? (
          <Link href="/projects/new" className={buttonClass("primary", "gap-2")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            New project
          </Link>
        ) : null}
      </div>

      <FilterPills
        label="Filter by status"
        pills={PILLS.map((p) => ({
          label: p.label,
          href: p.status ? `/projects?status=${encodeURIComponent(p.label)}` : "/projects",
          count: p.status ? all.filter((r) => r.status === p.status).length : all.length,
          active: p.label === current.label,
        }))}
      />

      <section aria-label="Projects" tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted">
            {all.length === 0 ? "No projects yet." : `No ${current.label.toLowerCase()} projects.`}
          </p>
        ) : (
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="w-[32%] py-3.5 pl-6 pr-3 font-medium">Project</th>
                <th scope="col" className="w-[20%] px-3 py-3.5 font-medium">Team</th>
                <th scope="col" className="w-[22%] px-3 py-3.5 font-medium">Progress</th>
                <th scope="col" className="w-[12%] px-3 py-3.5 font-medium">Due</th>
                <th scope="col" className="w-[14%] py-3.5 pl-3 pr-6 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-[18px] pl-6 pr-3">
                    <Link href={`/projects/${r.id}`} className="font-semibold text-foreground hover:text-primary-ink">
                      {r.name}
                    </Link>
                    {r.clientName ? <div className="mt-0.5 text-xs text-muted">{r.clientName}</div> : null}
                  </td>
                  <td className="px-3 py-[18px]">
                    {r.teamName ? (
                      <>
                        <div className="font-medium">{r.teamName}</div>
                        <div className="mt-0.5 text-xs text-muted">{r.departmentName}</div>
                      </>
                    ) : (
                      <span className="text-muted">No team yet</span>
                    )}
                  </td>
                  <td className="px-3 py-[18px]">
                    <div
                      className="h-1.5 overflow-hidden rounded-sm bg-primary-soft"
                      role="progressbar"
                      aria-label={`${r.name} progress`}
                      aria-valuenow={r.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-1.5 bg-primary" style={{ width: `${r.percent}%` }} />
                    </div>
                    <div className="mt-1.5 text-xs tabular-nums text-muted">
                      {r.percent}% · {r.openTasks} open
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-[18px] tabular-nums text-body">{r.dueDate ?? "—"}</td>
                  <td className="py-[18px] pl-3 pr-6">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
