import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DetailHeader } from "@/components/ui/detail-header";
import { DetailsList } from "@/components/ui/details-list";
import { Field } from "@/components/ui/field";
import { formatDateTime } from "@/components/ui/format";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { todayInTz } from "@/lib/dates";
import { listEmployees } from "@/modules/employees";
import { getProjectFinanceSummary, type ProjectFinanceSummary } from "@/modules/finance";
import {
  PROJECT_TRANSITIONS,
  getProject,
  getProjectProgress,
  listMembers,
  listMilestones,
  listProjectTeams,
  type ProjectStatus,
} from "@/modules/projects";
import { TeamAssignSection } from "@/components/teams/team-assign-section";
import { listAssignableTeams } from "@/modules/teams";
import {
  addMemberAction,
  assignProjectTeamAction,
  unassignProjectTeamAction,
  addMilestoneAction,
  changeStatusAction,
  milestoneStatusAction,
  removeMemberAction,
} from "../actions";
import { TaskTable } from "../../tasks/_components/task-table";
import { loadLinkedFinance } from "../../_components/linked-data";
import { LinkedRecords } from "../../_components/linked-records";
import { listTasks } from "@/modules/tasks";

const compact = "min-h-8 px-2.5 text-xs";
/** Moves that end or hide the project ask for confirmation first. */
const CONSEQUENCE: Partial<Record<string, string>> = {
  Cancelled: "The project is marked cancelled and its team can no longer treat it as active work.",
  Archived: "The project is hidden from the default project list. You can still find it by filtering on Archived.",
};

