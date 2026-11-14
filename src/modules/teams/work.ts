import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, employees, projects, taskAssignees, tasks, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { todayInTz } from "@/lib/dates";
import { can, taskScope } from "@/lib/permissions";

export type WorkTask = { id: string; title: string; projectName: string | null; dueDate: string | null; status: string; overdue: boolean };
export type WorkPerson = { employeeId: string; name: string; role: "lead" | "member"; tasks: WorkTask[] };
export type TeamWork = {
  teams: { id: string; label: string }[];
  selected: { id: string; label: string } | null;
  people: WorkPerson[];
};

/**
 * The Team screen: the teams the viewer can see (everyone with teams.read sees all, others see
 * their own), and for one chosen team each active member with the tasks assigned to them.
 * Task visibility still follows the viewer's normal task scope.
 */
export async function getTeamWork(actor: Actor, teamId?: string): Promise<TeamWork> {
  const base = and(eq(teams.companyId, actor.companyId), isNull(teams.archivedAt), isNull(departments.archivedAt));
  const scope = can(actor, "teams.read")
    ? base
    : actor.employeeId
      ? and(base, sql`EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = ${teams.id} AND tm.employee_id = ${actor.employeeId})`)
      : sql`false`;
  const visible = await db
    .select({ id: teams.id, team: teams.name, department: departments.name })
    .from(teams)
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
    .where(scope)
    .orderBy(asc(departments.name), asc(teams.name));
  const list = visible.map((t) => ({ id: t.id, label: `${t.department}, ${t.team}` }));
  const selected = list.find((t) => t.id === teamId) ?? list[0] ?? null;
  if (!selected) return { teams: list, selected: null, people: [] };

  const members = await db
    .select({ employeeId: employees.id, name: employees.fullName, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
    .where(and(eq(teamMembers.teamId, selected.id), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt)))
    .orderBy(desc(sql`${teamMembers.role} = 'lead'`), asc(employees.fullName));
  if (members.length === 0) return { teams: list, selected, people: [] };

  const today = todayInTz(actor.timezone);
  const rows = await db
    .select({
      employeeId: taskAssignees.employeeId,
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      projectName: projects.name,
    })
    .from(taskAssignees)
    .innerJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId)))
    .leftJoin(projects, and(eq(projects.id, tasks.projectId), eq(projects.companyId, tasks.companyId)))
    .where(
      and(
        inArray(
          taskAssignees.employeeId,
          members.map((m) => m.employeeId),
        ),
        eq(taskAssignees.companyId, actor.companyId),
        isNull(tasks.archivedAt),
        taskScope(actor),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.id));

  const byPerson = new Map<string, WorkTask[]>();
  for (const r of rows) {
    const t: WorkTask = {
      id: r.id,
      title: r.title,
      projectName: r.projectName,
      dueDate: r.dueDate,
      status: r.status,
      overdue: r.status !== "Completed" && r.dueDate !== null && r.dueDate < today,
    };
    byPerson.set(r.employeeId, [...(byPerson.get(r.employeeId) ?? []), t]);
  }
  return {
    teams: list,
    selected,
    people: members.map((m) => ({ employeeId: m.employeeId, name: m.name, role: m.role === "lead" ? "lead" : "member", tasks: byPerson.get(m.employeeId) ?? [] })),
  };
}
