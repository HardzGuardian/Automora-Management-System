import "server-only";
import { and, asc, count, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { employees, projectMembers, projects, taskActivityLogs, taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { overdueCondition, todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { projectScope, requirePermission, taskScope } from "@/lib/permissions";

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

export type EmployeeProjectRow = {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  membershipRole: string;
  dueDate: string | null;
  archived: boolean;
};

export type EmployeeActivityRow = {
  id: string;
  action: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  createdAt: Date;
};

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

/**
 * Projects the employee is a member of, limited to the projects the viewer may see
 * (same rule as the project list). Same access as the workload tabs: own, or employees.workload.read.
 */
export async function getEmployeeProjects(actor: Actor, employeeId: string): Promise<EmployeeProjectRow[]> {
  const target = await resolveTarget(actor, employeeId);
  const rows = await db
    .select({
      id: projects.id,
      projectCode: projects.projectCode,
      name: projects.name,
      status: projects.status,
      membershipRole: projectMembers.membershipRole,
      dueDate: projects.dueDate,
      archivedAt: projects.archivedAt,
    })
    .from(projectMembers)
    .innerJoin(projects, and(eq(projects.id, projectMembers.projectId), eq(projects.companyId, projectMembers.companyId)))
    .where(and(eq(projectMembers.employeeId, target), eq(projectMembers.companyId, actor.companyId), projectScope(actor)))
    .orderBy(asc(projects.name), asc(projects.id));
  return rows.map(({ archivedAt, ...r }) => ({ ...r, archived: archivedAt !== null }));
}

/**
 * What the employee did recently on tasks the viewer may see (comments excluded, newest first).
 * Same access as the workload tabs: own, or employees.workload.read.
 */
export async function getEmployeeActivity(actor: Actor, employeeId: string, limit = 25): Promise<EmployeeActivityRow[]> {
  const target = await resolveTarget(actor, employeeId);
  const [emp] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(and(eq(employees.id, target), eq(employees.companyId, actor.companyId)));
  if (!emp?.userId) return []; // no account yet, so nothing they could have done
  return db
    .select({
      id: taskActivityLogs.id,
      action: taskActivityLogs.action,
      taskId: tasks.id,
      taskCode: tasks.taskCode,
      taskTitle: tasks.title,
      createdAt: taskActivityLogs.createdAt,
    })
    .from(taskActivityLogs)
    .innerJoin(tasks, and(eq(tasks.id, taskActivityLogs.taskId), eq(tasks.companyId, taskActivityLogs.companyId)))
    .where(and(taskScope(actor), eq(taskActivityLogs.actorId, emp.userId), sql`${taskActivityLogs.action} NOT LIKE 'comment_%'`))
    .orderBy(desc(taskActivityLogs.createdAt), desc(taskActivityLogs.id))
    .limit(limit);
}
