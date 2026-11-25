import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Chatter } from "@/components/ui/chatter";
import { FieldGrid, FormView, SheetTitle, SmartButtons, StatusBar } from "@/components/ui/odoo";
import { auditChatterEntries } from "../../_components/audit-chatter";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DueDate } from "@/components/ui/due-date";
import { formatDateTime } from "@/components/ui/format";
import { Priority } from "@/components/ui/priority";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import {
  getEmployee,
  getEmployeeActivity,
  getEmployeeProjects,
  getEmployeeTasks,
  getWorkload,
  type EmployeeActivityRow,
  type EmployeeProjectRow,
  type EmployeeTaskRow,
  type TaskTab,
} from "@/modules/employees";
import { listRoles } from "@/modules/auth";
import { departmentNamesForEmployees } from "@/modules/teams";
import { deactivateAction, reactivateAction, suspendAction } from "../actions";
import { ProfilePhotoCard } from "../_components/profile-photo-card";
import { ActivityPanel, ProjectsPanel } from "./_components/work-panels";
import { listPendingInvitations } from "@/modules/auth";
import { PendingInvitations } from "../../settings/users/pending-invitations";
import { InviteForm } from "./invite-form";

type Tab = TaskTab | "overview" | "projects" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "assigned", label: "Assigned" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
  { key: "projects", label: "Projects" },
  { key: "activity", label: "Activity" },
];

