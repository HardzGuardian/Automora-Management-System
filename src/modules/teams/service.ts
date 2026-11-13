import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction, type Tx } from "@/db";
import { departments, employees, projectTeams, projects, taskTeams, tasks, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { assertAssignable } from "@/modules/employees";
import { syncTeamProjects } from "@/modules/projects";
import { notifyTeamSync, syncTeamTasks } from "@/modules/tasks";

const name = z.string().trim().min(1, "Enter a name").max(80);
const description = z.string().trim().max(500).nullable().optional();
const uuid = z.string().uuid();

export const departmentSchema = z.object({ name, description }).strict();
export const teamSchema = z.object({ departmentId: uuid, name, description }).strict();
export const teamUpdateSchema = z.object({ name, description }).strict();
export const memberRoleSchema = z.enum(["lead", "member"]);

export type TeamSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  leads: string[];
};
export type DepartmentNode = { id: string; name: string; description: string | null; teams: TeamSummary[] };
export type TeamMemberDTO = { employeeId: string; employeeCode: string; fullName: string; designation: string | null; role: string; active: boolean };
export type TeamDetail = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string;
  departmentName: string;
  archived: boolean;
  members: TeamMemberDTO[];
  tasks: { id: string; taskCode: string; title: string; status: string; dueDate: string | null }[];
  projects: { id: string; projectCode: string; name: string; status: string }[];
  /** Whether this viewer may add/remove members and edit the team. */
  canManage: boolean;
};

const isMember = (actor: Actor, teamAlias = teams.id) =>
  actor.employeeId
    ? sql`EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = ${teamAlias} AND tm.employee_id = ${actor.employeeId})`
    : sql`false`;

/** teams.read sees every team; everyone else sees only the teams they belong to. */
function teamVisible(actor: Actor) {
  return can(actor, "teams.read") ? sql`true` : isMember(actor);
}

async function loadTeam(tx: Pick<Tx, "select">, actor: Actor, id: string) {
  const [row] = await tx
    .select({ team: teams, departmentName: departments.name })
    .from(teams)
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
    .where(and(eq(teams.id, id), eq(teams.companyId, actor.companyId), teamVisible(actor)));
  if (!row) throw new DomainError("NOT_FOUND", "Team not found");
  return row;
}

// ---------- departments ----------

export async function createDepartment(actor: Actor, input: z.input<typeof departmentSchema>): Promise<{ id: string }> {
  requirePermission(actor, "teams.manage");
  const data = departmentSchema.parse(input);
  return withTransaction(async (tx) => {
    const [dup] = await tx.select({ id: departments.id }).from(departments).where(and(eq(departments.companyId, actor.companyId), sql`lower(${departments.name}) = lower(${data.name})`));
    if (dup) throw new DomainError("CONFLICT", "A department with this name already exists");
    const [row] = await tx
      .insert(departments)
      .values({ companyId: actor.companyId, name: data.name, description: data.description ?? null })
      .returning({ id: departments.id });
    await audit.record(tx, { actor, entity: "department", entityId: row.id, action: "department.created", after: data });
    return row;
  });
}

export async function updateDepartment(actor: Actor, id: string, input: z.input<typeof departmentSchema>): Promise<void> {
  requirePermission(actor, "teams.manage");
  const data = departmentSchema.parse(input);
  await withTransaction(async (tx) => {
    const [before] = await tx.select().from(departments).where(and(eq(departments.id, id), eq(departments.companyId, actor.companyId)));
    if (!before) throw new DomainError("NOT_FOUND", "Department not found");
    const [dup] = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.companyId, actor.companyId), sql`lower(${departments.name}) = lower(${data.name})`, ne(departments.id, id)));
    if (dup) throw new DomainError("CONFLICT", "A department with this name already exists");
    await tx.update(departments).set({ name: data.name, description: data.description ?? null }).where(eq(departments.id, id));
    await audit.record(tx, { actor, entity: "department", entityId: id, action: "department.updated", before: { name: before.name, description: before.description }, after: data });
  });
}

export async function archiveDepartment(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "teams.manage");
  await withTransaction(async (tx) => {
    const [dep] = await tx.select().from(departments).where(and(eq(departments.id, id), eq(departments.companyId, actor.companyId)));
    if (!dep) throw new DomainError("NOT_FOUND", "Department not found");
    const [{ live }] = await tx
      .select({ live: count() })
      .from(teams)
      .where(and(eq(teams.departmentId, id), isNull(teams.archivedAt)));
    if (live > 0) throw new DomainError("CONFLICT", "Archive or move this department's teams first");
    await tx.update(departments).set({ archivedAt: new Date() }).where(eq(departments.id, id));
    await audit.record(tx, { actor, entity: "department", entityId: id, action: "department.archived", before: { name: dep.name } });
  });
}

// ---------- teams ----------

