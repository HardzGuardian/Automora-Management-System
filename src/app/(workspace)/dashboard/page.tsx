import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { projectsOverview } from "@/modules/projects";
import { getTeamWork } from "@/modules/teams";
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

type Step = { title: string; text: string; href: string; done: boolean };

/** First-run help for whoever sets the company up: what to do first, until each is done. */
async function setupSteps(actor: Awaited<ReturnType<typeof requireActor>>): Promise<Step[]> {
  if (!can(actor, "projects.create")) return [];
  const [people, teams, clients, projects] = await Promise.all([
    can(actor, "employees.read") ? listEmployees(actor, { pageSize: 1 }).then((r) => r.total).catch(() => 0) : Promise.resolve(2),
    getTeamWork(actor).then((r) => r.teams.length).catch(() => 0),
    can(actor, "clients.read") ? listClients(actor, { page: 1, pageSize: 1 }).then((r) => r.total).catch(() => 0) : Promise.resolve(1),
    projectsOverview(actor).then((r) => r.length).catch(() => 0),
  ]);
  return [
    { title: "Add your people", text: "Create each employee, then send them an invitation.", href: "/employees/new", done: people > 1 },
    { title: "Create a team", text: "A department and a team, with the people who work together.", href: "/teams", done: teams > 0 },
    { title: "Add a client", text: "The company you build projects for.", href: "/clients/new", done: clients > 0 },
    { title: "Create a project", text: "Details, reference files and the team that will do the work.", href: "/projects/new", done: projects > 0 },
  ];
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
  const steps = await setupSteps(actor);
  const c = dash.counts;
  const personal = dash.audience === "personal";
  const tasksHref = personal ? "/tasks?show=mine" : "/tasks";
  const overdueHref = "/tasks?show=overdue";

  // Design: one "Due soon" table, overdue work first, then what is coming up.
  const dueSoon = [...dash.overdue.map((t) => ({ ...t, late: true })), ...dash.upcoming.map((t) => ({ ...t, late: false }))].slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted">{SUBTITLE[dash.audience]}</p>
      </div>

      {steps.length > 0 && steps.some((x) => !x.done) ? (
        <section aria-label="Get started" className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="m-0 text-base font-semibold text-foreground">Get started</h2>
          </div>
          <ol className="m-0 grid list-none gap-0 p-0 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((x, i) => (
              <li key={x.title} className="flex flex-col gap-1.5 border-t border-border px-5 py-4 first:border-t-0 md:border-r md:border-t-0 md:last:border-r-0">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <span aria-hidden="true" className={x.done ? "inline-flex size-6 items-center justify-center rounded-full bg-primary text-white" : "inline-flex size-6 items-center justify-center rounded-full border border-field text-xs text-muted"}>
                    {x.done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  {x.title}
                  <span className="sr-only">{x.done ? " (done)" : " (to do)"}</span>
                </span>
                <span className="text-xs text-muted">{x.text}</span>
                {x.done ? null : (
                  <Link href={x.href} className="mt-1 text-[13px] font-medium text-primary-ink hover:text-primary-hover">
                    Start
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Open tasks" value={c.openTasks} icon="tasks" href={tasksHref} />
        <KpiCard label="Overdue" value={c.overdueTasks} icon="overdue" tone={c.overdueTasks > 0 ? "danger" : "neutral"} href={overdueHref} />
        <KpiCard label="Active projects" value={c.activeProjects} icon="projects" tone="success" href="/projects" />
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
