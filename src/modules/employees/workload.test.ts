import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { employees, taskAssignees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadActor } from "@/lib/auth/load-actor";
import { buildActor, createCompany, createEmployee, createTask, createUser, grantPermissions } from "@/test/factories";
import { getEmployeeTasks, getWorkload } from "./workload";

const ymd = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
};

async function world() {
  const company = await createCompany({ timezone: "UTC" });
  const emp = await createEmployee(company.id);
  const mgrUser = await createUser(company.id);
  await grantPermissions(company.id, mgrUser.id, ["employees.workload.read", "employees.read"], "Mgr");
  const mgr = await loadActor(mgrUser.id);

  const assign = async (taskId: string) => db.insert(taskAssignees).values({ taskId, companyId: company.id, employeeId: emp.id });
  const mk = async (o: Parameters<typeof createTask>[1]) => {
    const t = await createTask(company.id, o);
    await assign(t.id);
    return t;
  };
  await mk({ status: "Pending", dueDate: ymd(5) }); // open
  await mk({ status: "In Progress", dueDate: ymd(-2) }); // in progress + overdue
  await mk({ status: "In Review", dueDate: ymd(-1) }); // open + overdue
  await mk({ status: "Pending", dueDate: ymd(0) }); // due today: NOT overdue
  await mk({ status: "Pending" }); // no due date: never overdue
  await mk({ status: "Completed", dueDate: ymd(-10), completedAt: new Date() }); // completed in period, not overdue
  await mk({ status: "Completed", dueDate: ymd(-30), completedAt: new Date(Date.now() - 40 * 86_400_000) }); // completed long ago
  const archived = await mk({ status: "Pending", dueDate: ymd(-3) });
  await db.execute((await import("drizzle-orm")).sql`UPDATE tasks SET archived_at = now() WHERE id = ${archived.id}`);
  const unassigned = await createTask(company.id, { status: "Pending", dueDate: ymd(-4) });
  void unassigned;
  return { company, emp, mgr };
}

describe("getWorkload", () => {
  it("counts open, in-progress, overdue and completed-in-period correctly", async () => {
    const w = await world();
    const r = await getWorkload(w.mgr, w.emp.id, { periodDays: 30 });
    expect(r).toEqual({ employeeId: w.emp.id, open: 5, inProgress: 1, overdue: 2, completedInPeriod: 1 });
  });

  it("lets an employee see their own workload without workload permission", async () => {
    const w = await world();
    const u = await createUser(w.company.id);
    await db.update(employees).set({ userId: u.id }).where(eq(employees.id, w.emp.id));
    const self = await loadActor(u.id);
    expect((await getWorkload(self)).open).toBe(5);
    expect((await getWorkload(self, w.emp.id)).open).toBe(5);
  });

  it("denies someone else's workload without employees.workload.read", async () => {
    const w = await world();
    const stranger = buildActor({ companyId: w.company.id, employeeId: (await createEmployee(w.company.id)).id });
    await expect(getWorkload(stranger, w.emp.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("treats another company's employee as NOT_FOUND", async () => {
    const w = await world();
    const other = await world();
    await expect(getWorkload(w.mgr, other.emp.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getEmployeeTasks", () => {
  it("returns the assigned, completed and overdue tabs", async () => {
    const w = await world();
    const assigned = await getEmployeeTasks(w.mgr, w.emp.id, "assigned");
    const completed = await getEmployeeTasks(w.mgr, w.emp.id, "completed");
    const overdue = await getEmployeeTasks(w.mgr, w.emp.id, "overdue");
    expect(assigned.map((t) => t.status).sort()).toEqual(["In Progress", "In Review", "Pending", "Pending", "Pending"]);
    expect(completed).toHaveLength(2);
    expect(overdue).toHaveLength(2);
    expect(overdue.every((t) => t.status !== "Completed")).toBe(true);
  });

  it("requires permission for another employee's tasks", async () => {
    const w = await world();
    const stranger = buildActor({ companyId: w.company.id, employeeId: (await createEmployee(w.company.id)).id });
    await expect(getEmployeeTasks(stranger, w.emp.id, "assigned")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
