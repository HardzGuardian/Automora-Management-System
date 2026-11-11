import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
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
  type ProjectStatus,
} from "@/modules/projects";
import {
  addMemberAction,
  addMilestoneAction,
  changeStatusAction,
  milestoneStatusAction,
  removeMemberAction,
} from "../actions";
import { TaskTable } from "../../tasks/_components/task-table";
import { listTasks } from "@/modules/tasks";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let project;
  try {
    project = await getProject(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [progress, members, milestones, projectTasks] = await Promise.all([
    getProjectProgress(actor, id),
    listMembers(actor, id),
    listMilestones(actor, id),
    listTasks(actor, { view: "all", projectId: id, pageSize: 100 }),
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
  const canManageMembers = can(actor, "projects.members.manage");
  const candidates =
    canManageMembers && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !members.some((m) => m.employeeId === e.id))
      : [];
  const nextStatuses = PROJECT_TRANSITIONS[project.status as ProjectStatus] ?? [];
  const btn = "rounded border border-gray-300 px-3 py-2";

  return (
    <main className="flex flex-col gap-6 p-8">
      <Link href="/projects" className="text-sm underline">
        ← Projects
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-600">
          {project.projectCode} · {project.type} · {project.status} · due {project.dueDate ?? "—"} · budget{" "}
          {project.budgetAmount ? `${project.budgetAmount} ${project.currency}` : "—"}
        </p>
        <p className="mt-2 text-sm">
          Progress: {progress.percent}% ({progress.done}/{progress.total} tasks)
        </p>
        {project.description ? <p className="mt-2 whitespace-pre-wrap text-sm">{project.description}</p> : null}
      </header>

      {can(actor, "projects.update") || can(actor, "projects.archive") ? (
        <section className="flex flex-wrap gap-2">
          {nextStatuses.map((s) => (
            <form key={s} action={changeStatusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="to" value={s} />
              <button type="submit" className={btn}>
                Move to {s}
              </button>
            </form>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Team ({members.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {members.map((m) => (
            <li key={m.employeeId} className="flex items-center gap-3">
              {m.employeeCode} {m.fullName} · {m.membershipRole}
              {canManageMembers && m.membershipRole !== "owner" ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="employeeId" value={m.employeeId} />
                  <button type="submit" className="underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {candidates.length > 0 ? (
          <form action={addMemberAction} className="flex gap-2">
            <input type="hidden" name="id" value={id} />
            <select name="employeeId" required className="rounded border border-gray-300 px-3 py-2">
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} {e.fullName}
                </option>
              ))}
            </select>
            <button type="submit" className={btn}>
              Add member
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Milestones ({milestones.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              {m.name} · due {m.dueDate ?? "—"} · {m.status}
              {can(actor, "projects.milestones.manage") && m.status !== "Completed" ? (
                <form action={milestoneStatusAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="milestoneId" value={m.id} />
                  <input type="hidden" name="status" value="Completed" />
                  <button type="submit" className="underline">
                    Mark completed
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {can(actor, "projects.milestones.manage") ? (
          <form action={addMilestoneAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={id} />
            <input name="name" required placeholder="Milestone name" className="rounded border border-gray-300 px-3 py-2" />
            <input name="dueDate" type="date" className="rounded border border-gray-300 px-3 py-2" />
            <button type="submit" className={btn}>
              Add milestone
            </button>
          </form>
        ) : null}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Tasks ({projectTasks.total})</h2>
        <TaskTable rows={projectTasks.rows} today={todayInTz(actor.timezone)} />
      </section>
      {canSeeFinance ? (
        <section className="flex flex-col gap-2" aria-label="Finance">
          <h2 className="text-lg font-medium">Finance (cash basis)</h2>
          {financeUnavailable ? (
            <p className="text-sm text-gray-600">Finance data is unavailable right now.</p>
          ) : finance && finance.currencies.length > 0 ? (
            <ul className="text-sm">
              {finance.currencies.map((c) => (
                <li key={c.currency}>
                  {c.currency}: received {c.confirmedReceipts} · paid out {c.confirmedExpensePayments} · net {c.netCashMovement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No confirmed receipts or expense payments yet.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
