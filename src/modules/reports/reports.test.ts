import { describe, expect, it } from "vitest";
import { addDays, todayInTz } from "@/lib/dates";
import { createClient } from "@/modules/clients";
import { getProjectProgress } from "@/modules/projects";
import { changeTaskStatus, createTask, listTasks } from "@/modules/tasks";
import { buildActor } from "@/test/factories";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { getDashboard } from "./dashboard";
import { availableReports, iterateReport, runReport } from "./reports";

const ALL = [...MANAGER_KEYS, "reports.all.read", "employees.read", "employees.workload.read", "projects.create", "clients.create", "dashboard.company.read"] as never[];

async function seeded() {
  const w = await workWorld(ALL);
  const e1 = await w.employee(["tasks.status.update.own", "reports.personal.read", "dashboard.personal.read"] as never[]);
  const e2 = await w.employee(["tasks.status.update.own", "reports.personal.read"] as never[]);
  const client = await createClient(w.manager, { name: "Acme" });
  const project = await w.project({ clientId: client.id, members: [e1.employeeId, e2.employeeId] });
  const today = todayInTz(w.manager.timezone);
  const d = (n: number) => addDays(today, n);
  const mk = (title: string, o: Record<string, unknown>) => createTask(w.manager, { title, projectId: project.id, ...o } as never);
  const a = await mk("a late", { priority: "Urgent", dueDate: d(-2), assigneeIds: [e1.employeeId] });
  const b = await mk("b soon", { priority: "Low", dueDate: d(3), assigneeIds: [e1.employeeId, e2.employeeId] });
  const c = await mk("c done", { priority: "High", dueDate: d(-5), assigneeIds: [e2.employeeId] });
  for (const s of ["In Progress", "In Review", "Completed"] as const) await changeTaskStatus(w.manager, c.id, s);
  await changeTaskStatus(w.manager, b.id, "In Progress");
  return { w, e1, e2, client, project, a, b, c, today, d };
}

