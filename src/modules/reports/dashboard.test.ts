import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { addDays, todayInTz } from "@/lib/dates";
import { createClient } from "@/modules/clients";
import { createProject } from "@/modules/projects";
import { changeTaskStatus, createTask, listTasks } from "@/modules/tasks";
import { buildActor } from "@/test/factories";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { getDashboard } from "./dashboard";

const COMPANY_KEYS = [...MANAGER_KEYS, "dashboard.company.read", "dashboard.personal.read", "employees.read", "employees.workload.read", "finance.reports.read"] as never[];
const OPERATIONAL_KEYS = [...MANAGER_KEYS, "dashboard.operational.read", "dashboard.personal.read", "employees.read", "employees.workload.read"] as never[];

async function seeded(keys = COMPANY_KEYS) {
  const w = await workWorld(keys);
  const e1 = await w.employee(["tasks.status.update.own", "dashboard.personal.read"] as never[]);
  const e2 = await w.employee(["tasks.status.update.own", "dashboard.personal.read"] as never[]);
  const today = todayInTz(w.manager.timezone);
  const d = (n: number) => addDays(today, n);
  const client = await createClient(w.manager, { name: "C" }).catch(() => null);
  void client;
  const mk = (title: string, o: Record<string, unknown>) => createTask(w.manager, { title, ...o } as never);
  const t = {
    late: await mk("late", { priority: "Urgent", dueDate: d(-3), assigneeIds: [e1.employeeId] }),
    todayDue: await mk("today", { priority: "High", dueDate: d(0), assigneeIds: [e1.employeeId, e2.employeeId] }),
    soon: await mk("soon", { priority: "Low", dueDate: d(5), assigneeIds: [e2.employeeId] }),
    far: await mk("far", { priority: "Medium", dueDate: d(30), assigneeIds: [e2.employeeId] }),
    none: await mk("none", { priority: "Medium" }),
    done: await mk("done", { priority: "High", dueDate: d(-10), assigneeIds: [e1.employeeId] }),
  };
  for (const s of ["In Progress", "In Review", "Completed"] as const) await changeTaskStatus(w.manager, t.done.id, s);
  await changeTaskStatus(w.manager, t.soon.id, "In Progress");
  return { w, e1, e2, t, today, d };
}

const OPEN = ["Pending", "In Progress", "In Review"] as const;

