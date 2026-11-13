import "server-only";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { departments, employees, projectMembers, projectTeams, projects, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { assertCanAssignToTeam } from "@/lib/team-access";
import { audit } from "@/modules/audit";
import { loadProject } from "./service";

export type ProjectTeamDTO = { teamId: string; teamName: string; departmentName: string; memberCount: number };

/**
 * Keeps project_members in step with the project's teams: every active member of an assigned team is a
 * project member (marked via_team_id). Only team-sourced rows are ever removed; owners and people added
 * by hand are never touched.
 */
export async function syncProjectTeams(tx: Tx, actor: Actor, projectId: string): Promise<void> {
  const assigned = await tx
    .select({ teamId: projectTeams.teamId })
    .from(projectTeams)
    .innerJoin(teams, and(eq(teams.id, projectTeams.teamId), isNull(teams.archivedAt)))
    .where(and(eq(projectTeams.projectId, projectId), eq(projectTeams.companyId, actor.companyId)))
    .orderBy(asc(projectTeams.teamId));
  const teamIds = assigned.map((t) => t.teamId);

  const desired = new Map<string, string>();
  if (teamIds.length > 0) {
    const members = await tx
      .select({ employeeId: teamMembers.employeeId, teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(employees, and(eq(employees.id, teamMembers.employeeId), eq(employees.employmentStatus, "Active")))
      .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.companyId, actor.companyId)))
      .orderBy(asc(teamMembers.teamId));
    for (const m of members) if (!desired.has(m.employeeId)) desired.set(m.employeeId, m.teamId);
  }

  const existing = await tx
    .select({ employeeId: projectMembers.employeeId, viaTeamId: projectMembers.viaTeamId, role: projectMembers.membershipRole })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.companyId, actor.companyId)));
  const have = new Map(existing.map((e) => [e.employeeId, e]));

  for (const e of existing) {
    if (e.viaTeamId === null || e.role === "owner") continue;
    const want = desired.get(e.employeeId);
    if (!want) {
      await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, e.employeeId)));
    } else if (want !== e.viaTeamId) {
      await tx.update(projectMembers).set({ viaTeamId: want }).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, e.employeeId)));
    }
  }
  for (const [employeeId, teamId] of desired) {
    if (have.has(employeeId)) continue;
    await tx
      .insert(projectMembers)
      .values({ projectId, companyId: actor.companyId, employeeId, membershipRole: "member", viaTeamId: teamId })
      .onConflictDoNothing();
  }
}

/** Re-syncs every live project of a team (call after members join or leave). */
export async function syncTeamProjects(tx: Tx, actor: Actor, teamId: string): Promise<void> {
  const live = await tx
    .select({ id: projects.id })
    .from(projectTeams)
    .innerJoin(projects, and(eq(projects.id, projectTeams.projectId), eq(projects.companyId, projectTeams.companyId)))
    .where(and(eq(projectTeams.teamId, teamId), eq(projectTeams.companyId, actor.companyId), isNull(projects.archivedAt), ne(projects.status, "Cancelled")));
  for (const p of live) await syncProjectTeams(tx, actor, p.id);
}

export async function assignProjectToTeam(actor: Actor, projectId: string, teamId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const project = await loadProject(tx, actor, projectId);
    if (project.archivedAt) throw new DomainError("VALIDATION", "Archived projects cannot be assigned");
    await assertCanAssignToTeam(tx, actor, teamId, "projects.members.manage");
    const inserted = await tx
      .insert(projectTeams)
      .values({ projectId, teamId, companyId: actor.companyId, assignedBy: actor.userId })
      .onConflictDoNothing()
      .returning({ teamId: projectTeams.teamId });
    if (inserted.length === 0) throw new DomainError("CONFLICT", "This team already has the project");
    await syncProjectTeams(tx, actor, projectId);
    await audit.record(tx, { actor, entity: "project", entityId: projectId, action: "project.team_assigned", after: { teamId } });
  });
}

export async function unassignProjectFromTeam(actor: Actor, projectId: string, teamId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    await assertCanAssignToTeam(tx, actor, teamId, "projects.members.manage", { allowArchived: true });
    const removed = await tx
      .delete(projectTeams)
      .where(and(eq(projectTeams.projectId, projectId), eq(projectTeams.teamId, teamId), eq(projectTeams.companyId, actor.companyId)))
      .returning({ teamId: projectTeams.teamId });
    if (removed.length === 0) throw new DomainError("NOT_FOUND", "That team does not have this project");
    await syncProjectTeams(tx, actor, projectId);
    await audit.record(tx, { actor, entity: "project", entityId: projectId, action: "project.team_unassigned", before: { teamId } });
  });
}

export async function listProjectTeams(actor: Actor, projectId: string): Promise<ProjectTeamDTO[]> {
  await loadProject(db, actor, projectId);
  const rows = await db
    .select({ teamId: teams.id, teamName: teams.name, departmentName: departments.name })
    .from(projectTeams)
    .innerJoin(teams, and(eq(teams.id, projectTeams.teamId), eq(teams.companyId, projectTeams.companyId)))
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
    .where(and(eq(projectTeams.projectId, projectId), eq(projectTeams.companyId, actor.companyId)))
    .orderBy(asc(departments.name), asc(teams.name));
  const counts = rows.length
    ? await db
        .select({ teamId: teamMembers.teamId, n: count() })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, rows.map((r) => r.teamId)))
        .groupBy(teamMembers.teamId)
    : [];
  const byTeam = new Map(counts.map((c) => [c.teamId, c.n]));
  return rows.map((r) => ({ ...r, memberCount: byTeam.get(r.teamId) ?? 0 }));
}