export const metadata = { title: "Project" };

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let project;
  try {
    project = await getProject(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [progress, members, milestones, projectTasks, projectTeams, assignableTeams] = await Promise.all([
    getProjectProgress(actor, id),
    listMembers(actor, id),
    listMilestones(actor, id),
    listTasks(actor, { view: "all", projectId: id, pageSize: 100 }),
    listProjectTeams(actor, id),
    listAssignableTeams(actor, "projects.members.manage"),
  ]);
  const canSeeFinance = can(actor, "finance.invoices.read") && can(actor, "finance.expenses.read");
  let finance: ProjectFinanceSummary | null = null;
  let financeUnavailable = false;
  if (canSeeFinance) {
    try {
      finance = await getProjectFinanceSummary(actor, id);
    } catch {
      financeUnavailable = true; // never let a finance problem break the project page
    }
  }
  const linked = await loadLinkedFinance(actor, { projectId: id }, { expenses: true });
  const canManageMembers = can(actor, "projects.members.manage");
  const canMilestones = can(actor, "projects.milestones.manage");
  const candidates =
    canManageMembers && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !members.some((m) => m.employeeId === e.id))
      : [];
  const nextStatuses = PROJECT_TRANSITIONS[project.status as ProjectStatus] ?? [];
  const canChangeStatus = can(actor, "projects.update") || can(actor, "projects.archive");
  const today = todayInTz(actor.timezone);
  const budget = project.budgetAmount ? `${project.currency} ${project.budgetAmount}` : null;
  const firstPlain = nextStatuses.find((s) => !CONSEQUENCE[s]);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/projects">Projects</BackLink>
      {error ? <Alert tone="error">{error.slice(0, 300)}</Alert> : null}
      <DetailHeader
        title={project.name}
        code={project.projectCode}
        badges={<StatusBadge status={project.archived ? "Archived" : project.status} />}
        facts={[
          project.type,
          <span key="d">Due {project.dueDate ?? "—"}</span>,
          <span key="p">
            Progress {progress.percent}% ({progress.done}/{progress.total} tasks)
          </span>,
          budget ? <span key="b">Budget {budget}</span> : "No budget set",
        ]}
      />

      {canChangeStatus && nextStatuses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Project status">
          {nextStatuses.map((s) =>
            CONSEQUENCE[s] ? (
              <ConfirmForm
                key={s}
                action={changeStatusAction}
                label={`Move to ${s}`}
                title={`Move this project to ${s}?`}
                description={CONSEQUENCE[s]!}
                confirmLabel={`Move to ${s}`}
              >
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="to" value={s} />
              </ConfirmForm>
            ) : (
              <form key={s} action={changeStatusAction}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="to" value={s} />
                <button type="submit" className={buttonClass(s === firstPlain ? "primary" : "secondary")}>
                  Move to {s}
                </button>
              </form>
            ),
          )}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {project.description ? (
            <SectionCard title="Description">
              <p className="whitespace-pre-wrap text-sm">{project.description}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Tasks" count={projectTasks.total}>
            <TaskTable rows={projectTasks.rows} today={today} emptyTitle="No tasks in this project yet" emptyDescription="Create a task and choose this project to see it here." />
          </SectionCard>

          <SectionCard title="Milestones" count={milestones.length}>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted">No milestones yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {milestones.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="font-medium">{m.name}</span>
                      <span className="block text-xs text-muted">Due {m.dueDate ?? "—"}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      {canMilestones && m.status !== "Completed" ? (
                        <form action={milestoneStatusAction}>
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <input type="hidden" name="status" value="Completed" />
                          <button type="submit" className={buttonClass("secondary", compact)}>
                            Mark completed<span className="sr-only"> {m.name}</span>
                          </button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canMilestones ? (
              <form action={addMilestoneAction} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
                <input type="hidden" name="id" value={id} />
                <Field id="milestone-name" label="Milestone name" required>
                  <input id="milestone-name" name="name" required className={inputClass} />
                </Field>
                <Field id="milestone-due" label="Due date">
                  <input id="milestone-due" name="dueDate" type="date" className={inputClass} />
                </Field>
                <button type="submit" className={buttonClass("secondary")}>
                  Add milestone
                </button>
              </form>
            ) : null}
          </SectionCard>

          <TeamAssignSection
            id={id}
            noun="project"
            teams={projectTeams}
            options={assignableTeams}
            canRemoveAny={canManageMembers}
            assignAction={assignProjectTeamAction}
            unassignAction={unassignProjectTeamAction}
          />

          <SectionCard title="Team" count={members.length}>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {members.map((m) => (
                <li key={m.employeeId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="font-medium">{m.fullName}</span>
                    <span className="text-muted">
                      {" "}
                      · {m.employeeCode} · {m.membershipRole}
                    </span>
                  </span>
                  {canManageMembers && m.membershipRole !== "owner" && !m.viaTeamId ? (
                    <ConfirmForm
                      action={removeMemberAction}
                      triggerClassName={compact}
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
            {candidates.length > 0 ? (
              <form action={addMemberAction} className="flex flex-wrap gap-2 border-t border-border pt-3">
                <input type="hidden" name="id" value={id} />
                <select name="employeeId" aria-label="Employee to add" required className={`${inputClass} sm:max-w-xs`}>
                  {candidates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeCode} {e.fullName}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonClass("secondary")}>
                  Add member
                </button>
              </form>
            ) : null}
          </SectionCard>

          {canSeeFinance ? (
            <section aria-label="Finance" className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
              <h2 className="m-0 text-base font-semibold">
                Finance <span className="font-normal text-muted">(cash basis)</span>
              </h2>
              {financeUnavailable ? (
                <p className="text-sm text-muted">Finance data is unavailable right now.</p>
              ) : finance && finance.currencies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] rounded-none border-0 text-sm">
                    <caption className="sr-only">Confirmed cash movement per currency</caption>
                    <thead className="bg-primary-soft">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Currency</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Received</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Paid out</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Net</th>
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
                <p className="text-sm text-muted">No confirmed receipts or expense payments yet.</p>
              )}
              <p className="text-xs text-muted">Currencies are never added together.</p>
            </section>
          ) : null}

          {linked.invoices ? (
            <LinkedRecords title="Invoices" rows={linked.invoices.rows} total={linked.invoices.total} empty="No invoices for this project." />
          ) : null}
          {linked.receipts ? (
            <LinkedRecords title="Receipts" rows={linked.receipts.rows} total={linked.receipts.total} empty="No receipts for this project." />
          ) : null}
          {linked.expenses ? (
            <LinkedRecords title="Expenses" rows={linked.expenses.rows} total={linked.expenses.total} empty="No expenses for this project." />
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <DetailsList
            items={[
              { label: "Status", value: <StatusBadge status={project.archived ? "Archived" : project.status} /> },
              { label: "Type", value: project.type },
              { label: "Start date", value: project.startDate },
              { label: "Due date", value: project.dueDate },
              { label: "Budget", value: budget },
              {
                label: "Progress",
                value: (
                  <span className="flex flex-col gap-1">
                    <span className="tabular-nums">
                      {progress.percent}% · {progress.done}/{progress.total} tasks
                    </span>
                    <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <span className="block h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }} />
                    </span>
                  </span>
                ),
              },
              { label: "Created", value: formatDateTime(project.createdAt, actor.timezone) },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
