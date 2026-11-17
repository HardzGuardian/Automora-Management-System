import "server-only";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { departments, employees, taskAssignees, taskTeams, tasks, teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { assertCanAssignToTeam } from "@/lib/team-access";
import { type AssignedInfo, notifyAssigned } from "./assignees";
import { loadTask, logTaskActivity } from "./core";

export type TaskTeamDTO = { teamId: string; teamName: string; departmentName: string; memberCount: number };
export type TeamSyncResult = { taskId: string; title: string; assigned: AssignedInfo[] };

/**
 * Makes task_assignees match the task's teams: every active member of an assigned team is an assignee
 * (marked via_team_id); people who are no longer in any assigned team lose only the team-sourced row.
 * Direct assignments (via_team_id null) are never touched. Returns the newly added people so the caller
 * can notify them after commit.
 */
export async function syncTaskTeams(tx: Tx, actor: Actor, taskId: string): Promise<AssignedInfo[]> {
  const assignedTeams = await tx
    .select({ teamId: taskTeams.teamId })
    .from(taskTeams)
    .innerJoin(teams, and(eq(teams.id, taskTeams.teamId), isNull(teams.archivedAt)))
    .where(and(eq(taskTeams.taskId, taskId), eq(taskTeams.companyId, actor.companyId)))
    .orderBy(asc(taskTeams.teamId));
  const teamIds = assignedTeams.map((t) => t.teamId);

  const desired = new Map<string, string>(); // employeeId -> team they came through
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
    .select({ employeeId: taskAssignees.employeeId, viaTeamId: taskAssignees.viaTeamId })
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.companyId, actor.companyId)));
  const have = new Map(existing.map((e) => [e.employeeId, e.viaTeamId]));

  for (const [employeeId, via] of have) {
    if (via === null) continue;
    const want = desired.get(employeeId);
    if (!want) {
      await tx.delete(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, employeeId)));
      await logTaskActivity(tx, actor, taskId, "unassigned", { employeeId, teamId: via }, undefined);
    } else if (want !== via) {
      await tx
        .update(taskAssignees)
        .set({ viaTeamId: want })
        .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, employeeId)));
    }
  }

  const added: AssignedInfo[] = [];
  for (const [employeeId, teamId] of desired) {
    if (have.has(employeeId)) continue;
    const [row] = await tx
      .insert(taskAssignees)
      .values({ taskId, companyId: actor.companyId, employeeId, assignedBy: actor.userId, viaTeamId: teamId })
      .onConflictDoNothing()
      .returning({ assignedAt: taskAssignees.assignedAt });
    if (!row) continue;
    const [emp] = await tx.select({ userId: employees.userId }).from(employees).where(eq(employees.id, employeeId));
    await logTaskActivity(tx, actor, taskId, "assigned", undefined, { employeeId, teamId });
    added.push({ employeeId, userId: emp?.userId ?? null, assignedAt: row.assignedAt });
  }
  return added;
}

/** Re-syncs every open task of a team (call after members join or leave). */
export async function syncTeamTasks(tx: Tx, actor: Actor, teamId: string): Promise<TeamSyncResult[]> {
  const open = await tx
    .select({ id: tasks.id, title: tasks.title })
    .from(taskTeams)
    .innerJoin(tasks, and(eq(tasks.id, taskTeams.taskId), eq(tasks.companyId, taskTeams.companyId)))
    .where(and(eq(taskTeams.teamId, teamId), eq(taskTeams.companyId, actor.companyId), isNull(tasks.archivedAt), ne(tasks.status, "Completed")));
  const results: TeamSyncResult[] = [];
  for (const t of open) results.push({ taskId: t.id, title: t.title, assigned: await syncTaskTeams(tx, actor, t.id) });
  return results;
}

export async function notifyTeamSync(results: TeamSyncResult[]): Promise<void> {
  for (const r of results) await notifyAssigned(r.taskId, r.title, r.assigned);
}

export async function assignTaskToTeam(actor: Actor, taskId: string, teamId: string): Promise<void> {
  const { assigned, title } = await withTransaction(async (tx) => {
    const task = await loadTask(tx, actor, taskId);
    if (task.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot be assigned");
    await assertCanAssignToTeam(tx, actor, teamId, "tasks.assign");
    const inserted = await tx
      .insert(taskTeams)
      .values({ taskId, teamId, companyId: actor.companyId, assignedBy: actor.userId })
      .onConflictDoNothing()
      .returning({ teamId: taskTeams.teamId });
    if (inserted.length === 0) throw new DomainError("CONFLICT", "This team already has the task");
    await logTaskActivity(tx, actor, taskId, "team_assigned", undefined, { teamId });
    return { assigned: await syncTaskTeams(tx, actor, taskId), title: task.title };
  });
  await notifyAssigned(taskId, title, assigned);
}

export async function unassignTaskFromTeam(actor: Actor, taskId: string, teamId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await loadTask(tx, actor, taskId);
    await assertCanAssignToTeam(tx, actor, teamId, "tasks.assign", { allowArchived: true });
    const removed = await tx
      .delete(taskTeams)
      .where(and(eq(taskTeams.taskId, taskId), eq(taskTeams.teamId, teamId), eq(taskTeams.companyId, actor.companyId)))
      .returning({ teamId: taskTeams.teamId });
    if (removed.length === 0) throw new DomainError("NOT_FOUND", "That team does not have this task");
    await logTaskActivity(tx, actor, taskId, "team_unassigned", { teamId }, undefined);
    await syncTaskTeams(tx, actor, taskId);
  });
}

export async function listTaskTeams(actor: Actor, taskId: string): Promise<TaskTeamDTO[]> {
  await loadTask(db, actor, taskId);
  const rows = await db
    .select({ teamId: teams.id, teamName: teams.name, departmentName: departments.name })
    .from(taskTeams)
    .innerJoin(teams, and(eq(teams.id, taskTeams.teamId), eq(teams.companyId, taskTeams.companyId)))
    .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
    .where(and(eq(taskTeams.taskId, taskId), eq(taskTeams.companyId, actor.companyId)))
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
