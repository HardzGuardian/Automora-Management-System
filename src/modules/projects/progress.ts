import "server-only";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { projectScope } from "@/lib/permissions";
import { loadProject } from "./service";

export type Progress = { done: number; total: number; percent: number };

/**
 * Completed ÷ eligible tasks (non-archived tasks of the project), 0% when there are none.
 * Floors so 100% is shown only when every eligible task is complete.
 */
export function calcProgress(done: number, total: number): number {
  if (done < 0 || total < 0 || done > total) throw new RangeError("Invalid progress inputs");
  return total === 0 ? 0 : Math.floor((done * 100) / total);
}

const toProgress = (done: number, total: number): Progress => ({ done, total, percent: calcProgress(done, total) });

export async function getProjectProgress(actor: Actor, projectId: string): Promise<Progress> {
  await loadProject(db, actor, projectId);
  const [row] = await db
    .select({
      total: count(),
      done: count(sql`CASE WHEN ${tasks.status} = 'Completed' THEN 1 END`),
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.companyId, actor.companyId), isNull(tasks.archivedAt)));
  return toProgress(row.done, row.total);
}

/** Bulk variant for lists/dashboards. Ids outside the actor's scope are omitted. */
export async function getProgressForProjects(actor: Actor, projectIds: string[]): Promise<Map<string, Progress>> {
  const result = new Map<string, Progress>();
  if (projectIds.length === 0) return result;
  const visible = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.id, projectIds), projectScope(actor)));
  const ids = visible.map((v) => v.id);
  for (const id of ids) result.set(id, toProgress(0, 0));
  if (ids.length === 0) return result;

  const rows = await db
    .select({
      projectId: tasks.projectId,
      total: count(),
      done: count(sql`CASE WHEN ${tasks.status} = 'Completed' THEN 1 END`),
    })
    .from(tasks)
    .where(and(inArray(tasks.projectId, ids), eq(tasks.companyId, actor.companyId), isNull(tasks.archivedAt)))
    .groupBy(tasks.projectId);
  for (const r of rows) if (r.projectId) result.set(r.projectId, toProgress(r.done, r.total));
  return result;
}
