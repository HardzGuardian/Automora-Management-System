import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusView, TONE_CLASS } from "@/components/ui/status";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { projectsOverview } from "@/modules/projects";
import { allowedTransitions, listTasks, type TaskDTO } from "@/modules/tasks";
import { projectTaskAssigneeAction, projectTaskStatusAction, toggleTaskDoneAction } from "../projects/actions";

export const metadata = { title: "Tasks" };

type SP = { show?: string; project?: string; layout?: string; error?: string };
const SHOWS = [
  { key: "all", label: "All" },
  { key: "mine", label: "My tasks" },
  { key: "overdue", label: "Overdue" },
] as const;
type Show = (typeof SHOWS)[number]["key"];

const COLUMNS = [
  { status: "Pending", title: "Pending" },
  { status: "In Progress", title: "In progress" },
  { status: "In Review", title: "In review" },
  { status: "Completed", title: "Completed" },
] as const;
const LABEL: Record<string, string> = { Pending: "Pending", "In Progress": "In progress", "In Review": "In review", Completed: "Completed" };

function href(sp: SP, patch: Partial<SP>): string {
  const next = { ...sp, error: undefined, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v && !(k === "show" && v === "all") && !(k === "layout" && v === "list")) qs.set(k, v);
  const s = qs.toString();
  return s ? `/tasks?${s}` : "/tasks";
}