describe("availableReports", () => {
  it("depends on report scope and related permissions", async () => {
    const s = await seeded();
    expect(availableReports(s.w.manager).map((r) => r.key).sort()).toEqual(["client-summary", "employee-workload", "project-status", "task-register"]);
    expect(availableReports(s.e1.actor).map((r) => r.key)).toEqual(["task-register"]);
    const limited = await workWorld([...MANAGER_KEYS, "reports.limited.read"] as never[]);
    expect(availableReports(limited.manager).map((r) => r.key).sort()).toEqual(["client-summary", "project-status", "task-register"]);
    const limitedWithWorkload = await workWorld([...MANAGER_KEYS, "reports.limited.read", "employees.workload.read"] as never[]);
    expect(availableReports(limitedWithWorkload.manager).map((r) => r.key)).toContain("employee-workload");
    expect(availableReports(buildActor({ companyId: s.w.company.id }))).toEqual([]);
  });

  it("denies running an unavailable report", async () => {
    const s = await seeded();
    await expect(runReport(s.e1.actor, "employee-workload", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(runReport(s.e1.actor, "project-status", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(runReport(s.w.manager, "nope" as never, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("task register reconciles with the task list (AC-12)", () => {
  it("same total and the same rows as listTasks for the same filters", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "task-register", { pageSize: 100 });
    const list = await listTasks(s.w.manager, { view: "all", pageSize: 100 });
    expect(rep.total).toBe(list.total);
    expect(rep.rows.map((r) => r.taskCode).sort()).toEqual(list.rows.map((t) => t.taskCode).sort());

    const filtered = await runReport(s.w.manager, "task-register", { status: ["In Progress"], priority: ["Low"] });
    const flist = await listTasks(s.w.manager, { view: "all", status: ["In Progress"], priority: ["Low"] });
    expect(filtered.total).toBe(flist.total);
    expect(filtered.total).toBe(1);
  });

  it("includes project, client, assignees and an overdue flag; overdue count matches the dashboard", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "task-register", { pageSize: 100 });
    const late = rep.rows.find((r) => r.title === "a late")!;
    expect(late).toMatchObject({ status: "Pending", priority: "Urgent", overdue: "Yes", client: "Acme" });
    expect(late.assignees).toContain("");
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    expect(rep.rows.filter((r) => r.overdue === "Yes").length).toBe(dash.counts.overdueTasks);
    expect(rep.rows.find((r) => r.title === "c done")!.overdue).toBe("No");
  });

  it("an employee's personal register is only their own tasks, equal to My Tasks", async () => {
    const s = await seeded();
    const rep = await runReport(s.e1.actor, "task-register", { pageSize: 100 });
    const mine = await listTasks(s.e1.actor, { view: "mine", pageSize: 100 });
    expect(rep.total).toBe(mine.total);
    expect(rep.total).toBe(2);
    expect(rep.rows.map((r) => r.title).sort()).toEqual(["a late", "b soon"]);
  });

  it("due-date range filter limits rows", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "task-register", { from: s.d(0), to: s.d(10) });
    expect(rep.rows.map((r) => r.title)).toEqual(["b soon"]);
  });
});

describe("employee workload report", () => {
  it("totals equal the dashboard workload and the underlying assignments", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "employee-workload", { preset: "month" });
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    const sum = (k: string) => rep.rows.reduce((n, r) => n + Number(r[k]), 0);
    expect(sum("open")).toBe(dash.workload!.reduce((n, r) => n + r.open, 0));
    expect(sum("open")).toBe(3); // a(e1) + b(e1,e2)
    expect(sum("overdue")).toBe(1);
    expect(sum("completed")).toBe(1); // c(e2) completed today
    expect(rep.total).toBe(rep.rows.length);
  });

  it("lists active employees with zero work, and excludes inactive ones", async () => {
    const s = await seeded();
    await s.w.bareEmployee({ fullName: "Idle Ivan" });
    await s.w.bareEmployee({ fullName: "Gone Gary", employmentStatus: "Inactive" });
    const rep = await runReport(s.w.manager, "employee-workload", { preset: "month" });
    const names = rep.rows.map((r) => r.employee);
    expect(names).toContain("Idle Ivan");
    expect(names).not.toContain("Gone Gary");
    expect(rep.rows.find((r) => r.employee === "Idle Ivan")).toMatchObject({ open: 0, overdue: 0 });
  });
});

describe("project status and client summary reports", () => {
  it("project progress equals the project module's progress", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "project-status", {});
    const row = rep.rows.find((r) => r.projectCode === s.project.projectCode)!;
    const progress = await getProjectProgress(s.w.manager, s.project.id);
    expect(row.progress).toBe(`${progress.percent}%`);
    expect(row).toMatchObject({ openTasks: 2, overdueTasks: 1, client: "Acme" });
  });

  it("client summary counts projects and open tasks", async () => {
    const s = await seeded();
    const rep = await runReport(s.w.manager, "client-summary", {});
    expect(rep.rows.find((r) => r.name === "Acme")).toMatchObject({ projects: 1, openTasks: 2 });
  });

  it("never mixes in another company's records", async () => {
    const a = await seeded();
    const b = await seeded();
    const ra = await runReport(a.w.manager, "project-status", {});
    const rb = await runReport(b.w.manager, "project-status", {});
    expect(ra.total).toBe(1);
    expect(rb.total).toBe(1);
    expect((await runReport(a.w.manager, "task-register", { pageSize: 100 })).total).toBe(3);
  });
});

describe("iterateReport (used by exports)", () => {
  it("yields every row across pages, identical to the paged result", async () => {
    const s = await seeded();
    for (let i = 0; i < 4; i++) await createTask(s.w.manager, { title: `extra ${i}` });
    const total = (await runReport(s.w.manager, "task-register", {})).total;
    const rows: unknown[] = [];
    for await (const r of iterateReport(s.w.manager, "task-register", {}, 3)) rows.push(r);
    expect(rows).toHaveLength(total);
    expect(total).toBe(7);
  });
});
