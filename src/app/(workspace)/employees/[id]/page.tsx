import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DetailHeader } from "@/components/ui/detail-header";
import { DetailsList } from "@/components/ui/details-list";
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
import { getEmployee, getEmployeeTasks, getWorkload, type TaskTab } from "@/modules/employees";
import { listRoles } from "@/modules/auth";
import { deactivateAction, reactivateAction, suspendAction } from "../actions";
import { InviteForm } from "./invite-form";

const TABS: { key: TaskTab; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
];

export const metadata = { title: "Employee" };

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { tab: rawTab } = await searchParams;
  const tab: TaskTab = TABS.some((t) => t.key === rawTab) ? (rawTab as TaskTab) : "assigned";

  let employee;
  try {
    employee = await getEmployee(actor, id);
  } catch (e) {
    if (e instanceof DomainError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }

  const canSeeWork = actor.employeeId === id || can(actor, "employees.workload.read");
  const [workload, tasks] = canSeeWork
    ? await Promise.all([getWorkload(actor, id), getEmployeeTasks(actor, id, tab)])
    : [null, []];

  const canInvite =
    !employee.hasAccount && employee.employmentStatus === "Active" && can(actor, "users.invite") && can(actor, "roles.read");
  const inviteRoles = canInvite ? (await listRoles(actor)).map((r) => ({ id: r.id, name: r.name })) : [];
  const today = todayInTz(actor.timezone);
  const active = employee.employmentStatus === "Active";
  const canDeactivate = can(actor, "employees.deactivate");
  const canSuspend = can(actor, "users.suspend");
  const showActions = active ? canDeactivate || canSuspend : canDeactivate;

  const stats = workload
    ? [
        { label: "Open", value: workload.open, danger: false },
        { label: "In progress", value: workload.inProgress, danger: false },
        { label: "Overdue", value: workload.overdue, danger: workload.overdue > 0 },
        { label: "Completed (30d)", value: workload.completedInPeriod, danger: false },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/employees">Employees</BackLink>
      <DetailHeader
        title={employee.fullName}
        code={employee.employeeCode}
        badges={<StatusBadge status={employee.employmentStatus} />}
        facts={[employee.designation ?? "No designation", employee.department ?? "No department", employee.workEmail]}
      />

      {showActions ? (
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
                >
                  <input type="hidden" name="id" value={id} />
                </ConfirmForm>
              ) : null}
              {canSuspend ? (
                <ConfirmForm
                  action={suspendAction}
                  label="Suspend"
                  title={`Suspend ${employee.fullName}?`}
                  description="Their account is blocked and all their sessions end immediately. Their history and assignments are kept. A user with the right permission can reactivate them."
                  confirmLabel="Suspend"
                >
                  <input type="hidden" name="id" value={id} />
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
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {workload ? (
            <section aria-label="Workload" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-md border border-border bg-surface p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.danger ? "text-danger" : ""}`}>{s.value}</p>
                </div>
              ))}
            </section>
          ) : null}

          {canInvite ? (
            <SectionCard title="Sign-in access">
              <p className="text-sm text-muted">This employee has no account yet. Invite them to create a password and sign in.</p>
              <InviteForm employeeId={id} email={employee.workEmail} roles={inviteRoles} />
            </SectionCard>
          ) : null}

          {canSeeWork ? (
            <SectionCard
              title="Tasks"
              action={<SegmentedNav label="Task filter" items={TABS.map((t) => ({ label: t.label, href: { query: { tab: t.key } }, active: t.key === tab }))} />}
            >
              {tasks.length === 0 ? (
                <EmptyState title="No tasks here" description="Nothing matches this tab." />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[34rem] rounded-none border-0 text-left text-sm">
                    <caption className="sr-only">{TABS.find((t) => t.key === tab)?.label} tasks</caption>
                    <thead className="bg-primary-soft">
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

        <aside className="flex min-w-0 flex-col gap-5">
          <DetailsList
            items={[
              { label: "Status", value: <StatusBadge status={employee.employmentStatus} /> },
              { label: "Work email", value: <a href={`mailto:${employee.workEmail}`} className={linkClass}>{employee.workEmail}</a> },
              { label: "Phone", value: employee.phone },
              { label: "Designation", value: employee.designation },
              { label: "Department", value: employee.department },
              { label: "Joined", value: employee.joiningDate },
              { label: "Sign-in", value: employee.hasAccount ? "Has an account" : "No account yet" },
              { label: "Added", value: formatDateTime(employee.createdAt, actor.timezone) },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
