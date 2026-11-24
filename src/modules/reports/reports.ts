import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { TASK_PRIORITIES, TASK_STATUSES, clients, employees, invoices, paymentAllocations, payments, projectMembers, projects, taskAssignees, tasks, teams, projectTeams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { overdueCondition } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import type { ExportColumn } from "@/lib/export";
import { can, taskScope } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { fromMinor, toMinor } from "@/lib/money";
import { getProjectFinanceSummary } from "@/modules/finance";
import { listProjects, getProgressForProjects } from "@/modules/projects";
import { listTasks } from "@/modules/tasks";
import { RANGE_PRESETS, resolveRange } from "./range";

export type ReportKey = "task-register" | "employee-workload" | "project-status" | "client-summary";
export type ReportRow = Record<string, string | number | null>;
export type ReportResult = {
  key: ReportKey;
  title: string;
  columns: ExportColumn[];
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  subtitle: string;
};

type Def = { key: ReportKey; title: string; description: string; columns: ExportColumn[]; allowed: (a: Actor) => boolean };

const wide = (a: Actor) => can(a, "reports.all.read");
const limited = (a: Actor) => can(a, "reports.limited.read");

// The column list of each report IS its export allowlist: exports can never include more.
const DEFS: Def[] = [
  {
    key: "task-register",
    title: "Task register",
    description: "Every task you can see, with status, priority, due date, assignees and an overdue flag.",
    columns: [
      { key: "taskCode", label: "Code" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "startDate", label: "Start date" },
      { key: "dueDate", label: "Due date" },
      { key: "overdue", label: "Overdue" },
      { key: "project", label: "Project" },
      { key: "client", label: "Client" },
      { key: "assignees", label: "Assignees" },
      { key: "completedAt", label: "Completed on" },
    ],
    allowed: (a) => wide(a) || limited(a) || can(a, "reports.personal.read"),
  },
  {
    key: "employee-workload",
    title: "Employee workload",
    description: "Open, in-progress and overdue tasks per active employee, and tasks completed in the period.",
    columns: [
      { key: "employeeCode", label: "Code" },
      { key: "employee", label: "Employee" },
      { key: "projects", label: "Projects" },
      { key: "open", label: "Open", type: "number" },
      { key: "inProgress", label: "In progress", type: "number" },
      { key: "overdue", label: "Overdue", type: "number" },
      { key: "completed", label: "Completed in period", type: "number" },
    ],
    allowed: (a) => wide(a) || (limited(a) && can(a, "employees.workload.read")),
  },
  {
    key: "project-status",
    title: "Project status",
    description: "Status, owner, dates, progress and open/overdue tasks for each project.",
    columns: [
      { key: "projectCode", label: "Code" },
      { key: "name", label: "Project" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "client", label: "Client" },
      { key: "owner", label: "Owner" },
      { key: "team", label: "Team" },
      { key: "budget", label: "Budget" },
      { key: "cash", label: "Cash (received less paid)" },
      { key: "startDate", label: "Start" },
      { key: "dueDate", label: "Due" },
      { key: "progress", label: "Progress" },
      { key: "openTasks", label: "Open tasks", type: "number" },
      { key: "overdueTasks", label: "Overdue tasks", type: "number" },
    ],
    allowed: (a) => wide(a) || limited(a),
  },
  {
    key: "client-summary",
    title: "Client summary",
    description: "Clients with their project count and open tasks.",
    columns: [
      { key: "clientCode", label: "Code" },
      { key: "name", label: "Client" },
      { key: "status", label: "Status" },
      { key: "contact", label: "Contact" },
      { key: "projects", label: "Projects", type: "number" },
      { key: "openTasks", label: "Open tasks", type: "number" },
      { key: "invoiced", label: "Invoiced" },
      { key: "received", label: "Received" },
      { key: "outstanding", label: "Outstanding" },
    ],
    allowed: (a) => (wide(a) || limited(a)) && can(a, "clients.read"),
  },
];

export const REPORT_KEYS = DEFS.map((d) => d.key);

export function availableReports(actor: Actor): { key: ReportKey; title: string; description: string; columns: ExportColumn[] }[] {
  return DEFS.filter((d) => d.allowed(actor)).map(({ key, title, description, columns }) => ({ key, title, description, columns }));
}

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const reportFiltersSchema = z.object({
  preset: z.enum(RANGE_PRESETS).optional(),
  from: iso.optional(),
  to: iso.optional(),
  status: z.array(z.enum(TASK_STATUSES)).optional(),
  priority: z.array(z.enum(TASK_PRIORITIES)).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ReportFilters = z.input<typeof reportFiltersSchema>;

const lookup = async <T extends { id: string }>(ids: string[], fetch: (ids: string[]) => Promise<(T & { label: string })[]>) =>
  new Map((ids.length ? await fetch([...new Set(ids)]) : []).map((r) => [r.id, r.label]));

async function taskRegister(actor: Actor, f: z.output<typeof reportFiltersSchema>): Promise<{ rows: ReportRow[]; total: number }> {
  const personalOnly = !wide(actor) && !limited(actor);
  const { rows, total } = await listTasks(actor, {
    view: personalOnly ? "mine" : "all",
    status: f.status,
    priority: f.priority,
    clientId: f.clientId,
    projectId: f.projectId,
    assigneeId: f.assigneeId,
    dueFrom: f.from,
    dueTo: f.to,
    sort: "due",
    page: f.page,
    pageSize: f.pageSize,
  });
  const projectNames = await lookup(rows.flatMap((r) => (r.projectId ? [r.projectId] : [])), async (ids) =>
    (await db.select({ id: projects.id, code: projects.projectCode, name: projects.name }).from(projects).where(and(inArray(projects.id, ids), eq(projects.companyId, actor.companyId)))).map((p) => ({ id: p.id, label: `${p.code} ${p.name}` })),
  );
  const clientNames = can(actor, "clients.read")
    ? await lookup(rows.flatMap((r) => (r.clientId ? [r.clientId] : [])), async (ids) =>
        (await db.select({ id: clients.id, name: clients.name }).from(clients).where(and(inArray(clients.id, ids), eq(clients.companyId, actor.companyId)))).map((c) => ({ id: c.id, label: c.name })),
      )
    : new Map<string, string>();
  const today = actor.timezone ? (await import("@/lib/dates")).todayInTz(actor.timezone) : "";
  const { isOverdue } = await import("@/lib/dates");
  return {
    total,
    rows: rows.map((t) => ({
      taskCode: t.taskCode,
      title: t.title,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      dueDate: t.dueDate,
      overdue: isOverdue({ dueDate: t.dueDate, status: t.status, archivedAt: t.archived ? new Date() : null }, today) ? "Yes" : "No",
      project: t.projectId ? (projectNames.get(t.projectId) ?? "") : "",
      client: t.clientId ? (clientNames.get(t.clientId) ?? "") : "",
      assignees: t.assignees.map((a) => a.fullName).join("; "),
      completedAt: t.completedAt ? t.completedAt.toISOString().slice(0, 10) : null,
    })),
  };
}

async function employeeWorkload(actor: Actor, f: z.output<typeof reportFiltersSchema>): Promise<{ rows: ReportRow[]; total: number }> {
  const range = resolveRange(f.preset ?? (f.from ? "custom" : "month"), actor.timezone, new Date(), { from: f.from, to: f.to });
  const open = sql`${tasks.id} IS NOT NULL AND ${tasks.status} <> 'Completed'`;
  const where = and(eq(employees.companyId, actor.companyId), eq(employees.employmentStatus, "Active"), isNull(employees.archivedAt));
  const [{ total }] = await db.select({ total: count() }).from(employees).where(where);
  const rows = await db
    .select({
      code: employees.employeeCode,
      name: employees.fullName,
      open: count(sql`CASE WHEN ${open} THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${tasks.status} = 'In Progress' THEN 1 END`),
      overdue: count(sql`CASE WHEN ${tasks.id} IS NOT NULL AND ${overdueCondition(range.today)} THEN 1 END`),
      completed: count(sql`CASE WHEN ${tasks.status} = 'Completed' AND (${tasks.completedAt} AT TIME ZONE ${actor.timezone})::date BETWEEN ${range.from}::date AND ${range.to}::date THEN 1 END`),
    })
    .from(employees)
    .leftJoin(taskAssignees, and(eq(taskAssignees.employeeId, employees.id), eq(taskAssignees.companyId, employees.companyId)))
    .leftJoin(tasks, and(eq(tasks.id, taskAssignees.taskId), eq(tasks.companyId, taskAssignees.companyId), isNull(tasks.archivedAt), taskScope(actor)))
    .where(where)
    .groupBy(employees.id, employees.employeeCode, employees.fullName)
    .orderBy(asc(employees.fullName), asc(employees.id))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const memberships = rows.length
    ? await db
        .select({ code: employees.employeeCode, project: projects.name })
        .from(projectMembers)
        .innerJoin(employees, and(eq(employees.id, projectMembers.employeeId), eq(employees.companyId, projectMembers.companyId)))
        .innerJoin(projects, and(eq(projects.id, projectMembers.projectId), eq(projects.companyId, projectMembers.companyId)))
        .where(and(eq(projectMembers.companyId, actor.companyId), inArray(employees.employeeCode, rows.map((r) => r.code)), isNull(projects.archivedAt)))
        .orderBy(asc(projects.name))
    : [];
  const byCode = new Map<string, string[]>();
  for (const m of memberships) byCode.set(m.code, [...(byCode.get(m.code) ?? []), m.project]);
  return {
    total,
    rows: rows.map((r) => ({ employeeCode: r.code, employee: r.name, projects: (byCode.get(r.code) ?? []).join("; "), open: r.open, inProgress: r.inProgress, overdue: r.overdue, completed: r.completed })),
  };
}

async function projectStatus(actor: Actor, f: z.output<typeof reportFiltersSchema>): Promise<{ rows: ReportRow[]; total: number }> {
  const { rows, total } = await listProjects(actor, { page: f.page, pageSize: f.pageSize, clientId: f.clientId });
  if (rows.length === 0) return { rows: [], total };
  const ids = rows.map((p) => p.id);
  const { todayInTz } = await import("@/lib/dates");
  const today = todayInTz(actor.timezone);
  const showMoney = can(actor, "finance.invoices.read") && can(actor, "finance.expenses.read");
  const [progress, taskCounts, owners, clientRows, teamRows, memberCounts, cashRows] = await Promise.all([
    getProgressForProjects(actor, ids),
    db
      .select({
        projectId: tasks.projectId,
        open: count(sql`CASE WHEN ${tasks.status} <> 'Completed' THEN 1 END`),
        overdue: count(sql`CASE WHEN ${overdueCondition(today)} THEN 1 END`),
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, ids), isNull(tasks.archivedAt), taskScope(actor)))
      .groupBy(tasks.projectId),
    db.select({ id: employees.id, name: employees.fullName }).from(employees).where(and(inArray(employees.id, rows.map((p) => p.ownerEmployeeId)), eq(employees.companyId, actor.companyId))),
    can(actor, "clients.read")
      ? db.select({ id: clients.id, name: clients.name }).from(clients).where(and(inArray(clients.id, rows.flatMap((p) => (p.clientId ? [p.clientId] : []))), eq(clients.companyId, actor.companyId)))
      : Promise.resolve([] as { id: string; name: string }[]),
    db
      .select({ projectId: projectTeams.projectId, team: teams.name })
      .from(projectTeams)
      .innerJoin(teams, and(eq(teams.id, projectTeams.teamId), eq(teams.companyId, projectTeams.companyId)))
      .where(and(inArray(projectTeams.projectId, ids), eq(projectTeams.companyId, actor.companyId)))
      .orderBy(asc(teams.name)),
    db
      .select({ projectId: projectMembers.projectId, n: count() })
      .from(projectMembers)
      .where(and(inArray(projectMembers.projectId, ids), eq(projectMembers.companyId, actor.companyId)))
      .groupBy(projectMembers.projectId),
    showMoney ? Promise.all(ids.map((id) => getProjectFinanceSummary(actor, id).catch(() => null))) : Promise.resolve([]),
  ]);
  const teamNames = new Map<string, string[]>();
  for (const t of teamRows) teamNames.set(t.projectId, [...(teamNames.get(t.projectId) ?? []), t.team]);
  const memberCount = new Map(memberCounts.map((m) => [m.projectId, m.n]));
  const cashText = new Map<string, string>();
  for (const c of cashRows) {
    if (c) cashText.set(c.projectId, c.currencies.map((x) => `${x.currency} ${x.netCashMovement}`).join("; "));
  }
  const counts = new Map(taskCounts.map((c) => [c.projectId, c]));
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  return {
    total,
    rows: rows.map((p) => ({
      projectCode: p.projectCode,
      name: p.name,
      type: p.type,
      status: p.status,
      client: p.clientId ? (clientName.get(p.clientId) ?? "") : "",
      owner: ownerName.get(p.ownerEmployeeId) ?? "",
      team: `${(teamNames.get(p.id) ?? []).join(", ") || "No team"} (${memberCount.get(p.id) ?? 0} people)`,
      budget: p.budgetAmount ? `${p.currency} ${p.budgetAmount}` : null,
      cash: showMoney ? (cashText.get(p.id) ?? "—") : null,
      startDate: p.startDate,
      dueDate: p.dueDate,
      progress: `${progress.get(p.id)?.percent ?? 0}%`,
      openTasks: counts.get(p.id)?.open ?? 0,
      overdueTasks: counts.get(p.id)?.overdue ?? 0,
    })),
  };
}

async function clientSummary(actor: Actor, f: z.output<typeof reportFiltersSchema>): Promise<{ rows: ReportRow[]; total: number }> {
  const { rows, total } = await listClients(actor, { page: f.page, pageSize: f.pageSize });
  if (rows.length === 0) return { rows: [], total };
  const ids = rows.map((c) => c.id);
  const showMoney = can(actor, "finance.invoices.read");
  const [projectCounts, taskCounts, invoicedRows, receivedRows] = await Promise.all([
    db.select({ clientId: projects.clientId, n: count() }).from(projects).where(and(inArray(projects.clientId, ids), isNull(projects.archivedAt), eq(projects.companyId, actor.companyId))).groupBy(projects.clientId),
    db
      .select({ clientId: tasks.clientId, n: count() })
      .from(tasks)
      .where(and(inArray(tasks.clientId, ids), isNull(tasks.archivedAt), sql`${tasks.status} <> 'Completed'`, taskScope(actor)))
      .groupBy(tasks.clientId),
    showMoney
      ? db
          .select({ clientId: invoices.clientId, currency: invoices.currency, amount: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)::numeric` })
          .from(invoices)
          .where(and(inArray(invoices.clientId, ids), eq(invoices.companyId, actor.companyId), eq(invoices.status, "issued")))
          .groupBy(invoices.clientId, invoices.currency)
      : Promise.resolve([] as { clientId: string; currency: string; amount: string }[]),
    showMoney
      ? db
          .select({ clientId: invoices.clientId, currency: invoices.currency, amount: sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric` })
          .from(paymentAllocations)
          .innerJoin(payments, and(eq(payments.id, paymentAllocations.paymentId), eq(payments.companyId, paymentAllocations.companyId), eq(payments.status, "confirmed"), isNull(payments.reversedAt)))
          .innerJoin(invoices, and(eq(invoices.id, paymentAllocations.invoiceId), eq(invoices.companyId, paymentAllocations.companyId)))
          .where(and(inArray(invoices.clientId, ids), eq(paymentAllocations.companyId, actor.companyId)))
          .groupBy(invoices.clientId, invoices.currency)
      : Promise.resolve([] as { clientId: string; currency: string; amount: string }[]),
  ]);
  const money = (rows: { clientId: string; currency: string; amount: string }[], clientId: string) =>
    rows.filter((r) => r.clientId === clientId).map((r) => `${r.currency} ${fromMinor(toMinor(r.amount))}`).join("; ") || "—";
  const outstandingText = (clientId: string) => {
    const cur = new Set([...invoicedRows, ...receivedRows].filter((r) => r.clientId === clientId).map((r) => r.currency));
    const parts = [...cur].sort().map((c) => {
      const inv = toMinor(invoicedRows.find((r) => r.clientId === clientId && r.currency === c)?.amount ?? "0");
      const rec = toMinor(receivedRows.find((r) => r.clientId === clientId && r.currency === c)?.amount ?? "0");
      return `${c} ${fromMinor(Math.max(inv - rec, 0))}`;
    });
    return parts.join("; ") || "—";
  };
  const pc = new Map(projectCounts.map((r) => [r.clientId, r.n]));
  const tc = new Map(taskCounts.map((r) => [r.clientId, r.n]));
  return {
    total,
    rows: rows.map((c) => ({
      clientCode: c.clientCode,
      name: c.name,
      status: c.status,
      contact: c.contactPerson,
      projects: pc.get(c.id) ?? 0,
      openTasks: tc.get(c.id) ?? 0,
      invoiced: showMoney ? money(invoicedRows, c.id) : null,
      received: showMoney ? money(receivedRows, c.id) : null,
      outstanding: showMoney ? outstandingText(c.id) : null,
    })),
  };
}

const RUNNERS: Record<ReportKey, (a: Actor, f: z.output<typeof reportFiltersSchema>) => Promise<{ rows: ReportRow[]; total: number }>> = {
  "task-register": taskRegister,
  "employee-workload": employeeWorkload,
  "project-status": projectStatus,
  "client-summary": clientSummary,
};

export async function runReport(actor: Actor, key: ReportKey, input: ReportFilters): Promise<ReportResult> {
  const def = DEFS.find((d) => d.key === key);
  if (!def) throw new DomainError("NOT_FOUND", "Report not found");
  if (!def.allowed(actor)) throw new DomainError("FORBIDDEN", "You do not have access to this report");
  const f = reportFiltersSchema.parse(input);
  let subtitle = "";
  try {
    if (key === "employee-workload") {
      const r = resolveRange(f.preset ?? (f.from ? "custom" : "month"), actor.timezone, new Date(), { from: f.from, to: f.to });
      subtitle = `${r.from} to ${r.to}`;
    } else if (f.from || f.to) subtitle = `Due ${f.from ?? "…"} to ${f.to ?? "…"}`;
  } catch (e) {
    throw new DomainError("VALIDATION", e instanceof Error ? e.message : "Invalid range");
  }
  const { rows, total } = await RUNNERS[key](actor, f);
  return { key, title: def.title, columns: def.columns, rows, total, page: f.page, pageSize: f.pageSize, subtitle };
}

/** Pages through a report with the same filters and scope; used by exports (never more than 50,000 rows). */
export async function* iterateReport(actor: Actor, key: ReportKey, input: ReportFilters, pageSize = 100): AsyncGenerator<ReportRow> {
  let page = 1;
  let seen = 0;
  for (;;) {
    const r = await runReport(actor, key, { ...input, page, pageSize });
    for (const row of r.rows) yield row;
    seen += r.rows.length;
    if (r.rows.length === 0 || seen >= r.total || seen >= 50_000) return;
    page++;
  }
}