export const metadata = { title: "Employee" };

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { tab: rawTab, error: actionError } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "overview";

  let employee;
  try {
    employee = await getEmployee(actor, id);
  } catch (e) {
    if (e instanceof DomainError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }

  // Department comes from team membership; the legacy free-text value is only a fallback.
  const teamDepartments = can(actor, "employees.read") ? (await departmentNamesForEmployees(actor, [id])).get(id) : undefined;
  const department = teamDepartments?.join(", ") ?? employee.department;

  const canSeeWork = actor.employeeId === id || can(actor, "employees.workload.read");
  // Only the tab being shown is loaded.
  const isOverview = tab === "overview";
  const isTaskTab = tab !== "projects" && tab !== "activity" && !isOverview;
  const none = <T,>(): Promise<T[]> => Promise.resolve([]);
  const [workload, tasks, projectRows, activityRows]: [Awaited<ReturnType<typeof getWorkload>> | null, EmployeeTaskRow[], EmployeeProjectRow[], EmployeeActivityRow[]] = canSeeWork
    ? await Promise.all([
        getWorkload(actor, id),
        isTaskTab ? getEmployeeTasks(actor, id, tab) : isOverview ? getEmployeeTasks(actor, id, "assigned") : none<EmployeeTaskRow>(),
        tab === "projects" || isOverview ? getEmployeeProjects(actor, id) : none<EmployeeProjectRow>(),
        tab === "activity" || isOverview ? getEmployeeActivity(actor, id) : none<EmployeeActivityRow>(),
      ])
    : [null, [], [], []];

  const canInvite =
    !employee.hasAccount && employee.employmentStatus === "Active" && can(actor, "users.invite") && can(actor, "roles.read");
  const inviteRoles = canInvite ? (await listRoles(actor)).map((r) => ({ id: r.id, name: r.name })) : [];
  const pendingInvites = !employee.hasAccount && can(actor, "users.invite") ? await listPendingInvitations(actor, { employeeId: id }).catch(() => []) : [];
  const today = todayInTz(actor.timezone);
  const active = employee.employmentStatus === "Active";
  const canDeactivate = can(actor, "employees.deactivate");
  const canSuspend = can(actor, "users.suspend");
  const showActions = active ? canDeactivate || canSuspend : canDeactivate;

  const historyEntries = await auditChatterEntries(actor, "employee", id);
  const statusNow = employee.employmentStatus;

  return (
    <FormView
      crumbs={[{ label: "Employees", href: "/employees" }, { label: employee.fullName }]}
      toolbar={
        can(actor, "employees.update") ? (
          <Link href={`/employees/${id}/edit`} className={buttonClass("secondary", "min-h-9")}>
            Edit employee
          </Link>
        ) : null
      }
      actions={
        showActions ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Employee actions">
            {active ? (
              <>
                {canDeactivate ? (
                  <ConfirmForm
                    action={deactivateAction}
                    label="Deactivate"
                    title={`Deactivate ${employee.fullName}?`}
                    description="They are signed out, cannot sign in, and cannot be assigned new work. Their history and existing assignments are kept. You can reactivate them later."
                    confirmLabel="Deactivate"
                    formClassName="flex flex-col gap-2"
                  >
                    <input type="hidden" name="id" value={id} />
                    <label className="sr-only" htmlFor="deactivate-reason">Reason</label>
                    <input id="deactivate-reason" name="reason" maxLength={300} placeholder="Reason (optional)" className="min-h-10 rounded-md border border-field bg-surface px-3 text-sm" />
                  </ConfirmForm>
                ) : null}
                {canSuspend ? (
                  <ConfirmForm
                    action={suspendAction}
                    label="Suspend"
                    title={`Suspend ${employee.fullName}?`}
                    description="Their account is blocked and all their sessions end immediately. Their history and assignments are kept. A user with the right permission can reactivate them."
                    confirmLabel="Suspend"
                    formClassName="flex flex-col gap-2"
                  >
                    <input type="hidden" name="id" value={id} />
                    <label className="sr-only" htmlFor="suspend-reason">Reason</label>
                    <input id="suspend-reason" name="reason" maxLength={300} placeholder="Reason (optional)" className="min-h-10 rounded-md border border-field bg-surface px-3 text-sm" />
                  </ConfirmForm>
                ) : null}
              </>
            ) : (
              <form action={reactivateAction}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className={buttonClass("secondary")}>
                  Reactivate
                </button>
              </form>
            )}
          </div>
        ) : null
      }
      statusbar={
        <StatusBar
          label="Account status"
          stages={["Active", "Inactive", "Suspended"].map((s) => ({ key: s, label: s, state: statusNow === s ? "current" : "todo" }))}
        />
      }
      chatter={historyEntries ? <Chatter entries={historyEntries} timeZone={actor.timezone} title="History" empty="No changes recorded yet." /> : undefined}
    >
      {actionError ? (
        <div className="mb-4">
          <Alert tone="error">{actionError.slice(0, 300)}</Alert>
        </div>
      ) : null}
      <SheetTitle
        code={employee.employeeCode}
        title={employee.fullName}
        badges={employee.designation ? <span className="text-base text-muted">{employee.designation}</span> : null}
        smart={
          workload ? (
            <SmartButtons
              items={[
                { icon: "tasks", value: workload.open, label: "Open", href: `/employees/${id}?tab=assigned` },
                { icon: "inProgress", value: workload.inProgress, label: "In progress", href: `/employees/${id}?tab=assigned` },
                { icon: "overdue", value: workload.overdue, label: "Overdue", tone: workload.overdue > 0 ? "danger" : undefined, href: `/employees/${id}?tab=overdue` },
                { icon: "completed", value: workload.completedInPeriod, label: "Done (30d)", href: `/employees/${id}?tab=completed` },
              ]}
            />
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
        <FieldGrid
          items={[
            { label: "Work email", value: <a href={`mailto:${employee.workEmail}`} className={linkClass}>{employee.workEmail}</a> },
            { label: "Phone", value: employee.phone },
            { label: "Designation", value: employee.designation },
            { label: "Department", value: department },
            { label: "Joined", value: employee.joiningDate },
            { label: "Sign-in", value: employee.hasAccount ? "Has an account" : "No account yet" },
            { label: "Status", value: <StatusBadge status={employee.employmentStatus} /> },
            { label: "Added", value: formatDateTime(employee.createdAt, actor.timezone) },
          ]}
        />
        <ProfilePhotoCard
          employeeId={id}
          name={employee.fullName}
          fileId={employee.profileImageFileId}
          canChange={actor.employeeId === id || can(actor, "employees.update")}
        />
      </div>
      <div className="mt-2 flex flex-col gap-5">
          {!employee.hasAccount && can(actor, "users.invite") && pendingInvites.length > 0 ? (
            <SectionCard title="Pending invitation">
              <PendingInvitations rows={pendingInvites} returnTo={`/employees/${id}`} />
            </SectionCard>
          ) : null}

          {canInvite && pendingInvites.length === 0 ? (
            <SectionCard title="Sign-in access">
              <p className="text-sm text-muted">This employee has no account yet. Invite them to create a password and sign in.</p>
              <InviteForm employeeId={id} email={employee.workEmail} roles={inviteRoles} />
            </SectionCard>
          ) : null}

          {canSeeWork ? (
            <SectionCard
              id="work"
              title="Work"
              action={<SegmentedNav label="Work view" items={TABS.map((t) => ({ label: t.label, href: { query: { tab: t.key } }, active: t.key === tab }))} />}
            >
              {isOverview ? (
                <div className="flex flex-col gap-5">
                  <section aria-label="Next tasks">
                    <h3 className="mb-2 mt-0 text-sm font-semibold">Open tasks (next 5)</h3>
                    {tasks.length === 0 ? (
                      <p className="m-0 text-sm text-muted">No open tasks.</p>
                    ) : (
                      <ul className="m-0 flex list-none flex-col divide-y divide-border rounded-md border border-border p-0">
                        {tasks.slice(0, 5).map((t) => {
                          const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
                          return (
                            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                              <Link href={`/tasks/${t.id}`} className={linkClass}>{t.title}</Link>
                              <span className="flex items-center gap-2">
                                <StatusBadge status={t.status} overdue={overdue} />
                                <DueDate value={t.dueDate} overdue={overdue} />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="mb-0 mt-2 text-xs"><Link href={`/employees/${id}?tab=assigned`} className={linkClass}>All assigned tasks</Link></p>
                  </section>
                  <section aria-label="Projects">
                    <h3 className="mb-2 mt-0 text-sm font-semibold">Projects ({projectRows.length})</h3>
                    <ProjectsPanel rows={projectRows.slice(0, 5)} />
                  </section>
                  <section aria-label="Recent activity">
                    <h3 className="mb-2 mt-0 text-sm font-semibold">Recent activity</h3>
                    <ActivityPanel rows={activityRows.slice(0, 5)} timezone={actor.timezone} />
                  </section>
                </div>
              ) : tab === "projects" ? (
                <ProjectsPanel rows={projectRows} />
              ) : tab === "activity" ? (
                <ActivityPanel rows={activityRows} timezone={actor.timezone} />
              ) : tasks.length === 0 ? (
                <EmptyState title="No tasks here" description="Nothing matches this tab." />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[34rem] rounded-none border-0 text-left text-sm">
                    <caption className="sr-only">{TABS.find((t) => t.key === tab)?.label} tasks</caption>
                    <thead className="text-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Task</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Priority</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
                        return (
                          <tr key={t.id} className="border-t border-border">
                            <td className="px-3 py-2">
                              <Link href={`/tasks/${t.id}`} className={linkClass}>
                                {t.title}
                              </Link>
                              <span className="block text-xs text-muted">{t.taskCode}</span>
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={t.status} overdue={overdue} />
                            </td>
                            <td className="px-3 py-2">
                              <Priority value={t.priority} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <DueDate value={t.dueDate} overdue={overdue} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : null}
      </div>
    </FormView>
  );
}
