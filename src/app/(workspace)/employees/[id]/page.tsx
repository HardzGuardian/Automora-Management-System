import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
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

  return (
    <main className="flex flex-col gap-6">
      <Link href="/employees" className="text-sm underline">
        ← Employees
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
        <p className="text-sm text-muted">
          {employee.employeeCode} · {employee.designation ?? "No designation"} · {employee.department ?? "No department"} ·{" "}
          {employee.employmentStatus} · {employee.workEmail}
        </p>
      </header>

      {workload ? (
        <section className="grid max-w-xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded border p-3">Open: {workload.open}</div>
          <div className="rounded border p-3">In progress: {workload.inProgress}</div>
          <div className="rounded border p-3">Overdue: {workload.overdue}</div>
          <div className="rounded border p-3">Completed (30d): {workload.completedInPeriod}</div>
        </section>
      ) : null}

      <section className="flex flex-wrap gap-3">
        {employee.employmentStatus === "Active" ? (
          <>
            {can(actor, "employees.deactivate") ? (
              <form action={deactivateAction}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="rounded border border-border px-3 py-2">
                  Deactivate
                </button>
              </form>
            ) : null}
            {can(actor, "users.suspend") ? (
              <form action={suspendAction}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="rounded border border-border px-3 py-2">
                  Suspend
                </button>
              </form>
            ) : null}
          </>
        ) : can(actor, "employees.deactivate") ? (
          <form action={reactivateAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="rounded border border-border px-3 py-2">
              Reactivate
            </button>
          </form>
        ) : null}
      </section>

      {canInvite ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Sign-in access</h2>
          <InviteForm employeeId={id} email={employee.workEmail} roles={inviteRoles} />
        </section>
      ) : null}

      {canSeeWork ? (
        <section className="flex flex-col gap-3">
          <nav className="flex gap-4 text-sm">
            {TABS.map((t) => (
              <Link key={t.key} href={{ query: { tab: t.key } }} className={t.key === tab ? "font-semibold underline" : "underline"}>
                {t.label}
              </Link>
            ))}
          </nav>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">No tasks here.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {tasks.map((t) => (
                <li key={t.id}>
                  {t.taskCode} · {t.title} · {t.status} · {t.priority} · due {t.dueDate ?? "—"}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
