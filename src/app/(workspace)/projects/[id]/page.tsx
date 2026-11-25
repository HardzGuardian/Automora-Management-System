import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamAssignSection } from "@/components/teams/team-assign-section";
import { Alert } from "@/components/ui/alert";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Chatter } from "@/components/ui/chatter";
import { FieldGrid, FormView, NotebookTabs, SheetTitle, SmartButtons, StatusBar, type Stage } from "@/components/ui/odoo";
import { auditChatterEntries } from "../../_components/audit-chatter";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusView, TONE_CLASS } from "@/components/ui/status";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";
import { getClient } from "@/modules/clients";
import { listProjectDocuments } from "@/modules/documents";
import { listEmployees } from "@/modules/employees";
import { getProjectFinanceSummary, type ProjectFinanceSummary } from "@/modules/finance";
import {
  PROJECT_TRANSITIONS,
  getProject,
  listClientItems,
  listProjectComments,
  getProjectProgress,
  listMembers,
  listMilestones,
  listProjectTeams,
  type ProjectStatus,
} from "@/modules/projects";
import { listTasks, rowControls } from "@/modules/tasks";
import { listAssignableTeams } from "@/modules/teams";
import { loadLinkedFinance } from "../../_components/linked-data";
import { LinkedRecords } from "../../_components/linked-records";
import {
  addMemberAction,
  addMilestoneAction,
  addClientItemAction,
  deleteMilestoneAction,
  editMilestoneAction,
  setMemberRoleAction,
  addProjectTaskAction,
  assignProjectTeamAction,
  changeStatusAction,
  milestoneStatusAction,
  postProjectCommentAction,
  projectTaskAssigneeAction,
  projectTaskStatusAction,
  removeMemberAction,
  removeProjectDocumentAction,
  toggleClientItemAction,
  toggleTaskDoneAction,
  unassignProjectTeamAction,
} from "../actions";
import { DocUpload } from "./doc-upload";

export const metadata = { title: "Project" };

const TABS = ["tasks", "documents", "team", "milestones", "comments", "client", "finance"] as const;
type Tab = (typeof TABS)[number];
const TAB_META: Record<Tab, { label: string; icon: IconName; title: string; sub: string }> = {
  tasks: { label: "Tasks", icon: "tasks", title: "Project tasks", sub: "Assign, track and complete the work for this project." },
  documents: { label: "Documents", icon: "documents", title: "Project documents", sub: "Upload and manage files for this project." },
  team: { label: "Team", icon: "team", title: "Project team", sub: "People who can see and work on this project." },
  milestones: { label: "Milestones", icon: "reports", title: "Milestones", sub: "Key dates for this project." },
  comments: { label: "Comments", icon: "comment", title: "Comments", sub: "Notes and updates from the team." },
  client: { label: "Client input", icon: "mail", title: "Client input", sub: "What we are waiting for from the client." },
  finance: { label: "Finance", icon: "finance", title: "Finance", sub: "Confirmed cash movement, invoices, receipts and expenses." },
};

/** Moves that end or hide the project ask for confirmation first. */
const CONSEQUENCE: Partial<Record<string, string>> = {
  Cancelled: "The project is marked cancelled and its team can no longer treat it as active work.",
  Archived: "The project is hidden from the default project list. You can still find it again in the Archived filter.",
};

