import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, employees, projects, taskActivityLogs, taskAssignees, tasks, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { addDays, dueTodayCondition, overdueCondition, upcomingCondition } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { can, clientScope, projectScope, taskScope } from "@/lib/permissions";
import { getFinanceSnapshot, type FinanceSnapshot } from "@/modules/finance";
import { resolveRange, type RangePreset, type ResolvedRange } from "./range";

export type Audience = "company" | "operational" | "personal";
export const TASK_STATUS_ORDER = ["Pending", "In Progress", "In Review", "Completed"] as const;
export const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low"] as const;

export type DeadlineRow = { id: string; taskCode: string; title: string; status: string; priority: string; dueDate: string; href: string };
export type WorkloadRow = { employeeId: string; name: string; open: number; overdue: number };
export type ActivityRow = { id: string; action: string; actorName: string | null; taskId: string; taskCode: string; taskTitle: string; createdAt: Date; href: string };

export type Dashboard = {
  audience: Audience;
  range: ResolvedRange;
  counts: {
    activeEmployees: number | null;
    activeClients: number | null;
    activeProjects: number;
    /** Point in time. */
    openTasks: number;
    /** Period total: completed within the selected range. */
    completedTasks: number;
    /** Point in time. */
    overdueTasks: number;
    /** Point in time: due from today through today + 7 days. */
    dueNext7Days: number;
  };
  taskStatus: { status: string; count: number }[];
  taskPriority: { priority: string; count: number }[];
  upcoming: DeadlineRow[];
  overdue: DeadlineRow[];
  workload: WorkloadRow[] | null;
  activity: ActivityRow[];
  finance: FinanceSnapshot | null;
};

export type DashboardInput = { preset: RangePreset; from?: string; to?: string };

function audienceFor(actor: Actor): Audience {
  if (can(actor, "dashboard.company.read")) return "company";
  if (can(actor, "dashboard.operational.read")) return "operational";
  if (can(actor, "dashboard.personal.read")) return "personal";
  throw new DomainError("FORBIDDEN", "You do not have access to the dashboard");
}

/** Same scope rules as the task list: "mine" for the personal view, taskScope otherwise. */
function taskBase(actor: Actor, audience: Audience): SQL {
  if (audience === "personal") {
    if (!actor.employeeId) return sql`false`;
    return sql`${tasks.companyId} = ${actor.companyId} AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasks.id} AND ta.employee_id = ${actor.employeeId})`;
  }
  return taskScope(actor);
}

const toDeadline = (r: { id: string; taskCode: string; title: string; status: string; priority: string; dueDate: string | null }): DeadlineRow => ({
  id: r.id,
  taskCode: r.taskCode,
  title: r.title,
  status: r.status,
  priority: r.priority,
  dueDate: r.dueDate ?? "",
  href: `/tasks/${r.id}`,
});

