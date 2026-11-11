import "server-only";
import type { Actor } from "@/lib/auth/actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { listTasks } from "@/modules/tasks";

export type SearchHit = {
  type: "employee" | "client" | "project" | "task";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResults = {
  query: string;
  employees: SearchHit[];
  clients: SearchHit[];
  projects: SearchHit[];
  tasks: SearchHit[];
  total: number;
};

const PER_TYPE = 5;
const MIN_LENGTH = 2;

/**
 * Global search over employees, clients, projects and tasks. It only composes the modules'
 * own scoped list functions, so a result can never include a record the actor could not
 * already open (capability checks and record scope are applied inside each of them).
 */
export async function globalSearch(actor: Actor, rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 100);
  const empty: SearchResults = { query, employees: [], clients: [], projects: [], tasks: [], total: 0 };
  if (query.length < MIN_LENGTH) return empty;

  const [employees, clients, projects, tasks] = await Promise.all([
    can(actor, "employees.read") ? listEmployees(actor, { search: query, pageSize: PER_TYPE }) : { rows: [] },
    can(actor, "clients.read") ? listClients(actor, { search: query, pageSize: PER_TYPE }) : { rows: [] },
    listProjects(actor, { search: query, pageSize: PER_TYPE }),
    listTasks(actor, { view: "all", search: query, pageSize: PER_TYPE, sort: "title" }),
  ]);

  const result: SearchResults = {
    query,
    employees: employees.rows.map((e) => ({
      type: "employee",
      id: e.id,
      title: e.fullName,
      subtitle: `${e.employeeCode} · ${e.designation ?? "Employee"}`,
      href: `/employees/${e.id}`,
    })),
    clients: clients.rows.map((c) => ({
      type: "client",
      id: c.id,
      title: c.name,
      subtitle: `${c.clientCode}${c.contactPerson ? ` · ${c.contactPerson}` : ""}`,
      href: `/clients/${c.id}`,
    })),
    projects: projects.rows.map((p) => ({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: `${p.projectCode} · ${p.status}`,
      href: `/projects/${p.id}`,
    })),
    tasks: tasks.rows.map((t) => ({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `${t.taskCode} · ${t.status}`,
      href: `/tasks/${t.id}`,
    })),
    total: 0,
  };
  result.total = result.employees.length + result.clients.length + result.projects.length + result.tasks.length;
  return result;
}
