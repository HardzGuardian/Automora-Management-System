import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { projectMembers, taskAssignees } from "@/db/schema";
import type { PermissionKey } from "@/lib/permissions";
import { assignProjectToTeam, listProjectTeams, unassignProjectFromTeam } from "@/modules/projects";
import { assignTask, assignTaskToTeam, changeTaskStatus, createTask, getTask, unassignTask, unassignTaskFromTeam } from "@/modules/tasks";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import {
  addTeamMember,
  archiveDepartment,
  archiveTeam,
  createDepartment,
  createTeam,
  departmentNamesForEmployees,
  getOrgChart,
  getTeam,
  listAssignableTeams,
  removeTeamMember,
  setTeamMemberRole,
} from "./index";

const BOSS: PermissionKey[] = [...MANAGER_KEYS, "teams.read", "teams.manage", "projects.members.manage", "projects.create", "employees.read"];

async function org() {
  const w = await workWorld(BOSS);
  const dept = await createDepartment(w.manager, { name: "Software Development" });
  const teamA = await createTeam(w.manager, { departmentId: dept.id, name: "Team A" });
  const teamB = await createTeam(w.manager, { departmentId: dept.id, name: "Team B" });
  return { w, dept, teamA, teamB };
}

const assigneeIds = async (taskId: string) =>
  (await db.select({ id: taskAssignees.employeeId }).from(taskAssignees).where(eq(taskAssignees.taskId, taskId))).map((r) => r.id).sort();