const assignee = (t: TaskDTO) => t.assignees[0];

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const show: Show = SHOWS.find((s) => s.key === sp.show)?.key ?? "all";
  const board = sp.layout === "board";
  const projects = await projectsOverview(actor);
  const projectId = projects.find((p) => p.id === sp.project)?.id;
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const today = todayInTz(actor.timezone);

  const base = { projectId, includeArchived: false } as const;
  const [list, nAll, nMine, nOverdue] = await Promise.all([
    listTasks(actor, { ...base, view: show === "mine" ? "mine" : "all", overdue: show === "overdue" || undefined, pageSize: 100 }),
    listTasks(actor, { ...base, view: "all", pageSize: 1 }),
    listTasks(actor, { ...base, view: "mine", pageSize: 1 }),
    listTasks(actor, { ...base, view: "all", overdue: true, pageSize: 1 }),
  ]);
  const counts: Record<Show, number> = { all: nAll.total, mine: nMine.total, overdue: nOverdue.total };
  const rows = list.rows;

  const canAssign = can(actor, "tasks.assign");
  const people = canAssign && can(actor, "employees.read") ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows : [];
  const personOptions = people.map((e) => ({ value: e.id, label: e.fullName }));
  const returnTo = href(sp, {});
  const isLate = (t: TaskDTO) => t.status !== "Completed" && t.dueDate !== null && t.dueDate < today;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
        <p className="mt-1 text-muted">Every task belongs to a project and is assigned to one person by an admin.</p>
      </div>

      {sp.error ? <Alert tone="error">{sp.error.slice(0, 300)}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            label="Filter tasks"
            pills={SHOWS.map((s) => ({ label: s.label, href: href(sp, { show: s.key }), count: counts[s.key], active: show === s.key }))}
          />
          <form className="flex items-center gap-2">
            {show !== "all" ? <input type="hidden" name="show" value={show} /> : null}
            {board ? <input type="hidden" name="layout" value="board" /> : null}
            <label htmlFor="proj-filter" className="sr-only">Filter by project</label>
            <select id="proj-filter" name="project" defaultValue={projectId ?? ""} className="h-10 rounded-lg border border-field bg-surface px-2.5 text-foreground">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-field bg-surface px-4 font-medium hover:bg-primary-soft">Apply</button>
          </form>
        </div>
        <nav aria-label="Layout" className="inline-flex overflow-hidden rounded-lg border border-field bg-surface">
          {(["list", "board"] as const).map((l) => {
            const on = (l === "board") === board;
            return (
              <Link
                key={l}
                href={href(sp, { layout: l })}
                aria-current={on ? "true" : undefined}
                className={cn("inline-flex h-10 items-center px-4 font-medium", on ? "bg-primary-soft text-primary-ink" : "bg-surface text-foreground hover:bg-primary-soft")}
              >
                {l === "list" ? "List" : "Board"}
              </Link>
            );
          })}
        </nav>
      </div>

      {!board ? (
        <section aria-label="Tasks" className="overflow-x-auto rounded-lg border border-border bg-surface">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-muted">No tasks match these filters. Choose All, or use New task at the top right.</p>
          ) : (
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="w-11 py-3 pl-5 pr-2"><span className="sr-only">Done</span></th>
                  <th scope="col" className="p-3 font-medium">Task</th>
                  <th scope="col" className="p-3 font-medium">Project</th>
                  <th scope="col" className="p-3 font-medium">Assigned to</th>
                  <th scope="col" className="p-3 font-medium">Due</th>
                  <th scope="col" className="py-3 pl-3 pr-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const done = t.status === "Completed";
                  const late = isLate(t);
                  const who = assignee(t);
                  const v = statusView(t.status, { overdue: late });
                  const statusOptions = Array.from(new Set([t.status, ...allowedTransitions(t.status)])).map((s) => ({ value: s, label: LABEL[s] ?? s }));
                  return (
                    <tr key={t.id} className="border-t border-border">
                      <td className="py-1.5 pl-3.5 pr-2">
                        <form action={toggleTaskDoneAction}>
                          <input type="hidden" name="taskId" value={t.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button type="submit" aria-pressed={done} aria-label={`${done ? "Reopen" : "Complete"} ${t.title}`} className="inline-flex size-11 items-center justify-center">
                            <span className={cn("inline-flex size-[22px] items-center justify-center rounded-md border-[1.5px]", done ? "border-primary bg-primary" : "border-[#8fa89a] bg-surface")}>
                              {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                            </span>
                          </button>
                        </form>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/tasks/${t.id}`} className={cn("font-medium hover:text-primary-ink", done ? "text-muted line-through" : "text-foreground")}>
                          {t.title}
                        </Link>
                        <div className="text-xs text-muted">{t.taskCode}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {t.projectId ? (
                          <Link href={`/projects/${t.projectId}`} className="font-medium text-primary-ink hover:text-primary-hover">
                            {projectName.get(t.projectId) ?? "Project"}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {canAssign && personOptions.length > 0 ? (
                          <AutoSubmitSelect
                            action={projectTaskAssigneeAction}
                            name="employeeId"
                            value={who?.employeeId ?? ""}
                            label={`Assigned to for ${t.title}`}
                            hidden={{ taskId: t.id, returnTo }}
                            options={[...(who ? [] : [{ value: "", label: "Unassigned" }]), ...personOptions]}
                            className="w-[140px] border-field bg-surface text-foreground"
                          />
                        ) : (
                          <span>{who?.fullName ?? "—"}</span>
                        )}
                      </td>
                      <td className={cn("px-3 py-2.5 tabular-nums", late ? "text-danger" : "text-body")}>{t.dueDate ?? "—"}</td>
                      <td className="py-2.5 pl-3 pr-5">
                        {can(actor, "tasks.update") || can(actor, "tasks.status.update.own") ? (
                          <div className="flex items-center gap-2">
                            <AutoSubmitSelect
                              action={projectTaskStatusAction}
                              name="status"
                              value={t.status}
                              label={`Status for ${t.title}`}
                              hidden={{ taskId: t.id, returnTo }}
                              options={statusOptions}
                              className={cn("h-[34px]! rounded-full border-transparent px-2 text-xs font-medium", TONE_CLASS[v.tone])}
                            />
                            {late ? <span className="text-xs font-semibold text-danger">Overdue</span> : null}
                          </div>
                        ) : (
                          <StatusBadge status={t.status} overdue={late} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {list.total > rows.length ? <p className="border-t border-border px-5 py-3 text-xs text-muted">Showing the first {rows.length} of {list.total}. Filter by project to see the rest.</p> : null}
        </section>
      ) : (
        <div className="grid grid-cols-[repeat(4,minmax(220px,1fr))] items-start gap-4 overflow-x-auto">
          {COLUMNS.map((c) => {
            const cards = rows.filter((t) => t.status === c.status);
            return (
              <section key={c.status} aria-label={c.title} className="flex flex-col gap-2.5 rounded-lg bg-[#ecefec] p-3">
                <h2 className="m-0 flex justify-between px-1 text-sm font-semibold">
                  <span>{c.title}</span>
                  <span className="tabular-nums text-muted">{cards.length}</span>
                </h2>
                {cards.map((t) => {
                  const late = isLate(t);
                  const who = assignee(t);
                  return (
                    <article key={t.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                      <Link href={`/tasks/${t.id}`} className="font-medium text-foreground hover:text-primary-ink">{t.title}</Link>
                      <div className="text-xs text-muted">
                        {t.taskCode}
                        {t.projectId ? ` · ${projectName.get(t.projectId) ?? "Project"}` : ""}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[13px]">
                          <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                            {who ? who.fullName.slice(0, 1).toUpperCase() : "?"}
                          </span>
                          {who?.fullName ?? "Unassigned"}
                        </span>
                        <span className={cn("text-xs tabular-nums", late ? "text-danger" : "text-muted")}>{late ? `Overdue · ${t.dueDate}` : (t.dueDate ?? "")}</span>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
