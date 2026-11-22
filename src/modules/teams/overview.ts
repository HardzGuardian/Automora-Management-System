import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, employees, taskAssignees, tasks, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { can, requirePermission, taskScope } from "@/lib/permissions";

export type TeamOverviewMember = {
  employeeId: string;
  name: string;
  role: "lead" | "member";
  designation: string | null;
  /** Tasks assigned to this person; null when the viewer may not see another person's work. */
  tasks: number | null;
  open: number | null;
};
export type TeamOverview = { id: string; name: string; department: string; members: TeamOverviewMember[] };

export type EmployeeTeamsAndWork = {
  teams: { teamId: string; team: string; department: string; role: "lead" | "member" }[];
  openTasks: number;
  totalTasks: number;
};

/**
 * For the employee directory: each person's live teams (with their role) and how many tasks they hold.
 * Needs employees.read; task counts still follow the viewer's own task scope.
 */
export async function employeeTeamsAndWork(actor: Actor, employeeIds: string[]): Promise<Map<string, EmployeeTeamsAndWork>> {
  requirePermission(actor, "employees.read");
  const out = new Map<string, EmployeeTeamsAndWork>();
  if (employeeIds.length === 0) return out;
  for (const id of employeeIds) out.set(id, { teams: [], openTasks: 0, totalTasks: 0 });
  const memberships = await db
    .select({ employeeId: teamMembers.employeeId, teamId: teams.id, team: teams.name, department: departments.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, and(eq(teams.id, teamMembers.teamId), eq(teams.companyId, teamMembers.companyId), isNull(teams.archivedAt)))
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId), isNull(departments.archivedAt)))
    .where(and(eq(teamMembers.companyId, actor.companyId), inArray(teamMembers.employeeId, employeeIds)))
    .orderBy(asc(departments.name), asc(teams.name));
  for (const m of memberships) {
    out.get(m.employeeId)?.teams.push({ teamId: m.teamId, team: m.team, department: m.department, role: m.role === "lead" ? "lead" : "member" });
  }
  const counts = await db
    .select({
      employeeId: taskAssignees.employeeId,
      total: sql<number>`count(*)::int`,
      open: sql<number>`(count(*) FILTER (WHERE ${tasks.status} <> 'Completed'))::int`,
    })
    .from(taskAssignees)
    .innerJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId)))
    .where(and(inArray(taskAssignees.employeeId, employeeIds), eq(taskAssignees.companyId, actor.companyId), isNull(tasks.archivedAt), taskScope(actor)))
    .groupBy(taskAssignees.employeeId);
  for (const c of counts) {
    const e = out.get(c.employeeId);
    if (e) {
      e.openTasks = c.open;
      e.totalTasks = c.total;
    }
  }
  return out;
}

const escapeLike =(s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Every team the viewer can see (all of them with teams.read, otherwise their own), each with its
 * active members and how many tasks each member has. Optional search matches a team or department name.
 */
export async function listTeamOverview(actor: Actor, opts: { search?: string } = {}): Promise<TeamOverview[]> {
  const base = and(eq(teams.companyId, actor.companyId), isNull(teams.archivedAt), isNull(departments.archivedAt));
  const scope = can(actor, "teams.read")
    ? base
    : actor.employeeId
      ? and(base, sql`EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = ${teams.id} AND tm.employee_id = ${actor.employeeId})`)
      : sql`false`;
  const q = opts.search?.trim().slice(0, 100);
  const match = q ? or(ilike(teams.name, `%${escapeLike(q)}%`), ilike(departments.name, `%${escapeLike(q)}%`)) : undefined;
  const list = await db
    .select({ id: teams.id, name: teams.name, department: departments.name })
    .from(teams)
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
    .where(and(scope, match))
    .orderBy(asc(departments.name), asc(teams.name));
  if (list.length === 0) return [];

  const members = await db
    .select({
      teamId: teamMembers.teamId,
      employeeId: employees.id,
      name: employees.fullName,
      designation: employees.designation,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
    .where(and(inArray(teamMembers.teamId, list.map((t) => t.id)), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt)))
    .orderBy(desc(sql`${teamMembers.role} = 'lead'`), asc(employees.fullName));

  const counts = new Map<string, { total: number; open: number }>();
  const people = [...new Set(members.map((m) => m.employeeId))];
  if (people.length > 0) {
    const rows = await db
      .select({
        employeeId: taskAssignees.employeeId,
        total: sql<number>`count(*)::int`,
        open: sql<number>`(count(*) FILTER (WHERE ${tasks.status} <> 'Completed'))::int`,
      })
      .from(taskAssignees)
      .innerJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId)))
      .where(and(inArray(taskAssignees.employeeId, people), eq(taskAssignees.companyId, actor.companyId), isNull(tasks.archivedAt), taskScope(actor)))
      .groupBy(taskAssignees.employeeId);
    for (const r of rows) counts.set(r.employeeId, { total: r.total, open: r.open });
  }

  const seeAll = can(actor, "tasks.read.all");
  return list.map((t) => {
    const mine = members.filter((m) => m.teamId === t.id);
    const iLead = mine.some((m) => m.employeeId === actor.employeeId && m.role === "lead");
    return {
      id: t.id,
      name: t.name,
      department: t.department,
      members: mine.map((m) => {
        const visible = seeAll || iLead || m.employeeId === actor.employeeId;
        const c = counts.get(m.employeeId) ?? { total: 0, open: 0 };
        return {
          employeeId: m.employeeId,
          name: m.name,
          role: m.role === "lead" ? ("lead" as const) : ("member" as const),
          designation: m.designation,
          tasks: visible ? c.total : null,
          open: visible ? c.open : null,
        };
      }),
    };
  });
}
