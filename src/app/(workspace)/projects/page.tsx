import Link from "next/link";
import { AutoForm } from "@/components/ui/auto-form";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusView, TONE_CLASS } from "@/components/ui/status";
import { Pager } from "@/components/ui/pager";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { projectsOverview, type ProjectOverviewRow } from "@/modules/projects";
import { listTasks, rowControls, type TaskDTO } from "@/modules/tasks";
import { projectTaskStatusAction, toggleTaskDoneAction } from "./actions";

export const metadata = { title: "Projects" };

// Planning and Cancelled projects still show under All.
const PILLS = [
  { label: "All", status: null },
  { label: "Active", status: "Active" },
  { label: "On hold", status: "On Hold" },
  { label: "Completed", status: "Completed" },
  { label: "Archived", status: "Archived" },
] as const;

const SORTS = [
  { key: "name", label: "Name" },
  { key: "due", label: "Due date" },
  { key: "progress", label: "Progress" },
  { key: "status", label: "Status" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const STATUS_ORDER = ["Active", "Planning", "On Hold", "Completed", "Cancelled", "Archived"];
const byDue = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1); // no date last

function sortRows(rows: ProjectOverviewRow[], key: SortKey): ProjectOverviewRow[] {
  const out = [...rows];
  if (key === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  if (key === "due") out.sort((a, b) => byDue(a.dueDate, b.dueDate) || a.name.localeCompare(b.name));
  if (key === "progress") out.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  if (key === "status") out.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
  return out;
}

const LABEL: Record<string, string> = { Pending: "Pending", "In Progress": "In progress", "In Review": "In review", Completed: "Completed" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string; project?: string; error?: string; q?: string; page?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const [all, archived] = await Promise.all([projectsOverview(actor, { search: q }), projectsOverview(actor, { archived: true, search: q })]);
  const current = PILLS.find((p) => p.label === sp.status) ?? PILLS[0];
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? "name";
  const pool = current.status === "Archived" ? archived : current.status ? all.filter((r) => r.status === current.status) : all;

  // Every project shows the tasks that belong to it (and its team). People who cannot read every task see only theirs.
  const personal = !can(actor, "tasks.read.all");
  const today = todayInTz(actor.timezone);

  // The project picker lists active projects that still have a task with a due date. The chosen one narrows the tab.
  const pickable = all.filter((r) => r.status === "Active" && r.openTasks > 0);
  const chosen = pool.find((r) => r.id === sp.project) ?? all.find((r) => r.id === sp.project);
  const picker = chosen && !pickable.some((r) => r.id === chosen.id) ? [...pickable, chosen] : pickable;
  const sorted = sortRows(chosen ? [chosen] : pool, sort);
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const keep = { ...(sp.status ? { status: sp.status } : {}), ...(sp.sort ? { sort: sp.sort } : {}), ...(chosen ? { project: chosen.id } : {}), ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) };
  const returnTo = `/projects${Object.keys(keep).length ? `?${new URLSearchParams(keep).toString()}` : ""}`;
  const pageHref = (n: number) => `/projects?${new URLSearchParams({ ...keep, page: String(n) }).toString()}`;

  // Tasks only for the projects on this page (each project shows its own tasks).
  const taskLists = await Promise.all(rows.map((r) => listTasks(actor, { view: personal ? "mine" : "all", projectId: r.id, pageSize: 100, sort: "due" })));
  const tasksByProject = new Map<string, TaskDTO[]>(rows.map((r, i) => [r.id, taskLists[i].rows]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-muted">Each project is given to a team and holds its tasks. Open one to see them.</p>
        </div>
        {can(actor, "projects.create") ? (
          <Link href="/projects/new" className={buttonClass("primary", "gap-2")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            New project
          </Link>
        ) : null}
      </div>

      {sp.error ? <p role="alert" className="m-0 rounded-lg bg-danger-soft px-4 py-3 font-medium text-danger">{sp.error.slice(0, 300)}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Filter by status"
          pills={PILLS.map((p) => ({
            label: p.label,
            href: p.status ? `/projects?status=${encodeURIComponent(p.label)}${sp.sort ? `&sort=${sort}` : ""}` : sp.sort ? `/projects?sort=${sort}` : "/projects",
            count: p.status === "Archived" ? archived.length : p.status ? all.filter((r) => r.status === p.status).length : all.length,
            active: p.label === current.label,
          }))}
        />
        <AutoForm className="flex flex-wrap items-center gap-2" label="Choose project and sort">
          {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <label htmlFor="project-pick" className="sr-only">Show project</label>
          <select id="project-pick" name="project" defaultValue={chosen?.id ?? ""} className="h-10 max-w-[14rem] rounded-lg border border-field bg-surface px-2.5 text-foreground">
            <option value="">All projects</option>
            {picker.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <label htmlFor="project-sort" className="text-sm text-muted">Sort by</label>
          <select id="project-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-field bg-surface px-2.5 text-foreground">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </AutoForm>
      </div>

      <form method="get" aria-label="Search projects" className="flex flex-wrap items-center gap-2">
        {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
        {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
        <label htmlFor="project-search" className="sr-only">Search projects</label>
        <input id="project-search" name="q" defaultValue={q ?? ""} placeholder="Search by name or code" className={`${inputClass} max-w-xs`} />
        <button type="submit" className={buttonClass("secondary")}>Search</button>
        {q ? <Link href="/projects" className={buttonClass("secondary")}>Clear</Link> : null}
      </form>

      <section aria-label="Projects" className="overflow-hidden rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted">{all.length === 0 ? "No projects yet." : `No ${current.label.toLowerCase()} projects.`}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((r, i) => {
              const tasks = tasksByProject.get(r.id) ?? [];
              return (
                <li key={r.id} className="border-t border-border first:border-t-0">
                  <details open={i === 0 || chosen ? true : undefined} className="group">
                    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto_auto] items-start gap-x-4 gap-y-1 px-6 py-[18px] max-md:grid-cols-[minmax(0,1fr)_auto]">
                      <span className="min-w-0">
                        <span className="font-semibold text-foreground">{r.name}</span>
                        {r.clientName ? <span className="mt-0.5 block text-xs text-muted">{r.clientName}</span> : null}
                      </span>
                      <span className="min-w-0 max-md:hidden">
                        {r.teamName ? (
                          <>
                            <span className="block font-medium">{r.teamName}</span>
                            <span className="mt-0.5 block text-xs text-muted">{r.departmentName}</span>
                          </>
                        ) : (
                          <span className="text-muted">No team yet</span>
                        )}
                      </span>
                      <span className="min-w-0 max-md:hidden">
                        <span className="block h-1.5 overflow-hidden rounded-sm bg-primary-soft" role="progressbar" aria-label={`${r.name} progress`} aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100}>
                          <span className="block h-1.5 bg-primary" style={{ width: `${r.percent}%` }} />
                        </span>
                        <span className="mt-1.5 block text-xs tabular-nums text-muted">{r.percent}% · {r.openTasks} open</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums text-body max-md:hidden">{r.dueDate ?? "—"}</span>
                      <StatusBadge status={r.status} />
                      <Icon name="chevronDown" size={18} strokeWidth={2.2} className="mt-0.5 text-body transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="border-t border-border bg-background px-6 py-4">
                      <p className="m-0 mb-3 text-sm">
                        <Link href={`/projects/${r.id}`} className="font-medium text-primary-ink hover:text-primary-hover">Open project details</Link>
                      </p>
                      {tasks.length === 0 ? (
                        <p className="m-0 text-sm text-muted">{personal ? "You have no tasks in this project." : "No tasks yet."}</p>
                      ) : (
                        <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-sm">
                          <caption className="sr-only">Tasks in {r.name}</caption>
                          <thead>
                            <tr className="text-left text-xs text-muted">
                              <th scope="col" className="w-11 py-2 pr-2"><span className="sr-only">Done</span></th>
                              <th scope="col" className="px-3 py-2 font-medium">Task</th>
                              <th scope="col" className="px-3 py-2 font-medium">Assigned to</th>
                              <th scope="col" className="px-3 py-2 font-medium">Due</th>
                              <th scope="col" className="py-2 pl-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map((t) => {
                              const done = t.status === "Completed";
                              const late = !done && t.dueDate !== null && t.dueDate < today;
                              const ctl = rowControls(actor, t);
                              const options = ctl.statuses.map((s) => ({ value: s, label: LABEL[s] ?? s }));
                              const v = statusView(t.status, { overdue: late });
                              return (
                                <tr key={t.id} className="border-t border-border">
                                  <td className="py-1 pr-2">
                                    {ctl.canToggle ? (
                                      <form action={toggleTaskDoneAction}>
                                        <input type="hidden" name="taskId" value={t.id} />
                                        <input type="hidden" name="returnTo" value={returnTo} />
                                        <button type="submit" aria-pressed={done} aria-label={`${done ? "Reopen" : "Complete"} ${t.title}`} className="inline-flex size-11 items-center justify-center">
                                          <span className={cn("inline-flex size-[22px] items-center justify-center rounded-md border-[1.5px]", done ? "border-primary bg-primary" : "border-[#8fa89a] bg-surface")}>
                                            {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                                          </span>
                                        </button>
                                      </form>
                                    ) : (
                                      <span aria-hidden="true" className="inline-flex size-11 items-center justify-center">
                                        <span className={cn("inline-flex size-[22px] items-center justify-center rounded-md border-[1.5px]", done ? "border-primary bg-primary" : "border-[#d5dbd7] bg-surface")}>
                                          {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                                        </span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Link href={`/tasks/${t.id}`} className={cn("font-medium hover:text-primary-ink", done ? "text-muted line-through" : "text-foreground")}>{t.title}</Link>
                                    <div className="text-xs text-muted">{t.taskCode}</div>
                                  </td>
                                  <td className="px-3 py-2 text-body">{t.assignees.map((a) => a.fullName).join(", ") || "Unassigned"}</td>
                                  <td className={cn("px-3 py-2 tabular-nums", late ? "text-danger" : "text-body")}>{t.dueDate ?? "—"}</td>
                                  <td className="py-2 pl-3">
                                    {options.length > 1 ? (
                                      <div className="flex items-center gap-2">
                                        <AutoSubmitSelect
                                          action={projectTaskStatusAction}
                                          name="status"
                                          value={t.status}
                                          label={`Status for ${t.title}`}
                                          hidden={{ taskId: t.id, returnTo }}
                                          options={options}
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
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pager page={page} pages={pages} prevHref={page > 1 ? pageHref(page - 1) : undefined} nextHref={page < pages ? pageHref(page + 1) : undefined} />
    </div>
  );
}
