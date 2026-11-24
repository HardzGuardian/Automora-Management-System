import { config } from "dotenv";

config({ quiet: true });

/**
 * Automora MCP server (stdio). Lets an AI assistant read company data through the SAME service layer
 * the web app uses, as one specific signed-in user, so every permission and scope rule still applies.
 *
 *   AUTOMORA_MCP_USER_EMAIL=admin@company.com  pnpm mcp
 *   AUTOMORA_MCP_WRITE=true                    also enables a few write tools (off by default)
 *
 * stdout carries the protocol; anything human-readable goes to stderr.
 */
async function main() {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import("zod");
  const { sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { user } = await import("@/db/schema");
  const { loadActor } = await import("@/lib/auth/load-actor");
  const { DomainError } = await import("@/lib/errors");
  const { listTasks, getTask, createTask, changeTaskStatus, addComment } = await import("@/modules/tasks");
  const { projectsOverview, getProject, getProjectProgress } = await import("@/modules/projects");
  const { listClients, getClient } = await import("@/modules/clients");
  const { listEmployees, getEmployee, getWorkload } = await import("@/modules/employees");
  const { getDashboard } = await import("@/modules/reports");
  const { availableReports, runReport } = await import("@/modules/reports");
  const { listInvoices, getInvoiceDetail, getFinanceSnapshot, getProjectFinanceOverview } = await import("@/modules/finance");

  const email = process.env.AUTOMORA_MCP_USER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set AUTOMORA_MCP_USER_EMAIL to the Automora user this server should act as.");
  const write = process.env.AUTOMORA_MCP_WRITE === "true";

  const [u] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1).catch(() => []);
  if (!u) throw new Error(`No Automora user with email ${email}`);
  // Loaded per call so a role change or suspension takes effect immediately.
  const actor = () => loadActor(u.id);

  const server = new McpServer({ name: "automora", version: "1.0.0" });

  type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
  const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
  const fail = (e: unknown): Result => {
    const message = e instanceof DomainError ? `${e.code}: ${e.message}` : e instanceof z.ZodError ? `Invalid input: ${e.issues[0]?.message}` : "Something went wrong";
    if (!(e instanceof DomainError) && !(e instanceof z.ZodError)) process.stderr.write(`[automora-mcp] ${String(e)}\n`);
    return { content: [{ type: "text", text: message }], isError: true };
  };
  const run = (fn: (a: Awaited<ReturnType<typeof actor>>) => Promise<unknown>) => async (): Promise<Result> => {
    try {
      return ok(await fn(await actor()));
    } catch (e) {
      return fail(e);
    }
  };
  const runWith = <T>(fn: (a: Awaited<ReturnType<typeof actor>>, input: T) => Promise<unknown>) => async (input: T): Promise<Result> => {
    try {
      return ok(await fn(await actor(), input));
    } catch (e) {
      return fail(e);
    }
  };

  const page = z.number().int().min(1).default(1);
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool("whoami", { description: "Who this server is acting as, with roles and permission count.", annotations: readOnly }, run(async (a) => ({ userId: a.userId, roles: a.roles, permissions: a.permissions.size, timezone: a.timezone, writeToolsEnabled: write })));

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks the user may see, newest filters first. Supports search, status, priority, overdue and assignee filters.",
      inputSchema: {
        search: z.string().optional().describe("Title or task code"),
        status: z.enum(["Pending", "In Progress", "In Review", "Completed"]).optional(),
        priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        overdue: z.boolean().optional(),
        mine: z.boolean().optional().describe("Only tasks assigned to the user"),
        projectId: z.string().uuid().optional(),
        page,
      },
      annotations: readOnly,
    },
    runWith(async (a, i: { search?: string; status?: "Pending" | "In Progress" | "In Review" | "Completed"; priority?: "Low" | "Medium" | "High" | "Critical"; overdue?: boolean; mine?: boolean; projectId?: string; page: number }) => {
      const r = await listTasks(a, { search: i.search, status: i.status ? [i.status] : undefined, priority: i.priority ? [i.priority] : undefined, overdue: i.overdue, view: i.mine ? "mine" : "all", projectId: i.projectId, page: i.page, pageSize: 25 });
      return { total: r.total, page: i.page, tasks: r.rows.map((t) => ({ id: t.id, code: t.taskCode, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, projectId: t.projectId, assignees: t.assignees.map((x) => x.fullName) })) };
    }),
  );

  server.registerTool("get_task", { description: "One task with description, dates, hours and assignees.", inputSchema: { id: z.string().uuid() }, annotations: readOnly }, runWith((a, i: { id: string }) => getTask(a, i.id)));

  server.registerTool(
    "list_projects",
    { description: "Projects the user may see with client, team, progress, open tasks, due date and status.", inputSchema: { search: z.string().optional() }, annotations: readOnly },
    runWith((a, i: { search?: string }) => projectsOverview(a, { search: i.search })),
  );

  server.registerTool(
    "get_project",
    { description: "One project's details and progress.", inputSchema: { id: z.string().uuid() }, annotations: readOnly },
    runWith(async (a, i: { id: string }) => ({ project: await getProject(a, i.id), progress: await getProjectProgress(a, i.id) })),
  );

  server.registerTool(
    "list_clients",
    { description: "Clients (needs clients.read).", inputSchema: { search: z.string().optional(), page }, annotations: readOnly },
    runWith(async (a, i: { search?: string; page: number }) => {
      const r = await listClients(a, { search: i.search, page: i.page, pageSize: 25 });
      return { total: r.total, clients: r.rows.map((c) => ({ id: c.id, code: c.clientCode, name: c.name, contact: c.contactPerson, email: c.email, status: c.status })) };
    }),
  );

  server.registerTool("get_client", { description: "One client's record.", inputSchema: { id: z.string().uuid() }, annotations: readOnly }, runWith((a, i: { id: string }) => getClient(a, i.id)));

  server.registerTool(
    "list_employees",
    { description: "Employee directory (needs employees.read).", inputSchema: { search: z.string().optional(), status: z.enum(["Active", "Inactive", "Suspended"]).optional(), page }, annotations: readOnly },
    runWith(async (a, i: { search?: string; status?: "Active" | "Inactive" | "Suspended"; page: number }) => {
      const r = await listEmployees(a, { search: i.search, status: i.status, page: i.page, pageSize: 25 });
      return { total: r.total, employees: r.rows.map((e) => ({ id: e.id, code: e.employeeCode, name: e.fullName, designation: e.designation, status: e.employmentStatus })) };
    }),
  );

  server.registerTool(
    "get_employee_workload",
    { description: "An employee's open, in-progress and overdue task counts.", inputSchema: { id: z.string().uuid() }, annotations: readOnly },
    runWith(async (a, i: { id: string }) => ({ employee: (await getEmployee(a, i.id)).fullName, workload: await getWorkload(a, i.id) })),
  );

  server.registerTool(
    "dashboard_summary",
    { description: "Company dashboard numbers for a period: KPIs, task status and priority, overdue and upcoming work, workload and finance snapshot.", inputSchema: { preset: z.enum(["today", "week", "month", "quarter"]).default("month") }, annotations: readOnly },
    runWith(async (a, i: { preset: "today" | "week" | "month" | "quarter" }) => {
      const d = await getDashboard(a, { preset: i.preset });
      return { range: d.range, counts: d.counts, taskStatus: d.taskStatus, taskPriority: d.taskPriority, overdue: d.overdue, upcoming: d.upcoming, workload: d.workload, finance: d.finance };
    }),
  );

  server.registerTool(
    "list_invoices",
    { description: "Invoices (needs finance.invoices.read).", inputSchema: { status: z.enum(["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"]).optional(), page }, annotations: readOnly },
    runWith((a, i: { status?: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled"; page: number }) => listInvoices(a, { status: i.status, page: i.page, pageSize: 25 })),
  );

  server.registerTool("get_invoice", { description: "One invoice with lines, receipts and balance.", inputSchema: { id: z.string().uuid() }, annotations: readOnly }, runWith((a, i: { id: string }) => getInvoiceDetail(a, i.id)));

  server.registerTool(
    "finance_snapshot",
    { description: "Invoiced, received, expenses, outstanding receivables and net cash movement for a date range (needs finance.reports.read).", inputSchema: { from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }, annotations: readOnly },
    runWith((a, i: { from: string; to: string }) => getFinanceSnapshot(a, { fromDate: i.from, toDate: i.to })),
  );

  server.registerTool("project_finance", { description: "Per-project budget, invoiced and cash position (needs finance read permissions).", annotations: readOnly }, run((a) => getProjectFinanceOverview(a, { pageSize: 100 })));

  server.registerTool(
    "run_report",
    {
      description: "Run an operational report: task-register, employee-workload, project-status or client-summary.",
      inputSchema: { report: z.enum(["task-register", "employee-workload", "project-status", "client-summary"]), preset: z.enum(["today", "week", "month", "quarter"]).default("month"), page },
      annotations: readOnly,
    },
    runWith(async (a, i: { report: "task-register" | "employee-workload" | "project-status" | "client-summary"; preset: "today" | "week" | "month" | "quarter"; page: number }) => {
      if (!availableReports(a).some((r) => r.key === i.report)) throw new DomainError("FORBIDDEN", "You do not have access to this report");
      const r = await runReport(a, i.report, { preset: i.preset, page: i.page, pageSize: 50 });
      return { title: r.title, subtitle: r.subtitle, total: r.total, columns: r.columns.map((c) => c.label), rows: r.rows };
    }),
  );

  if (write) {
    server.registerTool(
      "create_task",
      { description: "Create a task (needs tasks.create; assigning needs tasks.assign).", inputSchema: { title: z.string().min(1).max(200), description: z.string().optional(), priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), projectId: z.string().uuid().optional(), assigneeIds: z.array(z.string().uuid()).optional() }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
      runWith((a, i: { title: string; description?: string; priority: "Low" | "Medium" | "High" | "Critical"; dueDate?: string; projectId?: string; assigneeIds?: string[] }) => createTask(a, { title: i.title, description: i.description ?? null, priority: i.priority, dueDate: i.dueDate ?? null, projectId: i.projectId ?? null, assigneeIds: i.assigneeIds })),
    );
    server.registerTool(
      "change_task_status",
      { description: "Move a task to another status (same rules as the app).", inputSchema: { id: z.string().uuid(), status: z.enum(["Pending", "In Progress", "In Review", "Completed"]) }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
      runWith((a, i: { id: string; status: string }) => changeTaskStatus(a, i.id, i.status)),
    );
    server.registerTool(
      "add_task_comment",
      { description: "Comment on a task.", inputSchema: { id: z.string().uuid(), body: z.string().min(1).max(4000) }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
      runWith((a, i: { id: string; body: string }) => addComment(a, i.id, i.body)),
    );
  }

  await server.connect(new StdioServerTransport());
  process.stderr.write(`[automora-mcp] ready as ${email} (${write ? "read+write" : "read-only"})\n`);
}

main().catch((e) => {
  process.stderr.write(`[automora-mcp] ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
