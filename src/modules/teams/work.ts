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
  /** False for an ordinary member: they see who is on the team, but only their own tasks. */
  full: boolean;
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
  // With no team chosen, open the first team that has someone on it. An empty team first in the list
  // would otherwise make the screen look like it has no data.
  let selected = list.find((t) => t.id === teamId) ?? null;
  if (!selected && list.length > 0) {
    const staffed = await db
      .selectDistinct({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
      .where(and(inArray(teamMembers.teamId, list.map((t) => t.id)), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt)));
    const ids = new Set(staffed.map((s) => s.teamId));
    selected = list.find((t) => ids.has(t.id)) ?? list[0];
  }
  if (!selected) return { teams: list, selected: null, people: [], full: false };

  const members = await db
    .select({ employeeId: employees.id, name: employees.fullName, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
    .where(and(eq(teamMembers.teamId, selected.id), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt)))
    .orderBy(desc(sql`${teamMembers.role} = 'lead'`), asc(employees.fullName));
  if (members.length === 0) return { teams: list, selected, people: [], full: false };
  const isLead = members.some((m) => m.employeeId === actor.employeeId && m.role === "lead");
  const full = can(actor, "tasks.read.all") || isLead;
  const taskPeople = full ? members.map((m) => m.employeeId) : members.filter((m) => m.employeeId === actor.employeeId).map((m) => m.employeeId);

  const today = todayInTz(actor.timezone);
  const rows = taskPeople.length === 0 ? [] : await db
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
        inArray(taskAssignees.employeeId, taskPeople),
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
    full,
    people: members.map((m) => ({ employeeId: m.employeeId, name: m.name, role: m.role === "lead" ? "lead" : "member", tasks: byPerson.get(m.employeeId) ?? [] })),
  };
}
