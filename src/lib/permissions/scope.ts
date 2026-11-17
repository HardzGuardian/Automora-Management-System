import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { clients, projects, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { can } from "./can";

// Record scope is applied INSIDE the SQL (never filter after fetching). Every condition
// is company-scoped; a record outside the actor's scope must be treated as NOT_FOUND.

const NONE = sql`false`;

export function taskScope(actor: Actor): SQL {
  const company = sql`${tasks.companyId} = ${actor.companyId}`;
  if (can(actor, "tasks.read.all")) return company;
  if (!actor.employeeId) return NONE;
  return sql`${company} AND (
    EXISTS (SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = ${tasks.id} AND ta.employee_id = ${actor.employeeId})
    OR EXISTS (SELECT 1 FROM project_members pm
            WHERE pm.project_id = ${tasks.projectId} AND pm.employee_id = ${actor.employeeId})
  )`;
}

export function projectScope(actor: Actor): SQL {
  const company = sql`${projects.companyId} = ${actor.companyId}`;
  if (can(actor, "projects.read.all")) return company;
  if (!actor.employeeId) return NONE;
  return sql`${company} AND EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = ${projects.id} AND pm.employee_id = ${actor.employeeId}
  )`;
}

export function clientScope(actor: Actor): SQL {
  if (can(actor, "clients.read")) return sql`${clients.companyId} = ${actor.companyId}`;
  return NONE;
}
