import "server-only";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, projects, taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";

export type AssignablePerson = { id: string; name: string; designation: string | null; openTasks: number };
export type QuickTaskOptions = { projects: { id: string; name: string }[]; people: AssignablePerson[] };

/** What the quick "New task" panel offers: live projects, and active people with their open-task counts. */
export async function quickTaskOptions(actor: Actor): Promise<QuickTaskOptions> {
  requirePermission(actor, "tasks.create");
  requirePermission(actor, "tasks.assign");

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(
      and(
        eq(projects.companyId, actor.companyId),
        isNull(projects.archivedAt),
        sql`${projects.status} not in ('Completed', 'Cancelled', 'Archived')`,
      ),
    )
    .orderBy(asc(projects.name));

  const open = db
    .select({ employeeId: taskAssignees.employeeId, n: sql<number>`count(*)::int`.as("n") })
    .from(taskAssignees)
    .innerJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId)))
    .where(and(eq(taskAssignees.companyId, actor.companyId), isNull(tasks.archivedAt), ne(tasks.status, "Completed")))
    .groupBy(taskAssignees.employeeId)
    .as("open");

  const peopleRows = await db
    .select({
      id: employees.id,
      name: employees.fullName,
      designation: employees.designation,
      openTasks: sql<number>`coalesce(${open.n}, 0)::int`,
    })
    .from(employees)
    .leftJoin(open, eq(open.employeeId, employees.id))
    .where(and(eq(employees.companyId, actor.companyId), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt)))
    .orderBy(asc(employees.fullName));

  return { projects: projectRows, people: peopleRows };
}