describe("departments and teams", () => {
  it("builds department -> team -> members and shows them in the org chart", async () => {
    const { w, dept, teamA } = await org();
    const lead = await w.employee();
    const member = await w.employee();
    await addTeamMember(w.manager, teamA.id, lead.employeeId, "lead");
    await addTeamMember(w.manager, teamA.id, member.employeeId);
    const chart = await getOrgChart(w.manager);
    const d = chart.find((c) => c.id === dept.id)!;
    expect(d.teams.map((t) => t.name)).toEqual(["Team A", "Team B"]);
    expect(d.teams[0]).toMatchObject({ memberCount: 2 });
    expect(d.teams[0].leads).toHaveLength(1);
    expect((await getTeam(w.manager, teamA.id)).members.map((m) => m.role).sort()).toEqual(["lead", "member"]);
  });

  it("rejects duplicate names, needs teams.manage, and keeps companies apart", async () => {
    const { w, dept } = await org();
    await expect(createDepartment(w.manager, { name: "software development" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createTeam(w.manager, { departmentId: dept.id, name: "TEAM A" })).rejects.toMatchObject({ code: "CONFLICT" });
    const reader = await w.employee(["teams.read"]);
    await expect(createDepartment(reader.actor, { name: "Sales" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = await workWorld(BOSS);
    await expect(getTeam(other.manager, (await getOrgChart(w.manager))[0].teams[0].id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets a person sit on several teams, and stops a department with live teams being archived", async () => {
    const { w, dept, teamA, teamB } = await org();
    const e = await w.employee();
    await addTeamMember(w.manager, teamA.id, e.employeeId);
    await addTeamMember(w.manager, teamB.id, e.employeeId);
    await expect(addTeamMember(w.manager, teamA.id, e.employeeId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(archiveDepartment(w.manager, dept.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("members without teams.read see only their own teams", async () => {
    const { w, teamA } = await org();
    const e = await w.employee();
    await addTeamMember(w.manager, teamA.id, e.employeeId);
    const chart = await getOrgChart(e.actor);
    expect(chart.flatMap((d) => d.teams.map((t) => t.name))).toEqual(["Team A"]);
    const outsider = await w.employee();
    await expect(getTeam(outsider.actor, teamA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("assigning a task to a team", () => {
  it("gives the task to every member, and to people who join later", async () => {
    const { w, teamA } = await org();
    const a = await w.employee();
    const b = await w.employee();
    await addTeamMember(w.manager, teamA.id, a.employeeId);
    await addTeamMember(w.manager, teamA.id, b.employeeId);
    const task = await createTask(w.manager, { title: "Ship it" });
    await assignTaskToTeam(w.manager, task.id, teamA.id);
    expect(await assigneeIds(task.id)).toEqual([a.employeeId, b.employeeId].sort());
    expect((await getTask(a.actor, task.id)).title).toBe("Ship it");

    const late = await w.employee();
    await addTeamMember(w.manager, teamA.id, late.employeeId);
    expect(await assigneeIds(task.id)).toContain(late.employeeId);
    expect((await getTask(late.actor, task.id)).id).toBe(task.id);
  });

  it("takes the task away from a member who leaves, but never from a direct assignee", async () => {
    const { w, teamA } = await org();
    const a = await w.employee();
    const b = await w.employee();
    await addTeamMember(w.manager, teamA.id, a.employeeId);
    await addTeamMember(w.manager, teamA.id, b.employeeId);
    const task = await createTask(w.manager, { title: "Mixed", assigneeIds: [b.employeeId] });
    await assignTaskToTeam(w.manager, task.id, teamA.id);
    await removeTeamMember(w.manager, teamA.id, a.employeeId);
    await removeTeamMember(w.manager, teamA.id, b.employeeId);
    expect(await assigneeIds(task.id)).toEqual([b.employeeId]); // b was assigned directly as well
    await expect(getTask(a.actor, task.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps someone who is still on another assigned team", async () => {
    const { w, teamA, teamB } = await org();
    const e = await w.employee();
    await addTeamMember(w.manager, teamA.id, e.employeeId);
    await addTeamMember(w.manager, teamB.id, e.employeeId);
    const task = await createTask(w.manager, { title: "Both teams" });
    await assignTaskToTeam(w.manager, task.id, teamA.id);
    await assignTaskToTeam(w.manager, task.id, teamB.id);
    await unassignTaskFromTeam(w.manager, task.id, teamA.id);
    expect(await assigneeIds(task.id)).toEqual([e.employeeId]);
    await unassignTaskFromTeam(w.manager, task.id, teamB.id);
    expect(await assigneeIds(task.id)).toEqual([]);
  });

  it("does not hand finished tasks to new members and refuses to unassign a team-sourced person by hand", async () => {
    const { w, teamA } = await org();
    const a = await w.employee();
    await addTeamMember(w.manager, teamA.id, a.employeeId);
    const open = await createTask(w.manager, { title: "Open" });
    const done = await createTask(w.manager, { title: "Done" });
    await assignTaskToTeam(w.manager, open.id, teamA.id);
    await assignTaskToTeam(w.manager, done.id, teamA.id);
    for (const s of ["In Progress", "In Review", "Completed"]) await changeTaskStatus(w.manager, done.id, s);
    const late = await w.employee();
    await addTeamMember(w.manager, teamA.id, late.employeeId);
    expect(await assigneeIds(done.id)).not.toContain(late.employeeId);
    expect(await assigneeIds(open.id)).toContain(late.employeeId);
    await expect(unassignTask(w.manager, open.id, a.employeeId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("skips inactive employees and archived teams", async () => {
    const { w, teamA } = await org();
    const a = await w.employee();
    await addTeamMember(w.manager, teamA.id, a.employeeId);
    const task = await createTask(w.manager, { title: "Archive me" });
    await assignTaskToTeam(w.manager, task.id, teamA.id);
    await archiveTeam(w.manager, teamA.id);
    expect(await assigneeIds(task.id)).toEqual([]);
    await expect(assignTaskToTeam(w.manager, task.id, teamA.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("who may assign to a team", () => {
  it("lets a team lead assign to their own team only", async () => {
    const { w, teamA, teamB } = await org();
    const lead = await w.employee(["tasks.comment"]);
    await addTeamMember(w.manager, teamA.id, lead.employeeId, "lead");
    const task = await createTask(w.manager, { title: "Lead's", assigneeIds: [lead.employeeId] });
    await assignTaskToTeam(lead.actor, task.id, teamA.id);
    await expect(assignTaskToTeam(lead.actor, task.id, teamB.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listAssignableTeams(lead.actor, "tasks.assign")).map((t) => t.label)).toEqual(["Software Development · Team A"]);
  });

  it("refuses an ordinary member, and a lead who cannot see the task", async () => {
    const { w, teamA } = await org();
    const member = await w.employee(["tasks.comment"]);
    await addTeamMember(w.manager, teamA.id, member.employeeId);
    const task = await createTask(w.manager, { title: "Hidden", assigneeIds: [member.employeeId] });
    await expect(assignTaskToTeam(member.actor, task.id, teamA.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const lead = await w.employee(["tasks.comment"]);
    await addTeamMember(w.manager, teamA.id, lead.employeeId, "lead");
    const secret = await createTask(w.manager, { title: "Secret" });
    await expect(assignTaskToTeam(lead.actor, secret.id, teamA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("role changes work and direct assignment still works alongside teams", async () => {
    const { w, teamA } = await org();
    const e = await w.employee();
    await addTeamMember(w.manager, teamA.id, e.employeeId);
    await setTeamMemberRole(w.manager, teamA.id, e.employeeId, "lead");
    expect((await getTeam(w.manager, teamA.id)).members[0].role).toBe("lead");
    const task = await createTask(w.manager, { title: "Direct" });
    await assignTask(w.manager, task.id, [e.employeeId]);
    expect(await assigneeIds(task.id)).toEqual([e.employeeId]);
  });
});

describe("assigning a project to a team", () => {
  it("makes members project members, follows joins and leaves, and never removes the owner", async () => {
    const { w, teamA } = await org();
    const a = await w.employee();
    await addTeamMember(w.manager, teamA.id, a.employeeId);
    const project = await w.project();
    await assignProjectToTeam(w.manager, project.id, teamA.id);
    const rows = () => db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id));
    expect((await rows()).filter((r) => r.viaTeamId === teamA.id).map((r) => r.employeeId)).toEqual([a.employeeId]);
    expect((await listProjectTeams(w.manager, project.id)).map((t) => t.teamName)).toEqual(["Team A"]);

    const late = await w.employee();
    await addTeamMember(w.manager, teamA.id, late.employeeId);
    expect((await rows()).map((r) => r.employeeId)).toContain(late.employeeId);

    await removeTeamMember(w.manager, teamA.id, a.employeeId);
    expect((await rows()).map((r) => r.employeeId)).not.toContain(a.employeeId);

    await unassignProjectFromTeam(w.manager, project.id, teamA.id);
    const left = await rows();
    expect(left.some((r) => r.membershipRole === "owner")).toBe(true);
    expect(left.some((r) => r.viaTeamId)).toBe(false);
    expect(await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.employeeId, late.employeeId)))).toHaveLength(0);
  });
});

describe("departments shown for employees", () => {
  it("derives each employee's department from active teams, sorted and de-duplicated", async () => {
    const { w, teamA, teamB } = await org();
    const design = await createDepartment(w.manager, { name: "Design" });
    const studio = await createTeam(w.manager, { departmentId: design.id, name: "Studio" });
    const both = await w.employee();
    const one = await w.employee();
    const none = await w.employee();
    await addTeamMember(w.manager, teamA.id, both.employeeId);
    await addTeamMember(w.manager, teamB.id, both.employeeId); // same department twice
    await addTeamMember(w.manager, studio.id, both.employeeId);
    await addTeamMember(w.manager, teamA.id, one.employeeId);

    const map = await departmentNamesForEmployees(w.manager, [both.employeeId, one.employeeId, none.employeeId]);
    expect(map.get(both.employeeId)).toEqual(["Design", "Software Development"]);
    expect(map.get(one.employeeId)).toEqual(["Software Development"]);
    expect(map.has(none.employeeId)).toBe(false);
  });

  it("ignores archived teams, other companies and callers without employees.read", async () => {
    const { w, teamA, teamB } = await org();
    const e = await w.employee();
    await addTeamMember(w.manager, teamA.id, e.employeeId);
    await archiveTeam(w.manager, teamA.id);
    await addTeamMember(w.manager, teamB.id, e.employeeId);
    expect((await departmentNamesForEmployees(w.manager, [e.employeeId])).get(e.employeeId)).toEqual(["Software Development"]);
    await archiveTeam(w.manager, teamB.id);
    expect((await departmentNamesForEmployees(w.manager, [e.employeeId])).has(e.employeeId)).toBe(false);

    const other = await workWorld(BOSS);
    expect((await departmentNamesForEmployees(other.manager, [e.employeeId])).size).toBe(0);
    const plain = await w.employee(["teams.read"]);
    await expect(departmentNamesForEmployees(plain.actor, [e.employeeId])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await departmentNamesForEmployees(w.manager, [])).size).toBe(0);
  });
});
