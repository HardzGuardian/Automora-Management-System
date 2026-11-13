import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { projectMembers, taskActivityLogs } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { createCompany, createEmployee, createProject, createTask, createUser, grantPermissions } from "@/test/factories";
import { getEmployeeActivity, getEmployeeProjects } from "./workload";

async function world() {
  const company = await createCompany({ timezone: "UTC" });
  const personUser = await createUser(company.id);
  const person = await createEmployee(company.id, { userId: personUser.id });
  const owner = await createEmployee(company.id);

  const seen = await createProject(company.id, owner.id, { name: "Visible project" });
  const hidden = await createProject(company.id, owner.id, { name: "Other project" });
  const archived = await createProject(company.id, owner.id, { name: "Old project", archivedAt: new Date() });
  for (const p of [seen, hidden, archived]) {
    await db.insert(projectMembers).values({ projectId: p.id, companyId: company.id, employeeId: person.id, membershipRole: "member" });
  }

  const actorWith = async (keys: string[], employeeId?: string) => {
    const u = await createUser(company.id);
    if (employeeId) await createEmployee(company.id, { userId: u.id });
    await grantPermissions(company.id, u.id, keys as never, `Role ${u.id.slice(0, 6)}`);
    return loadActor(u.id);
  };
  const boss = await actorWith(["employees.workload.read", "employees.read", "projects.read.all", "tasks.read.all"]);
  const blind = await actorWith(["employees.workload.read", "employees.read"]); // can see people, no project or task scope

  const task = await createTask(company.id, { title: "Wire it up" });
  const log = (action: string, actorId = personUser.id) =>
    db.insert(taskActivityLogs).values({ companyId: company.id, taskId: task.id, actorId, action });
  return { company, person, personUser, seen, hidden, archived, boss, blind, task, log, actorWith };
}

describe("getEmployeeProjects", () => {
  it("lists the projects the employee belongs to, for a viewer who can see all projects", async () => {
    const w = await world();
    const rows = await getEmployeeProjects(w.boss, w.person.id);
    expect(rows.map((r) => r.name)).toEqual(["Old project", "Other project", "Visible project"]);
    expect(rows.find((r) => r.name === "Old project")?.archived).toBe(true);
    expect(rows.every((r) => r.membershipRole === "member")).toBe(true);
  });

  it("shows only projects the viewer may see", async () => {
    const w = await world();
    expect(await getEmployeeProjects(w.blind, w.person.id)).toEqual([]);
    // A viewer who is a member of just one of them sees just that one.
    const viewerUser = await createUser(w.company.id);
    const viewerEmp = await createEmployee(w.company.id, { userId: viewerUser.id });
    await grantPermissions(w.company.id, viewerUser.id, ["employees.workload.read"], "Member viewer");
    await db.insert(projectMembers).values({ projectId: w.seen.id, companyId: w.company.id, employeeId: viewerEmp.id, membershipRole: "member" });
    const rows = await getEmployeeProjects(await loadActor(viewerUser.id), w.person.id);
    expect(rows.map((r) => r.name)).toEqual(["Visible project"]);
  });

  it("lets a person see their own projects, but not someone else's without workload access", async () => {
    const w = await world();
    const self = await loadActor(w.personUser.id);
    expect((await getEmployeeProjects(self, w.person.id)).length).toBeGreaterThan(0);
    const colleague = await w.actorWith(["tasks.comment"], "x");
    await expect(getEmployeeProjects(colleague, w.person.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not cross companies", async () => {
    const w = await world();
    const other = await world();
    await expect(getEmployeeProjects(other.boss, w.person.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getEmployeeActivity", () => {
  it("lists what the employee did on tasks the viewer may see, newest first, without comments", async () => {
    const w = await world();
    await w.log("created");
    await w.log("comment_added");
    await w.log("status_changed");
    const rows = await getEmployeeActivity(w.boss, w.person.id);
    expect(rows.map((r) => r.action)).toEqual(["status_changed", "created"]);
    expect(rows[0]).toMatchObject({ taskId: w.task.id, taskTitle: "Wire it up" });
  });

  it("ignores other people's actions and hides tasks outside the viewer's scope", async () => {
    const w = await world();
    const otherUser = await createUser(w.company.id);
    await w.log("created", otherUser.id);
    await w.log("updated");
    expect((await getEmployeeActivity(w.boss, w.person.id)).map((r) => r.action)).toEqual(["updated"]);
    expect(await getEmployeeActivity(w.blind, w.person.id)).toEqual([]);
  });

  it("is empty for an employee with no account, and respects the limit", async () => {
    const w = await world();
    const noAccount = await createEmployee(w.company.id);
    expect(await getEmployeeActivity(w.boss, noAccount.id)).toEqual([]);
    for (let i = 0; i < 4; i++) await w.log("updated");
    expect(await getEmployeeActivity(w.boss, w.person.id, 3)).toHaveLength(3);
  });

  it("does not cross companies", async () => {
    const w = await world();
    const other = await world();
    await expect(getEmployeeActivity(other.boss, w.person.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