const TASK_STATUS_LABEL: Record<string, string> = { Pending: "Pending", "In Progress": "In progress", "In Review": "In review", Completed: "Completed" };

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className="inline-flex flex-none items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; tab?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let project;
  try {
    project = await getProject(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const canSeeFinance = can(actor, "finance.invoices.read") && can(actor, "finance.expenses.read");
  const tabs = TABS.filter((t) => (t !== "finance" || canSeeFinance) && (t !== "client" || project.type === "Client"));
  const tab: Tab = tabs.find((t) => t === sp.tab) ?? "tasks";

  const [progress, members, milestones, projectTasks, projectTeams, assignableTeams, docs, comments, clientItems] = await Promise.all([
    getProjectProgress(actor, id),
    listMembers(actor, id),
    listMilestones(actor, id),
    listTasks(actor, { view: "all", projectId: id, pageSize: 100 }),
    listProjectTeams(actor, id),
    listAssignableTeams(actor, "projects.members.manage"),
    listProjectDocuments(actor, id),
    listProjectComments(actor, id),
    listClientItems(actor, id),
  ]);
  const client = project.clientId && can(actor, "clients.read") ? await getClient(actor, project.clientId).catch(() => null) : null;

  const canAssign = can(actor, "tasks.assign") && can(actor, "tasks.create");
  // Employees on this project may add tasks too (to themselves or a teammate) when they hold tasks.create.in_project.
  const onThisProject = members.some((m) => m.employeeId === actor.employeeId && m.membershipRole !== "viewer");
  const canAddTask = canAssign || (can(actor, "tasks.create.in_project") && onThisProject);
  const canManageMembers = can(actor, "projects.members.manage");
  const canMilestones = can(actor, "projects.milestones.manage");
  const canDocs = can(actor, "projects.update");
  const canChangeStatus = can(actor, "projects.update") || can(actor, "projects.archive");
  const today = todayInTz(actor.timezone);
  const nextStatuses = (PROJECT_TRANSITIONS[project.status as ProjectStatus] ?? []) as readonly string[];
  const stage = statusView(project.archived ? "Archived" : project.status);
  const owner = members.find((m) => m.membershipRole === "owner");

  // People who cannot read every task see only their own tasks in the list; progress still counts the whole project.
  const taskRows = can(actor, "tasks.read.all")
    ? projectTasks.rows
    : projectTasks.rows.filter((t) => t.createdBy === actor.userId || t.assignees.some((a) => a.employeeId === actor.employeeId));
  const isOverdue = (t: (typeof taskRows)[number]) => t.status !== "Completed" && t.dueDate !== null && t.dueDate < today;
  const overdueCount = taskRows.filter(isOverdue).length;
  const openByPerson = new Map<string, number>();
  for (const t of taskRows) if (t.status !== "Completed") for (const a of t.assignees) openByPerson.set(a.employeeId, (openByPerson.get(a.employeeId) ?? 0) + 1);

  const candidates =
    canManageMembers && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !members.some((m) => m.employeeId === e.id))
      : [];

  let finance: ProjectFinanceSummary | null = null;
  let financeUnavailable = false;
  let linked: Awaited<ReturnType<typeof loadLinkedFinance>> | null = null;
  if (tab === "finance" && canSeeFinance) {
    try {
      finance = await getProjectFinanceSummary(actor, id);
    } catch {
      financeUnavailable = true; // never let a finance problem break the project page
    }
    linked = await loadLinkedFinance(actor, { projectId: id }, { expenses: true });
  }

  const counts: Record<Tab, number | null> = { tasks: taskRows.length, documents: docs.length, team: members.length, milestones: milestones.length, comments: comments.length, client: clientItems.length, finance: null };
  const sectionCount: Record<Tab, string> = {
    tasks: `${taskRows.length} tasks`,
    documents: `${docs.length} files`,
    team: `${members.length} members`,
    milestones: `${milestones.filter((m) => m.status === "Completed").length} of ${milestones.length} done`,
    comments: `${comments.length} comments`,
    client: `${clientItems.filter((c) => !c.received).length} waiting`,
    finance: "",
  };
  const meta = TAB_META[tab];
  const holdTarget = project.status === "Active" && nextStatuses.includes("On Hold") ? "On Hold" : project.status === "On Hold" && nextStatuses.includes("Active") ? "Active" : null;
  const menuStatuses = nextStatuses.filter((s) => !CONSEQUENCE[s]);
  const memberOptions = members.map((m) => ({ value: m.employeeId, label: m.fullName }));
  // Who a new task can be given to: admins pick anyone on the project; employees only owners and members (not viewers).
  const addTaskPeople = canAssign ? memberOptions : members.filter((m) => m.membershipRole !== "viewer").map((m) => ({ value: m.employeeId, label: m.fullName }));
  const tabHref = (t: Tab) => `/projects/${id}?tab=${t}`;

  // Odoo status bar: the usual path, plus the current stage when it is off that path (On Hold, Cancelled, Archived).
  const statusNow = project.archived ? "Archived" : project.status;
  const basePath = ["Planning", "Active", "Completed"];
  const stagePath = basePath.includes(statusNow) ? basePath : statusNow === "On Hold" ? ["Planning", "Active", "On Hold", "Completed"] : [...basePath, statusNow];
  const stageAt = stagePath.indexOf(statusNow);
  const projectStages: Stage[] = stagePath.map((s, i) => ({ key: s, label: statusView(s).label, state: i < stageAt ? "done" : i === stageAt ? "current" : "todo" }));
  const historyEntries = await auditChatterEntries(actor, "project", id);

  return (
    <FormView
      crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
      toolbar={
        canDocs && !project.archived ? (
          <Link href={`/projects/${id}/edit`} className={buttonClass("secondary", "min-h-9")}>
            Edit project
          </Link>
        ) : null
      }
      actions={
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Project actions">
        {canChangeStatus && menuStatuses.length > 0 ? (
          <details className="relative">
            <summary
              aria-label={`Project status ${stage.label}. Change status`}
              className={cn("inline-flex h-[38px] cursor-pointer list-none items-center gap-1.5 rounded-lg border border-transparent pl-3 pr-2.5 text-[13px] font-medium", TONE_CLASS[stage.tone])}
            >
              <Icon name={stage.icon} size={14} strokeWidth={2.2} />
              {stage.label}
              <Icon name="chevronDown" size={14} strokeWidth={2.2} />
            </summary>
            <ul role="menu" aria-label="Change project status" className="absolute left-0 top-11 z-20 m-0 min-w-[190px] list-none rounded-lg border border-border bg-surface p-1.5 shadow-lg">
              {menuStatuses.map((s) => (
                <li key={s} role="none">
                  <form action={changeStatusAction}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="to" value={s} />
                    <button type="submit" role="menuitem" className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-2.5 text-left text-[13px] font-medium text-foreground hover:bg-primary-soft">
                      {project.archived ? "Restore project" : project.status === "Completed" && s === "Active" ? "Reopen project" : statusView(s).label}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {canChangeStatus && holdTarget ? (
          <form action={changeStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value={holdTarget} />
            <button type="submit" className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-[13px] font-medium text-foreground hover:bg-primary-soft">
              <Icon name={holdTarget === "On Hold" ? "onHold" : "inProgress"} size={16} />
              {holdTarget === "On Hold" ? "Hold" : "Resume"}
            </button>
          </form>
        ) : null}

        {canChangeStatus && nextStatuses.includes("Cancelled") ? (
          <ConfirmForm
            action={changeStatusAction}
            label="Cancel project"
            triggerClassName="min-h-[38px]! px-3.5 text-[13px] text-danger"
            title="Move this project to Cancelled?"
            description={CONSEQUENCE.Cancelled!}
            confirmLabel="Cancel project"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="Cancelled" />
          </ConfirmForm>
        ) : null}
        {canChangeStatus && nextStatuses.includes("Archived") ? (
          <ConfirmForm
            action={changeStatusAction}
            label={
              <>
                <Icon name="archived" size={16} />
                Archive
              </>
            }
            triggerClassName="min-h-[38px]! gap-2 px-3.5 text-[13px] text-danger"
            title="Archive this project?"
            description={CONSEQUENCE.Archived!}
            confirmLabel="Archive project"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="Archived" />
          </ConfirmForm>
        ) : null}
        </div>
      }
      statusbar={<StatusBar label="Project stage" stages={projectStages} />}
      chatter={historyEntries ? <Chatter entries={historyEntries} timeZone={actor.timezone} title="History" empty="No changes recorded yet." /> : undefined}
    >
      {sp.error ? (
        <div className="mb-4">
          <Alert tone="error">{sp.error.slice(0, 300)}</Alert>
        </div>
      ) : null}
      <SheetTitle
        code={project.projectCode}
        title={project.name}
        badges={<span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted">{project.type === "Client" ? "Client project" : "Internal project"}</span>}
        smart={
          <SmartButtons
            items={[
              { icon: "tasks", value: `${progress.done} / ${progress.total}`, label: "Tasks done", href: tabHref("tasks") },
              { icon: "reports", value: `${progress.percent}%`, label: "Progress" },
              { icon: "overdue", value: overdueCount, label: "Overdue", tone: overdueCount > 0 ? "danger" : undefined, href: tabHref("tasks") },
              { icon: "documents", value: docs.length, label: "Documents", href: tabHref("documents") },
            ]}
          />
        }
      />
      {project.description ? <p className="mb-5 mt-0 max-w-3xl whitespace-pre-wrap text-body">{project.description}</p> : null}
      <FieldGrid
        items={[
          {
            label: "Client",
            value: client ? (
              <Link href={`/clients/${client.id}`} className={linkClass}>
                {client.name}
              </Link>
            ) : project.type === "Internal" ? (
              "Internal project"
            ) : null,
          },
          { label: "Owner", value: owner?.fullName ?? null },
          { label: "Start date", value: project.startDate },
          { label: "Due date", value: project.dueDate },
          { label: "Budget", value: project.budgetAmount ? `${project.currency} ${project.budgetAmount}` : null },
          { label: "Teams", value: projectTeams.length > 0 ? projectTeams.map((t) => t.teamName).join(", ") : null },
        ]}
      />
      <div role="group" aria-label="Project sections and actions">
        <NotebookTabs label="Project sections" tabs={tabs.map((t) => ({ key: t, label: TAB_META[t].label, href: tabHref(t), active: t === tab, count: counts[t] ?? undefined }))} />
      </div>

        <section aria-label={meta.title} className="-mx-4 min-w-0 sm:-mx-8">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-[18px]">
            <div>
              <h2 className="m-0 text-base font-semibold text-foreground">{meta.title}</h2>
              <p className="mb-0 mt-0.5 text-xs text-muted">{meta.sub}</p>
            </div>
            {sectionCount[tab] ? <span className="whitespace-nowrap rounded-full bg-[#ecefec] px-3 py-1 text-xs font-medium text-body">{sectionCount[tab]}</span> : null}
          </div>

          {tab === "tasks" ? (
            <>
              {canAddTask ? (
                <form action={addProjectTaskAction} className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-4">
                  <input type="hidden" name="projectId" value={id} />
                  <label htmlFor="nt-title" className="sr-only">New task title</label>
                  <input id="nt-title" name="title" placeholder="Add a task to this project" className="min-h-11 min-w-[220px] flex-1 rounded-lg border border-field bg-surface px-3 text-foreground placeholder:text-muted" maxLength={200} />
                  <label htmlFor="nt-who" className="sr-only">Assign new task to</label>
                  <select id="nt-who" name="assigneeId" defaultValue={canAssign ? "" : (actor.employeeId ?? "")} className="min-h-11 rounded-lg border border-field bg-surface px-2.5 text-foreground">
                    <option value="">Assign to</option>
                    {addTaskPeople.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button type="submit" className="min-h-11 rounded-lg border border-primary bg-surface px-[18px] font-semibold text-primary-ink hover:bg-primary-soft">
                    Add task
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2.5 border-b border-border bg-background px-5 py-3.5 text-body">
                  <Icon name="suspended" size={18} />
                  Only admins create and assign tasks. You can update the status of your own tasks.
                </div>
              )}
              {taskRows.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted">No tasks in this project yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th scope="col" className="w-11 py-2.5 pl-5 pr-2"><span className="sr-only">Done</span></th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Task</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Assigned to</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                        <th scope="col" className="py-2.5 pl-3 pr-5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskRows.map((t) => {
                        const done = t.status === "Completed";
                        const late = isOverdue(t);
                        const v = statusView(t.status, { overdue: late });
                        const ctl = rowControls(actor, t);
                        const statusOptions = ctl.statuses.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] ?? s }));
                        const assignee = t.assignees[0]?.employeeId ?? "";
                        return (
                          <tr key={t.id} className="border-t border-border">
                            <td className="py-1.5 pl-3.5 pr-2">
                              {ctl.canToggle ? (
                              <form action={toggleTaskDoneAction}>
                                <input type="hidden" name="projectId" value={id} />
                                <input type="hidden" name="taskId" value={t.id} />
                                <button
                                  type="submit"
                                  aria-pressed={done}
                                  aria-label={`${done ? "Reopen" : "Complete"} ${t.title}`}
                                  className="inline-flex size-11 items-center justify-center"
                                >
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
                            <td className="px-3 py-2.5">
                              {canAssign ? (
                                <AutoSubmitSelect
                                  action={projectTaskAssigneeAction}
                                  name="employeeId"
                                  value={assignee}
                                  label={`Assigned to for ${t.title}`}
                                  hidden={{ projectId: id, taskId: t.id }}
                                  options={[...(assignee ? [] : [{ value: "", label: "Unassigned" }]), ...memberOptions]}
                                  className="w-[140px] border-field bg-surface text-foreground"
                                />
                              ) : (
                                <span>{t.assignees.map((a) => a.fullName).join(", ") || "—"}</span>
                              )}
                            </td>
                            <td className={cn("px-3 py-2.5 tabular-nums", late ? "text-danger" : "text-body")}>{t.dueDate ?? "—"}</td>
                            <td className="py-2.5 pl-3 pr-5">
                              <div className="flex items-center gap-2">
                                {statusOptions.length > 1 ? (
                                <AutoSubmitSelect
                                  action={projectTaskStatusAction}
                                  name="status"
                                  value={t.status}
                                  label={`Status for ${t.title}`}
                                  hidden={{ projectId: id, taskId: t.id }}
                                  options={statusOptions}
                                  className={cn("h-[34px]! rounded-full border-transparent px-2 text-xs font-medium", TONE_CLASS[v.tone])}
                                />
                                ) : (
                                  <StatusBadge status={t.status} overdue={late} />
                                )}
                                {late && statusOptions.length > 1 ? <span className="text-xs font-semibold text-danger">Overdue</span> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {tab === "documents" ? (
            <>
              {canDocs ? (
                <DocUpload projectId={id} />
              ) : (
                <div className="flex items-center gap-2.5 border-b border-border bg-background px-5 py-3.5 text-body">
                  <Icon name="suspended" size={18} />
                  Only admins can upload or remove documents. You can download them.
                </div>
              )}
              {docs.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted">No documents yet.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 first:border-t-0">
                      <span className="inline-flex size-9 flex-none items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                        <Icon name="documents" size={18} />
                      </span>
                      <span className="min-w-0 flex-[1_1_200px]">
                        <span className="block truncate font-medium">{d.name}</span>
                        <span className="block text-xs text-muted">
                          {fmtSize(d.size)} · {d.uploadedByName ?? "Unknown"} · {d.createdAt.toISOString().slice(0, 10)}
                        </span>
                      </span>
                      <a
                        href={`/api/files/${d.fileId}`}
                        aria-label={`Download ${d.name}`}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-field bg-surface text-body hover:bg-primary-soft"
                      >
                        <Icon name="download" size={18} />
                      </a>
                      {canDocs ? (
                        <ConfirmForm
                          action={removeProjectDocumentAction}
                          label={
                            <>
                              Remove<span className="sr-only"> {d.name}</span>
                            </>
                          }
                          title={`Remove ${d.name}?`}
                          description="The file is deleted for everyone on the project. This cannot be undone."
                          confirmLabel="Remove document"
                        >
                          <input type="hidden" name="projectId" value={id} />
                          <input type="hidden" name="documentId" value={d.id} />
                        </ConfirmForm>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === "team" ? (
            <>
              {candidates.length > 0 ? (
                <form action={addMemberAction} className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-4">
                  <input type="hidden" name="id" value={id} />
                  <label htmlFor="add-member" className="font-medium">Add a member</label>
                  <select id="add-member" name="employeeId" defaultValue="" required className="min-h-11 min-w-[200px] rounded-lg border border-field bg-surface px-2.5 text-foreground">
                    <option value="" disabled>Choose a person</option>
                    {candidates.map((e) => (
                      <option key={e.id} value={e.id}>{e.fullName}</option>
                    ))}
                  </select>
                  <select name="role" aria-label="Role" defaultValue="member" className="min-h-11 rounded-lg border border-field bg-surface px-2.5 text-foreground">
                    <option value="member">Member</option>
                    <option value="viewer">Viewer (read only)</option>
                  </select>
                  <button type="submit" className={buttonClass("secondary")}>Add member</button>
                </form>
              ) : null}
              <ul className="m-0 list-none p-0">
                {members.map((m) => (
                  <li key={m.employeeId} className="flex items-center gap-3 border-t border-border px-5 py-3 first:border-t-0">
                    <Avatar name={m.fullName} />
                    <span className="min-w-0 flex-1">
                      <Link href={`/employees/${m.employeeId}`} className="block font-medium hover:text-primary-ink hover:underline">{m.fullName}</Link>
                      <span className="block text-xs text-muted">{m.membershipRole === "owner" ? "Project owner" : `${m.membershipRole === "viewer" ? "Viewer" : "Member"}${m.viaTeamId ? " · via team" : ""}`}</span>
                    </span>
                    <span className="tabular-nums text-body">{openByPerson.get(m.employeeId) ?? 0} open tasks</span>
                    {canManageMembers && m.membershipRole !== "owner" ? (
                      <AutoSubmitSelect
                        action={setMemberRoleAction}
                        name="role"
                        value={m.membershipRole === "viewer" ? "viewer" : "member"}
                        label={`Role for ${m.fullName}`}
                        hidden={{ id, employeeId: m.employeeId }}
                        options={[{ value: "member", label: "Member" }, { value: "viewer", label: "Viewer" }]}
                        className="w-[110px] border-field bg-surface text-foreground"
                      />
                    ) : null}
                    {canManageMembers && m.membershipRole !== "owner" && !m.viaTeamId ? (
                      <ConfirmForm
                        action={removeMemberAction}
                        label={
                          <>
                            Remove<span className="sr-only"> {m.fullName}</span>
                          </>
                        }
                        title={`Remove ${m.fullName} from the team?`}
                        description="They lose access to this project unless their role grants it another way. Tasks already assigned to them are not changed."
                        confirmLabel="Remove member"
                      >
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="employeeId" value={m.employeeId} />
                      </ConfirmForm>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border p-5">
                <TeamAssignSection
                  id={id}
                  noun="project"
                  teams={projectTeams}
                  options={assignableTeams}
                  canRemoveAny={canManageMembers}
                  assignAction={assignProjectTeamAction}
                  unassignAction={unassignProjectTeamAction}
                />
              </div>
            </>
          ) : null}

          {tab === "milestones" ? (
            <>
              {milestones.length === 0 ? <p className="px-5 py-8 text-sm text-muted">No milestones yet.</p> : null}
              <ul className="m-0 list-none p-0">
                {milestones.map((m) => {
                  const done = m.status === "Completed";
                  return (
                    <li key={m.id} className="flex items-center gap-2 border-t border-border py-1.5 pl-3.5 pr-5 first:border-t-0">
                      {canMilestones ? (
                        <form action={milestoneStatusAction}>
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <input type="hidden" name="status" value={done ? "Pending" : "Completed"} />
                          <button type="submit" aria-pressed={done} aria-label={`${done ? "Reopen" : "Complete"} ${m.name}`} className="inline-flex size-11 items-center justify-center">
                            <span className={cn("inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px]", done ? "border-primary bg-primary" : "border-[#8fa89a] bg-surface")}>
                              {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex size-11 items-center justify-center">
                          <span className={cn("inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px]", done ? "border-primary bg-primary" : "border-[#8fa89a] bg-surface")}>
                            {done ? <Icon name="check" size={14} strokeWidth={3.2} className="text-white" /> : null}
                          </span>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{m.name}</span>
                        <span className="block text-xs tabular-nums text-muted">Due {m.dueDate ?? "—"}</span>
                      </span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", done ? TONE_CLASS.success : m.status === "In Progress" ? TONE_CLASS.info : TONE_CLASS.warning)}>{done ? "Done" : m.status === "In Progress" ? "In progress" : "Upcoming"}</span>
                      {canMilestones ? (
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium text-primary-ink hover:bg-primary-soft">Edit</summary>
                          <div className="absolute right-0 top-8 z-20 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg">
                            <form action={editMilestoneAction} className="flex flex-col gap-2">
                              <input type="hidden" name="id" value={id} />
                              <input type="hidden" name="milestoneId" value={m.id} />
                              <label className="flex flex-col gap-1 text-xs text-muted">Name<input name="name" defaultValue={m.name} required className={inputClass} /></label>
                              <label className="flex flex-col gap-1 text-xs text-muted">Due date<input name="dueDate" type="date" defaultValue={m.dueDate ?? ""} className={inputClass} /></label>
                              <label className="flex flex-col gap-1 text-xs text-muted">Status
                                <select name="status" defaultValue={m.status} className={inputClass}>
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In progress</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </label>
                              <button type="submit" className={buttonClass("primary")}>Save milestone</button>
                            </form>
                            <form action={deleteMilestoneAction} className="mt-2 border-t border-border pt-2">
                              <input type="hidden" name="id" value={id} />
                              <input type="hidden" name="milestoneId" value={m.id} />
                              <button type="submit" className="min-h-9 text-xs font-medium text-danger hover:underline">Delete milestone</button>
                            </form>
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {canMilestones ? (
                <form action={addMilestoneAction} className="grid gap-3 border-t border-border p-5 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
                  <input type="hidden" name="id" value={id} />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="milestone-name" className="font-medium">Milestone name</label>
                    <input id="milestone-name" name="name" required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="milestone-due" className="font-medium">Due date</label>
                    <input id="milestone-due" name="dueDate" type="date" className={inputClass} />
                  </div>
                  <button type="submit" className={buttonClass("secondary")}>Add milestone</button>
                </form>
              ) : null}
            </>
          ) : null}

          {tab === "comments" ? (
            <>
              <form action={postProjectCommentAction} className="flex flex-col items-start gap-2.5 border-b border-border px-5 py-4">
                <input type="hidden" name="projectId" value={id} />
                <label htmlFor="cm-draft" className="sr-only">Add a comment</label>
                <textarea id="cm-draft" name="body" rows={3} required maxLength={2000} placeholder="Write an update for the team" className={cn(inputClass, "resize-y")} />
                <button type="submit" className="min-h-11 rounded-lg border border-primary bg-surface px-[18px] font-semibold text-primary-ink hover:bg-primary-soft">
                  Post comment
                </button>
              </form>
              {comments.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted">No comments yet. Be the first to post an update.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-3 border-t border-border px-5 py-3.5">
                      <Avatar name={c.authorName} size={32} />
                      <span className="min-w-0">
                        <span className="block">
                          <span className="font-semibold">{c.authorName}</span>{" "}
                          <time dateTime={c.createdAt.toISOString()} className="text-xs tabular-nums text-muted">
                            {c.createdAt.toISOString().slice(0, 10)}
                          </time>
                        </span>
                        <span className="mt-0.5 block whitespace-pre-wrap leading-normal text-body">{c.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === "client" ? (
            <>
              {canDocs ? (
                <form action={addClientItemAction} className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-4">
                  <input type="hidden" name="projectId" value={id} />
                  <label htmlFor="ci-title" className="sr-only">What are you waiting for</label>
                  <input id="ci-title" name="title" required maxLength={160} placeholder="What are we waiting for from the client?" className="min-h-11 min-w-[220px] flex-1 rounded-lg border border-field bg-surface px-3 text-foreground placeholder:text-muted" />
                  <label htmlFor="ci-detail" className="sr-only">Note (optional)</label>
                  <input id="ci-detail" name="detail" maxLength={500} placeholder="Note (optional)" className="min-h-11 min-w-[200px] flex-1 rounded-lg border border-field bg-surface px-3 text-foreground placeholder:text-muted" />
                  <button type="submit" className="min-h-11 rounded-lg border border-primary bg-surface px-[18px] font-semibold text-primary-ink hover:bg-primary-soft">
                    Add item
                  </button>
                </form>
              ) : null}
              {clientItems.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted">Nothing is being waited on.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {clientItems.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 first:border-t-0">
                      <span className="min-w-0 flex-[1_1_220px]">
                        <span className="block font-medium">{c.title}</span>
                        <span className="block text-xs text-muted">
                          {c.detail ?? ""}
                          {c.received && c.receivedAt ? `${c.detail ? " · " : ""}Received ${c.receivedAt.toISOString().slice(0, 10)}` : ""}
                        </span>
                      </span>
                      <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", c.received ? TONE_CLASS.success : TONE_CLASS.warning)}>
                        {c.received ? "Received" : "Waiting on client"}
                      </span>
                      {canDocs ? (
                        <form action={toggleClientItemAction}>
                          <input type="hidden" name="projectId" value={id} />
                          <input type="hidden" name="itemId" value={c.id} />
                          <input type="hidden" name="to" value={c.received ? "waiting" : "received"} />
                          <button type="submit" className="min-h-11 rounded-lg border border-field bg-surface px-3.5 font-medium text-foreground hover:bg-primary-soft">
                            {c.received ? "Reopen" : "Mark received"}
                            <span className="sr-only"> {c.title}</span>
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === "finance" ? (
            <div className="flex flex-col gap-4 p-5">
              {financeUnavailable ? (
                <p className="m-0 text-sm text-muted">Finance data is unavailable right now.</p>
              ) : finance && finance.currencies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] border-collapse text-sm">
                    <caption className="sr-only">Confirmed cash movement per currency</caption>
                    <thead>
                      <tr className="text-xs text-muted">
                        <th scope="col" className="px-3 py-2 text-left font-medium">Currency</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Received</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Paid out</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.currencies.map((c) => (
                        <tr key={c.currency} className="border-t border-border">
                          <th scope="row" className="px-3 py-2 text-left font-medium">{c.currency}</th>
                          <td className="px-3 py-2 text-right tabular-nums">{c.confirmedReceipts}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.confirmedExpensePayments}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{c.netCashMovement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="m-0 text-sm text-muted">No confirmed receipts or expense payments yet.</p>
              )}
              <p className="m-0 text-xs text-muted">Cash basis. Currencies are never added together.</p>
              {linked?.invoices ? <LinkedRecords title="Invoices" rows={linked.invoices.rows} total={linked.invoices.total} empty="No invoices for this project." /> : null}
              {linked?.receipts ? <LinkedRecords title="Receipts" rows={linked.receipts.rows} total={linked.receipts.total} empty="No receipts for this project." /> : null}
              {linked?.expenses ? <LinkedRecords title="Expenses" rows={linked.expenses.rows} total={linked.expenses.total} empty="No expenses for this project." /> : null}
            </div>
          ) : null}
        </section>

    </FormView>
  );
}
