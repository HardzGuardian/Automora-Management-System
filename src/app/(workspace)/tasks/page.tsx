import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { ControlPanel, CompactPager, ViewSwitcher } from "@/components/ui/odoo";
import { SearchBox } from "@/components/ui/facet-search";
import { Priority } from "@/components/ui/priority";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusView, TONE_CLASS } from "@/components/ui/status";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { listTasks, rowControls, type ListTasksInput, type TaskDTO } from "@/modules/tasks";
import { projectTaskAssigneeAction, projectTaskStatusAction, toggleTaskDoneAction } from "../projects/actions";
import { bulkTasksAction } from "./actions";
import { SelectAll } from "./_components/select-all";
import { TaskBoard, type BoardCard } from "./_components/task-board";
import { TaskCalendar } from "./_components/task-calendar";
import { TaskSearch } from "@/components/ui/task-search";

export const metadata = { title: "Tasks" };

type SP = {
  show?: string;
  sort?: string;
  layout?: string;
  error?: string;
  q?: string;
  priority?: string;
  assignee?: string;
  project?: string;
  kind?: string;
  from?: string;
  to?: string;
  month?: string;
  page?: string;
};
const SORTS = [
  { key: "due", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "created", label: "Newest first", dir: "desc" },
] as const;
const SHOWS = [
  { key: "all", label: "All" },
  { key: "mine", label: "My tasks" },
  { key: "overdue", label: "Overdue" },
  { key: "archived", label: "Archived" },
] as const;
type Show = (typeof SHOWS)[number]["key"];
const LAYOUTS = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
] as const;
const PAGE_SIZE = 25;