export async function createTeam(actor: Actor, input: z.input<typeof teamSchema>): Promise<{ id: string }> {
  requirePermission(actor, "teams.manage");
  const data = teamSchema.parse(input);
  return withTransaction(async (tx) => {
    const [dep] = await tx
      .select({ archivedAt: departments.archivedAt })
      .from(departments)
      .where(and(eq(departments.id, data.departmentId), eq(departments.companyId, actor.companyId)));
    if (!dep) throw new DomainError("NOT_FOUND", "Department not found");
    if (dep.archivedAt) throw new DomainError("VALIDATION", "This department is archived");
    const [dup] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.departmentId, data.departmentId), sql`lower(${teams.name}) = lower(${data.name})`));
    if (dup) throw new DomainError("CONFLICT", "This department already has a team with that name");
    const [row] = await tx
      .insert(teams)
      .values({ companyId: actor.companyId, departmentId: data.departmentId, name: data.name, description: data.description ?? null })
      .returning({ id: teams.id });
    await audit.record(tx, { actor, entity: "team", entityId: row.id, action: "team.created", after: data });
    return row;
  });
}

export async function updateTeam(actor: Actor, id: string, input: z.input<typeof teamUpdateSchema>): Promise<void> {
  requirePermission(actor, "teams.manage");
  const data = teamUpdateSchema.parse(input);
  await withTransaction(async (tx) => {
    const { team } = await loadTeam(tx, actor, id);
    const [dup] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.departmentId, team.departmentId), sql`lower(${teams.name}) = lower(${data.name})`, ne(teams.id, id)));
    if (dup) throw new DomainError("CONFLICT", "This department already has a team with that name");
    await tx.update(teams).set({ name: data.name, description: data.description ?? null }).where(eq(teams.id, id));
    await audit.record(tx, { actor, entity: "team", entityId: id, action: "team.updated", before: { name: team.name, description: team.description }, after: data });
  });
}

export async function archiveTeam(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "teams.manage");
  const synced = await withTransaction(async (tx) => {
    const { team } = await loadTeam(tx, actor, id);
    if (team.archivedAt) throw new DomainError("CONFLICT", "Team is already archived");
    await tx.update(teams).set({ archivedAt: new Date() }).where(eq(teams.id, id));
    // The team no longer counts, so people who only had work through it lose that access.
    const results = await syncTeamTasks(tx, actor, id);
    await syncTeamProjects(tx, actor, id);
    await audit.record(tx, { actor, entity: "team", entityId: id, action: "team.archived", before: { name: team.name } });
    return results;
  });
  await notifyTeamSync(synced);
}

/** Departments with their active teams. People without teams.read see only their own teams. */
export async function getOrgChart(actor: Actor): Promise<DepartmentNode[]> {
  const deps = await db
    .select()
    .from(departments)
    .where(and(eq(departments.companyId, actor.companyId), isNull(departments.archivedAt)))
    .orderBy(asc(departments.name));
  const rows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.companyId, actor.companyId), isNull(teams.archivedAt), teamVisible(actor)))
    .orderBy(asc(teams.name));
  const ids = rows.map((t) => t.id);
  const members = ids.length
    ? await db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role, fullName: employees.fullName })
        .from(teamMembers)
        .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
        .where(inArray(teamMembers.teamId, ids))
        .orderBy(asc(employees.fullName))
    : [];
  const summary = new Map<string, TeamSummary>(
    rows.map((t) => [t.id, { id: t.id, name: t.name, description: t.description, memberCount: 0, leads: [] }]),
  );
  for (const m of members) {
    const s = summary.get(m.teamId)!;
    s.memberCount += 1;
    if (m.role === "lead") s.leads.push(m.fullName);
  }
  const all = can(actor, "teams.read");
  return deps
    .map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      teams: rows.filter((t) => t.departmentId === d.id).map((t) => summary.get(t.id)!),
    }))
    .filter((d) => all || d.teams.length > 0);
}