export async function getDashboard(actor: Actor, input: DashboardInput): Promise<Dashboard> {
  const audience = audienceFor(actor);
  let range: ResolvedRange;
  try {
    range = resolveRange(input.preset, actor.timezone, new Date(), { from: input.from, to: input.to });
  } catch (e) {
    throw new DomainError("VALIDATION", e instanceof Error ? e.message : "Invalid range");
  }
  const base = and(taskBase(actor, audience), isNull(tasks.archivedAt))!;
  const open = sql`${tasks.status} <> 'Completed'`;
  const completedInRange = sql`(${tasks.status} = 'Completed' AND (${tasks.completedAt} AT TIME ZONE ${actor.timezone})::date BETWEEN ${range.from}::date AND ${range.to}::date)`;

  const [[c], statusRows, priorityRows, upcoming, overdue] = await Promise.all([
    db
      .select({
        open: count(sql`CASE WHEN ${open} THEN 1 END`),
        completed: count(sql`CASE WHEN ${completedInRange} THEN 1 END`),
        overdue: count(sql`CASE WHEN ${overdueCondition(range.today)} THEN 1 END`),
        next7: count(sql`CASE WHEN ${upcomingCondition(range.today, 7)} THEN 1 END`),
      })
      .from(tasks)
      .where(base),
    db.select({ status: tasks.status, n: count() }).from(tasks).where(base).groupBy(tasks.status),
    db.select({ priority: tasks.priority, n: count() }).from(tasks).where(and(base, open)).groupBy(tasks.priority),
    db
      .select({ id: tasks.id, taskCode: tasks.taskCode, title: tasks.title, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(base, upcomingCondition(range.today, 7)))
      .orderBy(asc(tasks.dueDate), asc(tasks.taskCode))
      .limit(10),
    db
      .select({ id: tasks.id, taskCode: tasks.taskCode, title: tasks.title, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(base, overdueCondition(range.today)))
      .orderBy(asc(tasks.dueDate), asc(tasks.taskCode))
      .limit(10),
  ]);

  const [activeProjects] = await db
    .select({ n: count() })
    .from(projects)
    .where(and(projectScope(actor), isNull(projects.archivedAt), eq(projects.status, "Active")));

  const showPeople = audience !== "personal";
  const activeEmployees = showPeople && can(actor, "employees.read")
    ? (await db.select({ n: count() }).from(employees).where(and(eq(employees.companyId, actor.companyId), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt))))[0].n
    : null;
  const activeClients = showPeople && can(actor, "clients.read")
    ? (await db.select({ n: count() }).from(clients).where(and(clientScope(actor), eq(clients.status, "Active"), isNull(clients.archivedAt))))[0].n
    : null;

  let workload: WorkloadRow[] | null = null;
  if (showPeople && (audience === "company" || can(actor, "employees.workload.read"))) {
    workload = await db
      .select({
        employeeId: employees.id,
        name: employees.fullName,
        open: count(sql`CASE WHEN ${open} THEN 1 END`),
        overdue: count(sql`CASE WHEN ${overdueCondition(range.today)} THEN 1 END`),
      })
      .from(taskAssignees)
      .innerJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId)))
      .innerJoin(employees, and(eq(employees.id, taskAssignees.employeeId), eq(employees.companyId, taskAssignees.companyId)))
      .where(and(base, eq(employees.employmentStatus, "Active")))
      .groupBy(employees.id, employees.fullName)
      .having(sql`count(CASE WHEN ${open} THEN 1 END) > 0`)
      .orderBy(desc(count(sql`CASE WHEN ${open} THEN 1 END`)), asc(employees.fullName))
      .limit(50);
  }

  const activity = await db
    .select({
      id: taskActivityLogs.id,
      action: taskActivityLogs.action,
      actorName: user.name,
      taskId: tasks.id,
      taskCode: tasks.taskCode,
      taskTitle: tasks.title,
      createdAt: taskActivityLogs.createdAt,
    })
    .from(taskActivityLogs)
    .innerJoin(tasks, and(eq(tasks.id, taskActivityLogs.taskId), eq(tasks.companyId, taskActivityLogs.companyId)))
    .leftJoin(user, eq(user.id, taskActivityLogs.actorId))
    .where(and(taskBase(actor, audience), sql`${taskActivityLogs.action} NOT LIKE 'comment_%'`))
    .orderBy(desc(taskActivityLogs.createdAt), desc(taskActivityLogs.id))
    .limit(10);

  let finance: FinanceSnapshot | null = null;
  if (audience === "company" && can(actor, "finance.reports.read")) {
    try {
      finance = await getFinanceSnapshot(actor, { fromDate: range.from, toDate: range.to });
    } catch {
      finance = null; // a finance problem must not take the dashboard down
    }
  }

  const statusCount = new Map(statusRows.map((r) => [r.status, r.n]));
  const priorityCount = new Map(priorityRows.map((r) => [r.priority, r.n]));
  void inArray;

  return {
    audience,
    range,
    counts: {
      activeEmployees,
      activeClients,
      activeProjects: activeProjects.n,
      openTasks: c.open,
      completedTasks: c.completed,
      overdueTasks: c.overdue,
      dueNext7Days: c.next7,
    },
    taskStatus: TASK_STATUS_ORDER.map((status) => ({ status, count: statusCount.get(status) ?? 0 })),
    taskPriority: PRIORITY_ORDER.map((priority) => ({ priority, count: priorityCount.get(priority) ?? 0 })),
    upcoming: upcoming.map(toDeadline),
    overdue: overdue.map(toDeadline),
    workload,
    activity: activity.map((a) => ({ ...a, href: `/tasks/${a.taskId}` })),
    finance,
  };
}

export { addDays, dueTodayCondition };
