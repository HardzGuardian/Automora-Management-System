import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { clients, projectMembers, projects, taskAssignees, tasks } from "@/db/schema";
import {
  buildActor,
  createClient,
  createCompany,
  createEmployee,
  createProject,
  createTask,
} from "@/test/factories";
import { clientScope, projectScope, taskScope } from "./scope";
import type { PermissionKey } from "./catalog";

const perms = (...k: PermissionKey[]) => new Set<PermissionKey>(k);

async function world() {
  const c = await createCompany();
  const a = await createEmployee(c.id);
  const b = await createEmployee(c.id);
  const projectOfA = await createProject(c.id, a.id);
  await db.insert(projectMembers).values({ projectId: projectOfA.id, companyId: c.id, employeeId: a.id });
  const taskAssignedToA = await createTask(c.id);
  await db.insert(taskAssignees).values({ taskId: taskAssignedToA.id, companyId: c.id, employeeId: a.id });
  const taskInProjectOfA = await createTask(c.id, { projectId: projectOfA.id });
  const taskOfB = await createTask(c.id);
  await db.insert(taskAssignees).values({ taskId: taskOfB.id, companyId: c.id, employeeId: b.id });
  const unrelatedTask = await createTask(c.id);
  return { c, a, b, projectOfA, taskAssignedToA, taskInProjectOfA, taskOfB, unrelatedTask };
}

const visibleTasks = async (actor: ReturnType<typeof buildActor>) =>
  (await db.select({ id: tasks.id }).from(tasks).where(taskScope(actor))).map((r) => r.id);

describe("taskScope", () => {
  it("shows an employee only assigned tasks and tasks of projects they belong to", async () => {
    const w = await world();
    const actor = buildActor({ companyId: w.c.id, employeeId: w.a.id });
    const ids = await visibleTasks(actor);
    expect(ids.sort()).toEqual([w.taskAssignedToA.id, w.taskInProjectOfA.id].sort());
    expect(ids).not.toContain(w.taskOfB.id);
    expect(ids).not.toContain(w.unrelatedTask.id);
  });

  it("shows nothing to an actor with no employee record and no read.all", async () => {
    const w = await world();
    expect(await visibleTasks(buildActor({ companyId: w.c.id }))).toEqual([]);
  });

  it("shows the whole company, and only that company, with tasks.read.all", async () => {
    const w = await world();
    const other = await createCompany();
    const foreign = await createTask(other.id);
    const ids = await visibleTasks(buildActor({ companyId: w.c.id, permissions: perms("tasks.read.all") }));
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain(foreign.id);
  });
});

describe("projectScope", () => {
  it("shows an employee only projects they are a member of", async () => {
    const w = await world();
    const other = await createProject(w.c.id, w.b.id);
    const ids = (
      await db.select({ id: projects.id }).from(projects).where(projectScope(buildActor({ companyId: w.c.id, employeeId: w.a.id })))
    ).map((r) => r.id);
    expect(ids).toEqual([w.projectOfA.id]);
    expect(ids).not.toContain(other.id);
  });

  it("shows all company projects with projects.read.all but never another company's", async () => {
    const w = await world();
    const o = await createCompany();
    const oe = await createEmployee(o.id);
    await createProject(o.id, oe.id);
    const rows = await db
      .select({ id: projects.id, companyId: projects.companyId })
      .from(projects)
      .where(projectScope(buildActor({ companyId: w.c.id, permissions: perms("projects.read.all") })));
    expect(rows.every((r) => r.companyId === w.c.id)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("clientScope", () => {
  it("hides clients without clients.read and shows only own company's with it", async () => {
    const w = await world();
    const mine = await createClient(w.c.id);
    const o = await createCompany();
    await createClient(o.id);
    const none = await db.select().from(clients).where(clientScope(buildActor({ companyId: w.c.id, employeeId: w.a.id })));
    expect(none).toEqual([]);
    const some = await db
      .select()
      .from(clients)
      .where(and(clientScope(buildActor({ companyId: w.c.id, permissions: perms("clients.read") })), eq(clients.id, mine.id)));
    expect(some).toHaveLength(1);
    const all = await db.select().from(clients).where(clientScope(buildActor({ companyId: w.c.id, permissions: perms("clients.read") })));
    expect(all.every((r) => r.companyId === w.c.id)).toBe(true);
  });
});
