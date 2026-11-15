import "server-only";
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, departments, projectTeams, projects, tasks, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { can, projectScope } from "@/lib/permissions";
import { getProgressForProjects } from "./progress";

export type ProjectOverviewRow = {
  id: string;
  name: string;
  clientId: string | null;
  /** Null when the viewer cannot read clients. */
  clientName: string | null;
  teamName: string | null;
  departmentName: string | null;
  percent: number;
  openTasks: number;
  dueDate: string | null;
  status: string;
};

const LIMIT = 200;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Everything the Projects screen shows in one query set: client, team, progress and open tasks. */
export async function projectsOverview(actor: Actor, input: { search?: string; archived?: boolean } = {}): Promise<ProjectOverviewRow[]> {
  const conds: SQL[] = [projectScope(actor), input.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)];
  if (input.search?.trim()) {
    const p = `%${escapeLike(input.search.trim())}%`;
    conds.push(or(ilike(projects.name, p), ilike(projects.projectCode, p))!);
  }
  const showClient = can(actor, "clients.read");
  const rows = await db
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId, dueDate: projects.dueDate, status: projects.status, clientName: clients.name })
    .from(projects)
    .leftJoin(clients, and(eq(clients.id, projects.clientId), eq(clients.companyId, projects.companyId)))
    .where(and(...conds))
    .orderBy(asc(projects.name), asc(projects.id))
    .limit(LIMIT);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [progress, teamRows, openRows] = await Promise.all([
    getProgressForProjects(actor, ids),
    db
      .select({ projectId: projectTeams.projectId, teamName: teams.name, departmentName: departments.name })
      .from(projectTeams)
      .innerJoin(teams, and(eq(teams.id, projectTeams.teamId), eq(teams.companyId, projectTeams.companyId)))
      .innerJoin(departments, and(eq(departments.id, teams.departmentId), eq(departments.companyId, teams.companyId)))
      .where(and(inArray(projectTeams.projectId, ids), eq(projectTeams.companyId, actor.companyId)))
      .orderBy(asc(departments.name), asc(teams.name)),
    db
      .select({ projectId: tasks.projectId, n: count() })
      .from(tasks)
      .where(and(inArray(tasks.projectId, ids), eq(tasks.companyId, actor.companyId), isNull(tasks.archivedAt), ne(tasks.status, "Completed")))
      .groupBy(tasks.projectId),
  ]);
  const firstTeam = new Map<string, { teamName: string; departmentName: string }>();
  for (const t of teamRows) if (!firstTeam.has(t.projectId)) firstTeam.set(t.projectId, t);
  const open = new Map(openRows.map((r) => [r.projectId, r.n]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    clientId: showClient ? r.clientId : null,
    clientName: showClient ? (r.clientName ?? "Internal") : null,
    teamName: firstTeam.get(r.id)?.teamName ?? null,
    departmentName: firstTeam.get(r.id)?.departmentName ?? null,
    percent: progress.get(r.id)?.percent ?? 0,
    openTasks: open.get(r.id) ?? 0,
    dueDate: r.dueDate,
    status: r.status,
  }));
}
