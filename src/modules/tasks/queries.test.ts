import { describe, expect, it } from "vitest";
import { todayInTz } from "@/lib/dates";
import { buildActor } from "@/test/factories";
import { workWorld } from "@/test/work";
import { listTaskActivity, listTasks } from "./queries";
import { archiveTask, createTask, updateTask } from "./service";
import { changeTaskStatus } from "./status";

const titles = (r: { rows: { title: string }[] }) => r.rows.map((x) => x.title);

async function seeded() {
  const w = await workWorld();
  const e1 = await w.employee();
  const e2 = await w.employee();
  const c = await w.client();
  const p = await w.project({ clientId: c.id, members: [e1.employeeId] });
  const today = todayInTz(w.manager.timezone);
  const day = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const t = {
    a: await createTask(w.manager, { title: "Alpha late", priority: "Urgent", dueDate: day(-3), assigneeIds: [e1.employeeId] }),
    b: await createTask(w.manager, { title: "Beta soon", priority: "Low", dueDate: day(2), assigneeIds: [e1.employeeId, e2.employeeId] }),
    c: await createTask(w.manager, { title: "Gamma proj", priority: "High", projectId: p.id, dueDate: day(10) }),
    d: await createTask(w.manager, { title: "Delta e2", priority: "Medium", assigneeIds: [e2.employeeId] }),
  };
  await changeTaskStatus(w.manager, t.d.id, "In Progress");
  return { w, e1, e2, c, p, t, day };
}

describe("My Tasks vs All Tasks", () => {
  it("'mine' is only tasks assigned to me; 'all' is what my scope allows", async () => {
    const s = await seeded();
    expect(titles(await listTasks(s.e1.actor, { view: "mine", sort: "title" }))).toEqual(["Alpha late", "Beta soon"]);
    // e1 is assigned to a and b and is a member of project p (task c)
    expect(titles(await listTasks(s.e1.actor, { view: "all", sort: "title" }))).toEqual(["Alpha late", "Beta soon", "Gamma proj"]);
    expect(titles(await listTasks(s.w.manager, { view: "all", sort: "title" }))).toEqual(["Alpha late", "Beta soon", "Delta e2", "Gamma proj"]);
    // a manager's "mine" is not "all": nothing assigned to them
    expect((await listTasks(s.w.manager, { view: "mine" })).total).toBe(0);
  });

  it("shows nothing to an actor without an employee record in 'mine' and 'all'", async () => {
    const s = await seeded();
    const nobody = buildActor({ companyId: s.w.company.id });
    expect((await listTasks(nobody, { view: "mine" })).total).toBe(0);
    expect((await listTasks(nobody, { view: "all" })).total).toBe(0);
  });

  it("never leaks another company's tasks", async () => {
    const s = await seeded();
    const other = await seeded();
    expect((await listTasks(other.w.manager, { view: "all", pageSize: 100 })).rows.every((r) => r.taskCode.length > 0)).toBe(true);
    const ids = (await listTasks(s.w.manager, { view: "all", pageSize: 100 })).rows.map((r) => r.id);
    expect(ids).not.toContain(other.t.a.id);
  });
});

describe("filters", () => {
  it("filters by status, priority, project, client and assignee", async () => {
    const s = await seeded();
    const m = s.w.manager;
    expect(titles(await listTasks(m, { view: "all", status: ["In Progress"] }))).toEqual(["Delta e2"]);
    expect(titles(await listTasks(m, { view: "all", priority: ["Urgent", "High"], sort: "title" }))).toEqual(["Alpha late", "Gamma proj"]);
    expect(titles(await listTasks(m, { view: "all", projectId: s.p.id }))).toEqual(["Gamma proj"]);
    expect(titles(await listTasks(m, { view: "all", clientId: s.c.id }))).toEqual(["Gamma proj"]);
    expect(titles(await listTasks(m, { view: "all", assigneeId: s.e2.employeeId, sort: "title" }))).toEqual(["Beta soon", "Delta e2"]);
  });

  it("filters by due date range and by overdue in company-local time", async () => {
    const s = await seeded();
    const m = s.w.manager;
    expect(titles(await listTasks(m, { view: "all", dueFrom: s.day(0), dueTo: s.day(5) }))).toEqual(["Beta soon"]);
    expect(titles(await listTasks(m, { view: "all", overdue: true }))).toEqual(["Alpha late"]);
    await changeTaskStatus(m, s.t.a.id, "In Progress");
    await changeTaskStatus(m, s.t.a.id, "In Review");
    await changeTaskStatus(m, s.t.a.id, "Completed");
    expect((await listTasks(m, { view: "all", overdue: true })).total).toBe(0);
  });

  it("searches title and code and treats wildcards literally", async () => {
    const s = await seeded();
    const m = s.w.manager;
    expect(titles(await listTasks(m, { view: "all", search: "BETA" }))).toEqual(["Beta soon"]);
    expect((await listTasks(m, { view: "all", search: s.t.c.taskCode })).total).toBe(1);
    expect((await listTasks(m, { view: "all", search: "%" })).total).toBe(0);
  });

  it("hides archived tasks unless asked", async () => {
    const s = await seeded();
    await archiveTask(s.w.manager, s.t.d.id);
    expect((await listTasks(s.w.manager, { view: "all" })).total).toBe(3);
    expect((await listTasks(s.w.manager, { view: "all", includeArchived: true })).total).toBe(4);
  });
});

describe("sorting, paging and shape", () => {
  it("sorts by priority (Urgent first), due date and title", async () => {
    const s = await seeded();
    const m = s.w.manager;
    expect(titles(await listTasks(m, { view: "all", sort: "priority" }))).toEqual(["Alpha late", "Gamma proj", "Delta e2", "Beta soon"]);
    expect(titles(await listTasks(m, { view: "all", sort: "due" }))).toEqual(["Alpha late", "Beta soon", "Gamma proj", "Delta e2"]); // no due date last
    expect(titles(await listTasks(m, { view: "all", sort: "title", dir: "desc" }))).toEqual(["Gamma proj", "Delta e2", "Beta soon", "Alpha late"]);
  });

  it("paginates with a stable total and caps pageSize at 100", async () => {
    const s = await seeded();
    const p1 = await listTasks(s.w.manager, { view: "all", sort: "title", page: 1, pageSize: 3 });
    const p2 = await listTasks(s.w.manager, { view: "all", sort: "title", page: 2, pageSize: 3 });
    expect(p1.total).toBe(4);
    expect(p1.rows).toHaveLength(3);
    expect(titles(p2)).toEqual(["Gamma proj"]);
    await expect(listTasks(s.w.manager, { view: "all", pageSize: 101 })).rejects.toThrow();
  });

  it("includes assignee names on each row", async () => {
    const s = await seeded();
    const row = (await listTasks(s.w.manager, { view: "all", search: "Beta" })).rows[0];
    expect(row.assignees.map((a) => a.employeeId).sort()).toEqual([s.e1.employeeId, s.e2.employeeId].sort());
  });
});

describe("listTaskActivity", () => {
  it("returns the task's history newest first, only for visible tasks", async () => {
    const s = await seeded();
    await updateTask(s.w.manager, s.t.d.id, { title: "Delta renamed" });
    const hist = await listTaskActivity(s.w.manager, s.t.d.id);
    expect(hist.map((h) => h.action)).toEqual(["updated", "status_changed", "assigned", "created"]);
    expect(hist[0].oldValue).toEqual({ title: "Delta e2" });
    await expect(listTaskActivity(s.e1.actor, s.t.d.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