const LABEL: Record<string, string> = { Pending: "Pending", "In Progress": "In progress", "In Review": "In review", Completed: "Completed" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function href(sp: SP, patch: Partial<SP>): string {
  const next = { ...sp, error: undefined, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v && !(k === "show" && v === "all") && !(k === "layout" && v === "list") && !(k === "page" && v === "1")) qs.set(k, v);
  const s = qs.toString();
  return s ? `/tasks?${s}` : "/tasks";
}

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  // People who cannot read every task get a personal page: their own tasks only.
  const personal = !can(actor, "tasks.read.all");
  const requested: Show = SHOWS.find((s) => s.key === sp.show)?.key ?? (personal ? "mine" : "all");
  const show: Show = personal && (requested === "all" || requested === "archived") ? "mine" : requested;
  const layout = LAYOUTS.find((l) => l.key === sp.layout)?.key ?? "list";
  const sort = SORTS.find((s) => s.key === sp.sort) ?? SORTS[0];
  const today = todayInTz(actor.timezone);
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const canAssign = can(actor, "tasks.assign");
  const canBulk = can(actor, "tasks.bulk");
  const [peopleRows, projectRows] = await Promise.all([
    can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }).then((r) => r.rows).catch(() => []) : Promise.resolve([]),
    listProjects(actor, { page: 1, pageSize: 100 }).then((r) => r.rows).catch(() => []),
  ]);
  const personOptions = peopleRows.map((e) => ({ value: e.id, label: e.fullName }));
  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  const priority = ["Low", "Medium", "High", "Critical"].includes(sp.priority ?? "") ? (sp.priority as "Low" | "Medium" | "High" | "Critical") : undefined;
  const assigneeId = peopleRows.find((e) => e.id === sp.assignee)?.id;
  const projectId = projectRows.find((p) => p.id === sp.project)?.id;
  const from = sp.from && ISO.test(sp.from) ? sp.from : undefined;
  const to = sp.to && ISO.test(sp.to) ? sp.to : undefined;

  const filters: ListTasksInput = {
    includeArchived: false,
    search: sp.q?.trim() || undefined,
    priority: priority ? [priority] : undefined,
    assigneeId,
    projectId,
    individualOnly: sp.kind === "individual" || undefined,
    dueFrom: layout === "calendar" ? `${month}-01` : from,
    dueTo: layout === "calendar" ? `${month}-31`.replace(/-31$/, `-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`) : to,
  };
  const view = personal || show === "mine" ? "mine" : "all";
  const base: ListTasksInput = { ...filters, view };
  const pageSize = layout === "list" ? PAGE_SIZE : 100;
  const [list, nAll, nMine, nOverdue, nArchived] = await Promise.all([
    listTasks(actor, { ...base, overdue: show === "overdue" || undefined, archivedOnly: show === "archived", sort: sort.key, dir: "dir" in sort ? sort.dir : "asc", page: layout === "list" ? page : 1, pageSize }),
    listTasks(actor, { ...filters, view: "all", pageSize: 1 }),
    listTasks(actor, { ...filters, view: "mine", pageSize: 1 }),
    listTasks(actor, { ...filters, view: personal ? "mine" : "all", overdue: true, pageSize: 1 }),
    can(actor, "tasks.archive") ? listTasks(actor, { ...filters, view: "all", archivedOnly: true, pageSize: 1 }) : Promise.resolve({ rows: [], total: 0 }),
  ]);
  const counts: Record<Show, number> = { all: nAll.total, mine: nMine.total, overdue: nOverdue.total, archived: nArchived.total };
  const rows = list.rows;
  const pages = Math.max(1, Math.ceil(list.total / pageSize));

  const returnTo = href(sp, {});
  const isLate = (t: TaskDTO) => t.status !== "Completed" && t.dueDate !== null && t.dueDate < today;
  const whoText = (t: TaskDTO) => (t.assignees.length === 0 ? "—" : t.assignees.map((a) => a.fullName).join(", "));
  const filtersActive = Boolean(sp.q || priority || assigneeId || projectId || from || to || sp.kind);

  // Active filters as Odoo facet chips; each chip removes just its own filter.
  const facetDefs: { label: string; value: string; key: keyof SP }[] = [];
  if (priority) facetDefs.push({ label: "Priority", value: priority, key: "priority" });
  if (assigneeId) facetDefs.push({ label: "Assignee", value: personOptions.find((p) => p.value === assigneeId)?.label ?? "", key: "assignee" });
  if (projectId) facetDefs.push({ label: "Project", value: projectName.get(projectId) ?? "", key: "project" });
  if (sp.kind === "individual") facetDefs.push({ label: "Type", value: "Individual", key: "kind" });
  if (from) facetDefs.push({ label: "Due from", value: from, key: "from" });
  if (to) facetDefs.push({ label: "Due to", value: to, key: "to" });
  const facets = facetDefs.map((f) => ({ label: f.label, value: f.value, removeHref: href(sp, { [f.key]: undefined, page: undefined }) }));

  return (
    <div className="flex flex-col gap-4">
      <ControlPanel
        crumbs={[{ label: personal ? "My tasks" : "Tasks" }]}
        description={personal ? "Your tasks across all projects." : undefined}
        actions={
          can(actor, "tasks.create") || can(actor, "tasks.create.in_project") ? (
            <Link href="/tasks/new" className={buttonClass("primary", "min-h-9 px-3.5")}>
              New<span className="sr-only"> task</span>
            </Link>
          ) : null
        }
        search={
          <form method="get" role="search" aria-label="Search tasks">
            {(["show", "layout", "sort", "month", "priority", "assignee", "project", "kind", "from", "to"] as const)
              .filter((k) => sp[k])
              .map((k) => (
                <input key={k} type="hidden" name={k} value={sp[k]} />
              ))}
            <SearchBox facets={facets}>
              <TaskSearch name="q" defaultValue={sp.q ?? ""} view={personal ? "mine" : "all"} placeholder="Search tasks by title or code..." />
            </SearchBox>
          </form>
        }
        filters={
          <>
            <FilterPills
              label="Filter tasks"
              pills={SHOWS.filter((s) => (personal ? s.key === "mine" || s.key === "overdue" : s.key !== "archived" || can(actor, "tasks.archive"))).map((s) => ({ label: s.label, href: href(sp, { show: s.key, page: undefined }), count: counts[s.key], active: show === s.key }))}
            />
            <details className="group relative">
              <summary className={cn(buttonClass("secondary", "min-h-8 cursor-pointer list-none gap-1.5 px-3 text-[13px]"), facets.length > 0 && "border-primary/40 text-primary-ink")}>
                <Icon name="filter" size={15} />
                Filters{facets.length > 0 ? ` (${facets.length})` : ""}
                <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-20 mt-1.5 w-[min(560px,92vw)] rounded-xl border border-border bg-surface p-4 shadow-[var(--elev-3)]">
                <form method="get" aria-label="Task filters" className="grid gap-3 sm:grid-cols-2">
                  {(["show", "layout", "month", "q"] as const)
                    .filter((k) => sp[k])
                    .map((k) => (
                      <input key={k} type="hidden" name={k} value={sp[k]} />
                    ))}
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Priority
                    <select name="priority" defaultValue={priority ?? ""} className={inputClass}>
                      <option value="">Any</option>
                      <option>Critical</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </label>
                  {personOptions.length > 0 && !personal ? (
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Assignee
                      <select name="assignee" defaultValue={assigneeId ?? ""} className={inputClass}>
                        <option value="">Anyone</option>
                        {personOptions.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Project
                    <select name="project" defaultValue={projectId ?? ""} className={inputClass}>
                      <option value="">Any project</option>
                      {projectRows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Type
                    <select name="kind" defaultValue={sp.kind === "individual" ? "individual" : ""} className={inputClass}>
                      <option value="">Project and individual</option>
                      <option value="individual">Individual only (no project)</option>
                    </select>
                  </label>
                  {layout !== "calendar" ? (
                    <>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Due from
                        <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Due to
                        <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
                      </label>
                      <label htmlFor="task-sort" className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Sort by
                        <select id="task-sort" name="sort" defaultValue={sort.key} className={inputClass}>
                          {SORTS.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <button type="submit" className={buttonClass("primary", "min-h-9")}>
                      Apply filters
                    </button>
                    {filtersActive ? (
                      <Link href={href({ show: sp.show, layout: sp.layout }, {})} className={buttonClass("ghost", "min-h-9")}>
                        Clear all
                      </Link>
                    ) : null}
                  </div>
                </form>
              </div>
            </details>
          </>
        }
        pager={
          layout === "list" && pages > 1 ? (
            <CompactPager
              from={(page - 1) * PAGE_SIZE + 1}
              to={Math.min(page * PAGE_SIZE, list.total)}
              total={list.total}
              prevHref={page > 1 ? href(sp, { page: String(page - 1) }) : undefined}
              nextHref={page < pages ? href(sp, { page: String(page + 1) }) : undefined}
            />
          ) : null
        }
        views={
          <ViewSwitcher
            label="Layout"
            items={LAYOUTS.map((l) => ({ key: l.key, label: l.label, icon: l.key === "board" ? "kanban" : l.key === "calendar" ? "calendar" : "list", href: href(sp, { layout: l.key, page: undefined }), active: l.key === layout }))}
          />
        }
      />

      {sp.error ? <Alert tone="error">{sp.error.slice(0, 300)}</Alert> : null}

      {layout === "calendar" ? (
        <TaskCalendar
          month={month}
          today={today}
          prevHref={href(sp, { month: shiftMonth(month, -1) })}
          nextHref={href(sp, { month: shiftMonth(month, 1) })}
          todayHref={href(sp, { month: undefined })}
          tasks={rows.filter((t) => t.dueDate).map((t) => ({ id: t.id, taskCode: t.taskCode, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate as string, late: isLate(t) }))}
        />
      ) : layout === "board" ? (
        <TaskBoard
          cards={rows.map<BoardCard>((t) => ({
            id: t.id,
            taskCode: t.taskCode,
            title: t.title,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate,
            late: isLate(t),
            assignees: t.assignees.map((a) => a.fullName),
            projectName: t.projectId ? (projectName.get(t.projectId) ?? null) : null,
            moves: rowControls(actor, t).statuses.filter((s) => s !== t.status),
          }))}
        />
      ) : (
        <>
          {canBulk && rows.length > 0 && show !== "archived" ? (
            <form id="bulk-form" action={bulkTasksAction} aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <input type="hidden" name="returnTo" value={returnTo} />
              <span className="font-medium">With ticked tasks:</span>
              <select name="op" aria-label="Bulk action" defaultValue="status" className="h-9 rounded-md border border-field bg-surface px-2">
                <option value="status">Set status</option>
                {canAssign ? <option value="assign">Add assignee</option> : null}
                {can(actor, "tasks.archive") ? <option value="archive">Archive</option> : null}
              </select>
              <select name="status" aria-label="New status" className="h-9 rounded-md border border-field bg-surface px-2">
                {Object.entries(LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {canAssign && personOptions.length > 0 ? (
                <select name="employeeId" aria-label="Person to add" className="h-9 rounded-md border border-field bg-surface px-2">
                  {personOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <button type="submit" className={buttonClass("secondary")}>
                Apply
              </button>
              <span className="text-xs text-muted">Status applies to Set status; person to Add assignee.</span>
            </form>
          ) : null}
          <section aria-label="Tasks" tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-surface">
            {rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-muted">{filtersActive ? "No tasks match these filters." : "No tasks here yet."}</p>
            ) : (
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    {canBulk && show !== "archived" ? (
                      <th scope="col" className="w-10 py-3 pl-4">
                        <SelectAll />
                      </th>
                    ) : null}
                    <th scope="col" className="w-11 py-3 pl-3 pr-2">
                      <span className="sr-only">Done</span>
                    </th>
                    <th scope="col" className="p-3 font-medium">Task</th>
                    <th scope="col" className="p-3 font-medium">Project</th>
                    <th scope="col" className="p-3 font-medium">Priority</th>
                    {personal ? null : <th scope="col" className="p-3 font-medium">Assigned to</th>}
                    <th scope="col" className="p-3 font-medium">Due</th>
                    <th scope="col" className="py-3 pl-3 pr-5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const done = t.status === "Completed";
                    const late = isLate(t);
                    const v = statusView(t.status, { overdue: late });
                    const ctl = rowControls(actor, t);
                    const statusOptions = ctl.statuses.map((s) => ({ value: s, label: LABEL[s] ?? s }));
                    const single = t.assignees.length <= 1;
                    return (
                      <tr key={t.id} className="border-t border-border">
                        {canBulk && show !== "archived" ? (
                          <td className="py-2.5 pl-4">
                            <input type="checkbox" form="bulk-form" name="taskId" value={t.id} aria-label={`Select ${t.title}`} className="size-4" />
                          </td>
                        ) : null}
                        <td className="py-1.5 pl-2 pr-2">
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
                              <span className={cn("inline-flex size-[22px] items-center justify-center rounded-md border-[1.5px]", done ? "border-primary bg-primary" : "border-[#d5dbd7] bg-background")}>
                                {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/tasks/${t.id}`} className={cn("font-medium hover:text-primary-ink", done ? "text-muted line-through" : "text-foreground")}>
                            {t.title}
                          </Link>
                          <div className="text-xs text-muted">{t.taskCode}</div>
                        </td>
                        <td className="px-3 py-2.5 text-body">
                          {t.projectId ? (
                            <Link href={`/projects/${t.projectId}`} className="hover:text-primary-ink">
                              {projectName.get(t.projectId) ?? "Project"}
                            </Link>
                          ) : (
                            <span className="text-muted">Individual</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><Priority value={t.priority} /></td>
                        {personal ? null : (
                          <td className="px-3 py-2.5">
                            {canAssign && personOptions.length > 0 && single && !t.archived ? (
                              <AutoSubmitSelect
                                action={projectTaskAssigneeAction}
                                name="employeeId"
                                value={t.assignees[0]?.employeeId ?? ""}
                                label={`Assigned to for ${t.title}`}
                                hidden={{ taskId: t.id, returnTo }}
                                options={[...(t.assignees[0] ? [] : [{ value: "", label: "Unassigned" }]), ...personOptions]}
                                className="w-[140px] border-field bg-surface text-foreground"
                              />
                            ) : (
                              <span title={whoText(t)}>{t.assignees.length > 1 ? `${t.assignees[0].fullName} +${t.assignees.length - 1}` : whoText(t)}</span>
                            )}
                          </td>
                        )}
                        <td className={cn("px-3 py-2.5 tabular-nums", late ? "text-danger" : "text-body")}>{t.dueDate ?? "—"}</td>
                        <td className="py-2.5 pl-3 pr-5">
                          {statusOptions.length > 1 ? (
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
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-xs text-muted">
              {list.total === 0 ? "" : `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + rows.length} of ${list.total}`}
            </p>
          </div>
        </>
      )}
      {layout !== "list" && list.total > rows.length ? <p className="text-xs text-muted">Showing the first {rows.length} of {list.total}. Narrow the filters to see the rest.</p> : null}
    </div>
  );
}