export async function getTeam(actor: Actor, id: string): Promise<TeamDetail> {
  const { team, departmentName } = await loadTeam(db, actor, id);
  const members = await db
    .select({
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      designation: employees.designation,
      role: teamMembers.role,
      status: employees.employmentStatus,
    })
    .from(teamMembers)
    .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.companyId, teamMembers.companyId)))
    .where(eq(teamMembers.teamId, id))
    .orderBy(desc(sql`${teamMembers.role} = 'lead'`), asc(employees.fullName));
  // Work the viewer is allowed to see (their own scope still applies to tasks and projects).
  const taskRows = await db
    .select({ id: tasks.id, taskCode: tasks.taskCode, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
    .from(taskTeams)
    .innerJoin(tasks, and(eq(tasks.id, taskTeams.taskId), eq(tasks.companyId, taskTeams.companyId)))
    .where(and(eq(taskTeams.teamId, id), eq(taskTeams.companyId, actor.companyId), isNull(tasks.archivedAt), taskVisible(actor)))
    .orderBy(asc(tasks.status), asc(tasks.dueDate))
    .limit(50);
  const projectRows = await db
    .select({ id: projects.id, projectCode: projects.projectCode, name: projects.name, status: projects.status })
    .from(projectTeams)
    .innerJoin(projects, and(eq(projects.id, projectTeams.projectId), eq(projects.companyId, projectTeams.companyId)))
    .where(and(eq(projectTeams.teamId, id), eq(projectTeams.companyId, actor.companyId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name))
    .limit(50);
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    departmentId: team.departmentId,
    departmentName,
    archived: team.archivedAt !== null,
    members: members.map((m) => ({ ...m, active: m.status === "Active" })),
    tasks: taskRows,
    projects: projectRows,
    canManage: can(actor, "teams.manage"),
  };
}

function taskVisible(actor: Actor) {
  if (can(actor, "tasks.read.all")) return sql`true`;
  if (!actor.employeeId) return sql`false`;
  return or(
    sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasks.id} AND ta.employee_id = ${actor.employeeId})`,
    sql`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = ${tasks.projectId} AND pm.employee_id = ${actor.employeeId})`,
  )!;
}

// ---------- members ----------

export async function addTeamMember(actor: Actor, teamId: string, employeeId: string, roleInput: "lead" | "member" = "member"): Promise<void> {
  requirePermission(actor, "teams.manage");
  const role = memberRoleSchema.parse(roleInput);
  const synced = await withTransaction(async (tx) => {
    const { team } = await loadTeam(tx, actor, teamId);
    if (team.archivedAt) throw new DomainError("VALIDATION", "This team is archived");
    await assertAssignable(tx, actor.companyId, employeeId);
    const inserted = await tx
      .insert(teamMembers)
      .values({ teamId, companyId: actor.companyId, employeeId, role })
      .onConflictDoNothing()
      .returning({ employeeId: teamMembers.employeeId });
    if (inserted.length === 0) throw new DomainError("CONFLICT", "This person is already on the team");
    const results = await syncTeamTasks(tx, actor, teamId);
    await syncTeamProjects(tx, actor, teamId);
    await audit.record(tx, { actor, entity: "team", entityId: teamId, action: "team.member_added", after: { employeeId, role } });
    return results;
  });
  await notifyTeamSync(synced);
}

export async function removeTeamMember(actor: Actor, teamId: string, employeeId: string): Promise<void> {
  requirePermission(actor, "teams.manage");
  await withTransaction(async (tx) => {
    await loadTeam(tx, actor, teamId);
    const removed = await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.employeeId, employeeId), eq(teamMembers.companyId, actor.companyId)))
      .returning({ role: teamMembers.role });
    if (removed.length === 0) throw new DomainError("NOT_FOUND", "That person is not on this team");
    await syncTeamTasks(tx, actor, teamId);
    await syncTeamProjects(tx, actor, teamId);
    await audit.record(tx, { actor, entity: "team", entityId: teamId, action: "team.member_removed", before: { employeeId, role: removed[0].role } });
  });
}

export async function setTeamMemberRole(actor: Actor, teamId: string, employeeId: string, roleInput: "lead" | "member"): Promise<void> {
  requirePermission(actor, "teams.manage");
  const role = memberRoleSchema.parse(roleInput);
  await withTransaction(async (tx) => {
    await loadTeam(tx, actor, teamId);
    const updated = await tx
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.employeeId, employeeId), eq(teamMembers.companyId, actor.companyId)))
      .returning({ employeeId: teamMembers.employeeId });
    if (updated.length === 0) throw new DomainError("NOT_FOUND", "That person is not on this team");
    await audit.record(tx, { actor, entity: "team", entityId: teamId, action: "team.member_role_changed", after: { employeeId, role } });
  });
}

/** Teams an employee belongs to (for profile pages and pickers). */
export async function listTeamsForEmployee(actor: Actor, employeeId: string): Promise<{ id: string; name: string; departmentName: string; role: string }[]> {
  if (!can(actor, "teams.read") && actor.employeeId !== employeeId) throw new DomainError("FORBIDDEN", "You do not have permission to do that");
  return db
    .select({ id: teams.id, name: teams.name, departmentName: departments.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, and(eq(teams.id, teamMembers.teamId), isNull(teams.archivedAt)))
    .innerJoin(departments, eq(departments.id, teams.departmentId))
    .where(and(eq(teamMembers.employeeId, employeeId), eq(teamMembers.companyId, actor.companyId)))
    .orderBy(asc(departments.name), asc(teams.name));
}

/** Teams the actor may hand work to: everything with the permission, otherwise just the teams they lead. */
export async function listAssignableTeams(actor: Actor, permission: "tasks.assign" | "projects.members.manage"): Promise<{ id: string; label: string }[]> {
  const base = and(eq(teams.companyId, actor.companyId), isNull(teams.archivedAt));
  const scope = can(actor, permission)
    ? base
    : actor.employeeId
      ? and(base, sql`EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = ${teams.id} AND tm.employee_id = ${actor.employeeId} AND tm.role = 'lead')`)
      : sql`false`;
  const rows = await db
    .select({ id: teams.id, team: teams.name, department: departments.name })
    .from(teams)
    .innerJoin(departments, eq(departments.id, teams.departmentId))
    .where(scope)
    .orderBy(asc(departments.name), asc(teams.name));
  return rows.map((r) => ({ id: r.id, label: `${r.department} · ${r.team}` }));
}
