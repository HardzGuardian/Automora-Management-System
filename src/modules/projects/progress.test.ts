import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { loadActor } from "@/lib/auth/load-actor";
import { createCompany, createEmployee, createProject, createTask, createUser, grantPermissions } from "@/test/factories";
import { calcProgress, getProgressForProjects, getProjectProgress } from "./progress";

describe("calcProgress (table-driven)", () => {
  it.each([
    [0, 0, 0],
    [0, 5, 0],
    [1, 3, 33],
    [2, 3, 66],
    [5, 5, 100],
    [199, 200, 99], // never shows 100% until everything is done
    [1, 1, 100],
  ])("done=%i total=%i -> %i%%", (done, total, pct) => {
    expect(calcProgress(done, total)).toBe(pct);
  });

  it("rejects impossible input", () => {
    expect(() => calcProgress(-1, 3)).toThrow();
    expect(() => calcProgress(4, 3)).toThrow();
  });
});

async function world() {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, ["projects.read.all"], "R");
  const emp = await createEmployee(company.id);
  const project = await createProject(company.id, emp.id);
  return { company, emp, project, actor: await loadActor(u.id) };
}

describe("getProjectProgress", () => {
  it("is 0% with no tasks", async () => {
    const w = await world();
    expect(await getProjectProgress(w.actor, w.project.id)).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("counts completed over non-archived tasks of this project only", async () => {
    const w = await world();
    const other = await createProject(w.company.id, w.emp.id);
    await createTask(w.company.id, { projectId: w.project.id, status: "Completed", completedAt: new Date() });
    await createTask(w.company.id, { projectId: w.project.id, status: "In Progress" });
    await createTask(w.company.id, { projectId: w.project.id, status: "Pending" });
    const archived = await createTask(w.company.id, { projectId: w.project.id, status: "Completed", completedAt: new Date() });
    await db.execute(sql`UPDATE tasks SET archived_at = now() WHERE id = ${archived.id}`);
    await createTask(w.company.id, { projectId: other.id, status: "Completed", completedAt: new Date() });
    expect(await getProjectProgress(w.actor, w.project.id)).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("is NOT_FOUND outside the actor's scope", async () => {
    const w = await world();
    const other = await world();
    await expect(getProjectProgress(other.actor, w.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getProgressForProjects", () => {
  it("returns progress for several projects, defaulting to 0, and skips out-of-scope ids", async () => {
    const w = await world();
    const p2 = await createProject(w.company.id, w.emp.id);
    await createTask(w.company.id, { projectId: w.project.id, status: "Completed", completedAt: new Date() });
    await createTask(w.company.id, { projectId: w.project.id, status: "Pending" });
    const foreign = await world();
    const map = await getProgressForProjects(w.actor, [w.project.id, p2.id, foreign.project.id]);
    expect(map.get(w.project.id)).toEqual({ done: 1, total: 2, percent: 50 });
    expect(map.get(p2.id)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(map.has(foreign.project.id)).toBe(false);
  });
});
