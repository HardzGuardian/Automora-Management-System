import "server-only";
import { and, count, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { employees, taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { overdueCondition, todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export type Workload = {
  employeeId: string;
  open: number;
  inProgress: number;
  overdue: number;
  completedInPeriod: number;
};

export type EmployeeTaskRow = {
  id: string;
  taskCode: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: Date | null;
};

export type TaskTab = "assigned" | "completed" | "overdue";

/** Own workload is always allowed; anyone else's needs employees.workload.read. */
async function resolveTarget(actor: Actor, employeeId?: string): Promise<string> {
  const target = employeeId ?? actor.employeeId;
  if (!target) throw new DomainError("NOT_FOUND", "Employee not found");
  if (target !== actor.employeeId) requirePermission(actor, "employees.workload.read");
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, target), eq(employees.companyId, actor.companyId)));
  if (!emp) throw new DomainError("NOT_FOUND", "Employee not found");
  return target;
}

const assignedTo = (actor: Actor, employeeId: string): SQL =>
  sql`${tasks.companyId} = ${actor.companyId} AND ${tasks.archivedAt} IS NULL AND EXISTS (
    SELECT 1 FROM ${taskAssignees} ta WHERE ta.task_id = ${tasks.id} AND ta.employee_id = ${employeeId}
  )`;

export async function getWorkload(
  actor: Actor,
  employeeId?: string,
  opts: { periodDays?: number } = {},
): Promise<Workload> {
  const target = await resolveTarget(actor, employeeId);
  const today = todayInTz(actor.timezone);
  const periodDays = opts.periodDays ?? 30;
  const since = new Date(Date.now() - periodDays * 86_400_000);

  const [row] = await db
    .select({
      open: count(sql`CASE WHEN ${tasks.status} <> 'Completed' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${tasks.status} = 'In Progress' THEN 1 END`),
      overdue: count(sql`CASE WHEN ${overdueCondition(today)} THEN 1 END`),
      completedInPeriod: count(
        sql`CASE WHEN ${tasks.status} = 'Completed' AND ${tasks.completedAt} >= ${since} THEN 1 END`,
      ),
    })
    .from(tasks)
    .where(assignedTo(actor, target));
  return { employeeId: target, ...row };
}

export async function getEmployeeTasks(
  actor: Actor,
  employeeId: string,
  tab: TaskTab,
): Promise<EmployeeTaskRow[]> {
  const target = await resolveTarget(actor, employeeId);
  const today = todayInTz(actor.timezone);
  const tabCondition =
    tab === "completed"
      ? eq(tasks.status, "Completed")
      : tab === "overdue"
        ? overdueCondition(today)
        : ne(tasks.status, "Completed");
  return db
    .select({
      id: tasks.id,
      taskCode: tasks.taskCode,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(and(assignedTo(actor, target), tabCondition, isNull(tasks.archivedAt)))
    .orderBy(desc(tasks.dueDate), tasks.taskCode)
    .limit(200);
}
