import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { TASK_PRIORITIES, TASK_STATUSES, employees, taskActivityLogs, taskAssignees, tasks, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { overdueCondition, todayInTz } from "@/lib/dates";
import { taskScope } from "@/lib/permissions";
import { loadTask } from "./core";
import { toTaskDTO, type TaskAssigneeDTO, type TaskDTO } from "./dto";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listTasksSchema = z.object({
  view: z.enum(["mine", "all"]).default("all"),
  status: z.array(z.enum(TASK_STATUSES)).optional(),
  priority: z.array(z.enum(TASK_PRIORITIES)).optional(),
  assigneeId: uuid.optional(),
  clientId: uuid.optional(),
  projectId: uuid.optional(),
  dueFrom: isoDate.optional(),
  dueTo: isoDate.optional(),
  overdue: z.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  includeArchived: z.boolean().default(false),
  sort: z.enum(["due", "priority", "title", "created", "status"]).default("due"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ListTasksInput = z.input<typeof listTasksSchema>;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const PRIORITY_RANK = sql`CASE ${tasks.priority} WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`;
const STATUS_RANK = sql`CASE ${tasks.status} WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 WHEN 'In Review' THEN 2 ELSE 3 END`;

function orderBy(sort: z.infer<typeof listTasksSchema>["sort"], dir: "asc" | "desc"): SQL[] {
  const d = dir === "asc" ? sql`ASC` : sql`DESC`;
  switch (sort) {
    case "priority":
      return [sql`${PRIORITY_RANK} ${d}`, sql`${tasks.dueDate} ASC NULLS LAST`, asc(tasks.id)];
    case "title":
      return [sql`${tasks.title} ${d}`, asc(tasks.id)];
    case "created":
      return [sql`${tasks.createdAt} ${d}`, asc(tasks.id)];
    case "status":
      return [sql`${STATUS_RANK} ${d}`, sql`${tasks.dueDate} ASC NULLS LAST`, asc(tasks.id)];
    default:
      return [sql`${tasks.dueDate} ${d} NULLS LAST`, sql`${PRIORITY_RANK} ASC`, asc(tasks.id)];
  }
}

export async function listTasks(actor: Actor, input: ListTasksInput): Promise<{ rows: TaskDTO[]; total: number }> {
  const f = listTasksSchema.parse(input);

  const conds: SQL[] = [];
  if (f.view === "mine") {
    if (!actor.employeeId) return { rows: [], total: 0 };
    conds.push(eq(tasks.companyId, actor.companyId));
    conds.push(
      sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasks.id} AND ta.employee_id = ${actor.employeeId})`,
    );
  } else {
    conds.push(taskScope(actor));
  }
  if (!f.includeArchived) conds.push(isNull(tasks.archivedAt));
  if (f.status?.length) conds.push(inArray(tasks.status, f.status));
  if (f.priority?.length) conds.push(inArray(tasks.priority, f.priority));
  if (f.projectId) conds.push(eq(tasks.projectId, f.projectId));
  if (f.clientId) conds.push(eq(tasks.clientId, f.clientId));
  if (f.assigneeId) {
    conds.push(sql`EXISTS (SELECT 1 FROM task_assignees ta2 WHERE ta2.task_id = ${tasks.id} AND ta2.employee_id = ${f.assigneeId})`);
  }
  if (f.dueFrom) conds.push(sql`${tasks.dueDate} >= ${f.dueFrom}::date`);
  if (f.dueTo) conds.push(sql`${tasks.dueDate} <= ${f.dueTo}::date`);
  if (f.overdue) conds.push(overdueCondition(todayInTz(actor.timezone)));
  if (f.search) {
    const p = `%${escapeLike(f.search)}%`;
    conds.push(or(ilike(tasks.title, p), ilike(tasks.taskCode, p))!);
  }
  const where = and(...conds);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(...orderBy(f.sort, f.dir))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(tasks).where(where),
  ]);

  const byTask = new Map<string, TaskAssigneeDTO[]>();
  if (rows.length > 0) {
    const assignees = await db
      .select({ taskId: taskAssignees.taskId, employeeId: employees.id, fullName: employees.fullName })
      .from(taskAssignees)
      .innerJoin(employees, and(eq(employees.id, taskAssignees.employeeId), eq(employees.companyId, taskAssignees.companyId)))
      .where(and(inArray(taskAssignees.taskId, rows.map((r) => r.id)), eq(taskAssignees.companyId, actor.companyId)))
      .orderBy(asc(employees.fullName), asc(employees.id));
    for (const a of assignees) {
      const list = byTask.get(a.taskId) ?? [];
      list.push({ employeeId: a.employeeId, fullName: a.fullName });
      byTask.set(a.taskId, list);
    }
  }
  return { rows: rows.map((r) => toTaskDTO(r, byTask.get(r.id) ?? [])), total };
}

export type TaskActivityDTO = {
  id: string;
  action: string;
  actorName: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
};

export async function listTaskActivity(actor: Actor, taskId: string): Promise<TaskActivityDTO[]> {
  await loadTask(db, actor, taskId);
  const rows = await db
    .select({
      id: taskActivityLogs.id,
      action: taskActivityLogs.action,
      actorName: user.name,
      oldValue: taskActivityLogs.oldValue,
      newValue: taskActivityLogs.newValue,
      createdAt: taskActivityLogs.createdAt,
    })
    .from(taskActivityLogs)
    .leftJoin(user, eq(user.id, taskActivityLogs.actorId))
    .where(and(eq(taskActivityLogs.taskId, taskId), eq(taskActivityLogs.companyId, actor.companyId)))
    .orderBy(desc(taskActivityLogs.createdAt), desc(taskActivityLogs.id));
  return rows;
}