describe("audience", () => {
  it("picks company, operational or personal by permission and denies otherwise", async () => {
    const s = await seeded();
    expect((await getDashboard(s.w.manager, { preset: "month" })).audience).toBe("company");
    const op = await workWorld(OPERATIONAL_KEYS);
    expect((await getDashboard(op.manager, { preset: "month" })).audience).toBe("operational");
    expect((await getDashboard(s.e1.actor, { preset: "month" })).audience).toBe("personal");
    const none = await workWorld(["tasks.read.all"]);
    await expect(getDashboard(none.manager, { preset: "month" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getDashboard(buildActor({ companyId: s.w.company.id }), { preset: "month" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("reconciliation with the task list (AC-12)", () => {
  it("company counts equal the list totals for the same filters", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    const list = (o: Record<string, unknown>) => listTasks(s.w.manager, { view: "all", ...o } as never).then((r) => r.total);
    expect(dash.counts.openTasks).toBe(await list({ status: [...OPEN] }));
    expect(dash.counts.overdueTasks).toBe(await list({ overdue: true }));
    expect(dash.counts.dueNext7Days).toBe(await list({ dueFrom: s.today, dueTo: s.d(7), status: [...OPEN] }));
    expect(dash.counts).toMatchObject({ openTasks: 5, overdueTasks: 1, dueNext7Days: 2 });
  });

  it("status distribution sums to all non-archived tasks, per status equal to the list", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    const all = await listTasks(s.w.manager, { view: "all", pageSize: 100 });
    expect(dash.taskStatus.reduce((n, x) => n + x.count, 0)).toBe(all.total);
    for (const row of dash.taskStatus) {
      expect(row.count).toBe((await listTasks(s.w.manager, { view: "all", status: [row.status as never] })).total);
    }
    expect(dash.taskStatus.map((x) => x.status)).toEqual(["Pending", "In Progress", "In Review", "Completed"]);
  });

  it("priority distribution counts open tasks only", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    expect(dash.taskPriority.reduce((n, x) => n + x.count, 0)).toBe(dash.counts.openTasks);
    expect(dash.taskPriority.find((x) => x.priority === "High")?.count).toBe(1); // the completed High task is excluded
  });

  it("completed-in-period depends on the range", async () => {
    const s = await seeded();
    expect((await getDashboard(s.w.manager, { preset: "today" })).counts.completedTasks).toBe(1);
    const yesterdayOnly = await getDashboard(s.w.manager, { preset: "custom", from: s.d(-9), to: s.d(-2) });
    expect(yesterdayOnly.counts.completedTasks).toBe(0);
  });

  it("deadline and overdue lists contain exactly the matching tasks, ordered by date", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    expect(dash.upcoming.map((x) => x.title)).toEqual(["today", "soon"]);
    expect(dash.overdue.map((x) => x.title)).toEqual(["late"]);
    expect(dash.overdue[0]).toMatchObject({ dueDate: s.d(-3), href: `/tasks/${s.t.late.id}` });
  });

  it("workload sums to the open (task, assignee) pairs", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    // late(e1) + today(e1,e2) + soon(e2) + far(e2) = 5 open pairs; done is completed, none has no assignee
    expect(dash.workload!.reduce((n, r) => n + r.open, 0)).toBe(5);
    expect(dash.workload!.reduce((n, r) => n + r.overdue, 0)).toBe(1);
  });

  it("personal dashboard equals My Tasks for the same user", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.e1.actor, { preset: "month" });
    const mine = (o: Record<string, unknown>) => listTasks(s.e1.actor, { view: "mine", ...o } as never).then((r) => r.total);
    expect(dash.counts.openTasks).toBe(await mine({ status: [...OPEN] }));
    expect(dash.counts.overdueTasks).toBe(await mine({ overdue: true }));
    expect(dash.counts.openTasks).toBe(2);
    expect(dash.workload).toBeNull();
    expect(dash.counts.activeEmployees).toBeNull();
    expect(dash.counts.activeClients).toBeNull();
  });
});

describe("scope, finance and isolation", () => {
  it("an operational dashboard has no finance; company without finance permission has none either", async () => {
    const op = await workWorld(OPERATIONAL_KEYS);
    expect((await getDashboard(op.manager, { preset: "month" })).finance).toBeNull();
    const noFin = await workWorld(COMPANY_KEYS.filter((k) => k !== "finance.reports.read"));
    expect((await getDashboard(noFin.manager, { preset: "month" })).finance).toBeNull();
  });

  it("a company dashboard with finance access includes the snapshot", async () => {
    const s = await seeded();
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    expect(dash.finance).not.toBeNull();
    expect(dash.finance!.labels.outstandingReceivables).toBe("point in time");
  });

  it("never counts another company's records", async () => {
    const a = await seeded();
    const b = await seeded();
    const dashA = await getDashboard(a.w.manager, { preset: "month" });
    const dashB = await getDashboard(b.w.manager, { preset: "month" });
    expect(dashA.counts.openTasks).toBe(5);
    expect(dashB.counts.openTasks).toBe(5);
    expect(dashA.workload!.length).toBe(2);
  });

  it("counts active employees, clients and projects with the same rules as their lists", async () => {
    const s = await seeded();
    await createClient(s.w.manager, { name: "Real client" }).catch(() => undefined);
    const dash = await getDashboard(s.w.manager, { preset: "month" });
    expect(dash.counts.activeEmployees).toBe(3); // manager + 2 employees
    void createProject;
  });
});

describe("timezone drives 'today' (AC-07)", () => {
  it("the same task is overdue in one company timezone and not in another", async () => {
    // A company with no other dated tasks: seeded() dates tasks in the default timezone, and those
    // flip between overdue/not-overdue too, which made this test depend on the time of day it ran.
    const w = await workWorld(COMPANY_KEYS);
    // UTC-11 and UTC+14 are 25h apart, so their calendar dates always differ: a task due on the
    // western "today" is never overdue there, and is always overdue in the east.
    await createTask(w.manager, { title: "tz task", dueDate: todayInTz("Pacific/Pago_Pago") });

    await db.update(companies).set({ timezone: "Pacific/Pago_Pago" }).where(eq(companies.id, w.company.id));
    const west = await getDashboard(await loadActor(w.managerUserId), { preset: "month" });
    await db.update(companies).set({ timezone: "Pacific/Kiritimati" }).where(eq(companies.id, w.company.id));
    const east = await getDashboard(await loadActor(w.managerUserId), { preset: "month" });
    expect(west.counts.overdueTasks).toBe(0);
    expect(east.counts.overdueTasks).toBe(1);
  });
});
