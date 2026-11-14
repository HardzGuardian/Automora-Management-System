import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { getDashboard } from "@/modules/reports";

export const metadata = { title: "Dashboard" };

const SUBTITLE = {
  company: "Open work across all projects.",
  operational: "Open work across the projects you manage.",
  personal: "Your open work across all projects.",
} as const;

function Card({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-[13px] font-medium text-primary-ink hover:text-primary-hover">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();

  let dash;
  try {
    dash = await getDashboard(actor, { preset: "month" });
  } catch (e) {
    if (e instanceof DomainError && e.code === "FORBIDDEN") {
      return <ErrorState title="No dashboard available" message="Your role does not include a dashboard. Ask an administrator for access." />;
    }
    throw e;
  }
  const c = dash.counts;
  const personal = dash.audience === "personal";
  const tasksHref = personal ? "/my-tasks" : "/tasks";
  const overdueHref = `${tasksHref}?overdue=1`;

  // Design: one "Due soon" table, overdue work first, then what is coming up.
  const dueSoon = [...dash.overdue.map((t) => ({ ...t, late: true })), ...dash.upcoming.map((t) => ({ ...t, late: false }))].slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted">{SUBTITLE[dash.audience]}</p>
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open tasks" value={c.openTasks} icon="tasks" hint={personal ? "Assigned to you" : "Across everything you can see"} href={tasksHref} />
        <KpiCard label="In progress" value={c.inProgressTasks} icon="inProgress" tone="info" hint="Being worked on now" />
        <KpiCard label="Overdue" value={c.overdueTasks} icon="overdue" tone={c.overdueTasks > 0 ? "danger" : "neutral"} hint="Past their due date" href={overdueHref} />
        <KpiCard label="Active projects" value={c.activeProjects} icon="projects" tone="success" hint="Currently running" href="/projects" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_520px]">
          <Card title="Due soon" action={{ href: tasksHref, label: "All tasks" }}>
            {dueSoon.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted">Nothing is due or overdue. Nice work.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th scope="col" className="px-5 py-2.5 font-medium">Task</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Project</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                      <th scope="col" className="py-2.5 pl-3 pr-5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoon.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="px-5 py-3">
                          <Link href={t.href} className="font-medium text-foreground hover:text-primary-ink">
                            {t.title}
                          </Link>
                          <div className="text-xs text-muted">{t.taskCode}</div>
                        </td>
                        <td className="px-3 py-3 text-body">{t.projectName ?? "—"}</td>
                        <td className={t.late ? "px-3 py-3 tabular-nums text-danger" : "px-3 py-3 tabular-nums text-body"}>{t.dueDate}</td>
                        <td className="py-3 pl-3 pr-5">
                          <StatusBadge status={t.status} overdue={t.late} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 flex-[1_1_320px]">
          <Card title="Active projects" action={{ href: "/projects", label: "All projects" }}>
            {dash.activeProjectList.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted">
                No active projects yet. <Link href="/projects" className={linkClass}>Open Projects</Link>
              </p>
            ) : (
              <ul className="px-5 pb-2 pt-1">
                {dash.activeProjectList.map((p) => (
                  <li key={p.id} className="border-t border-border py-3 first:border-t-0">
                    <div className="flex justify-between gap-3">
                      <Link href={p.href} className="font-medium text-foreground hover:text-primary-ink">
                        {p.name}
                      </Link>
                      <span className="tabular-nums text-muted">{p.percent}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-primary-soft" role="progressbar" aria-label={`${p.name} progress`} aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-1.5 bg-primary" style={{ width: `${p.percent}%` }} />
                    </div>
                    <div className="mt-1.5 text-xs text-muted">
                      {p.openTasks} {p.openTasks === 1 ? "task" : "tasks"} open{p.dueDate ? ` · due ${p.dueDate}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
