import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { taskActivityLogs, taskAssignees, tasks } from "@/db/schema";
import { resetNotifier, setNotifier, type NotifyEvent } from "@/lib/notify";
import { buildActor } from "@/test/factories";
import { workWorld } from "@/test/work";
import { archiveTask, createTask, getTask, updateTask } from "./service";

afterEach(() => resetNotifier());

const activity = (taskId: string) => db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, taskId));

describe("createTask", () => {
  it("requires tasks.create", async () => {
    const w = await workWorld();
    const e = await w.employee();
    await expect(createTask(e.actor, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates with defaults, a TSK code and a created activity entry", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "  Write spec  ", description: "Plain text" });
    expect(t).toMatchObject({ taskCode: "TSK-000001", title: "Write spec", priority: "Medium", status: "Pending", assignees: [], archived: false });
    expect((await activity(t.id)).map((a) => a.action)).toEqual(["created"]);
  });

  it("assigns several employees at creation and notifies the ones with accounts after commit", async () => {
    const w = await workWorld();
    const a = await w.employee();
    const noAccount = await w.bareEmployee();
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));
    const t = await createTask(w.manager, { title: "Team task", assigneeIds: [a.employeeId, noAccount.id] });
    expect(t.assignees.map((x) => x.employeeId).sort()).toEqual([a.employeeId, noAccount.id].sort());
    const rows = await db.select().from(taskAssignees).where(eq(taskAssignees.taskId, t.id));
    expect(rows.every((r) => r.assignedBy === w.managerUserId)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "task.assigned", userIds: [a.userId], entity: { type: "task", id: t.id } });
    expect(events[0].eventKey).toContain(`task:${t.id}:assigned:${a.employeeId}:`);
  });

  it("rolls back the whole task when an assignee is not assignable", async () => {
    const w = await workWorld();
    const inactive = await w.bareEmployee({ employmentStatus: "Inactive" });
    await expect(createTask(w.manager, { title: "Doomed", assigneeIds: [inactive.id] })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.select().from(tasks).where(eq(tasks.title, "Doomed"))).toHaveLength(0);
  });

  it("does not notify when creation fails", async () => {
    const w = await workWorld();
    const inactive = await w.bareEmployee({ employmentStatus: "Suspended" });
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));
    await expect(createTask(w.manager, { title: "x", assigneeIds: [inactive.id] })).rejects.toThrow();
    expect(events).toHaveLength(0);
  });

  it("validates title, dates, hours and priority", async () => {
    const w = await workWorld();
    await expect(createTask(w.manager, { title: "" })).rejects.toThrow();
    await expect(createTask(w.manager, { title: "x", startDate: "2026-02-01", dueDate: "2026-01-01" })).rejects.toThrow();
    await expect(createTask(w.manager, { title: "x", estimatedHours: "-1" })).rejects.toThrow();
    await expect(createTask(w.manager, { title: "x", estimatedHours: "1.234" })).rejects.toThrow();
    await expect(createTask(w.manager, { title: "x", priority: "Critical" as never })).rejects.toThrow();
    expect((await createTask(w.manager, { title: "ok", estimatedHours: "12.5", priority: "Urgent" })).estimatedHours).toBe("12.50");
  });

  it("defaults the client from the project and rejects a mismatched client", async () => {
    const w = await workWorld();
    const c1 = await w.client();
    const c2 = await w.client();
    const p = await w.project({ clientId: c1.id });
    expect((await createTask(w.manager, { title: "a", projectId: p.id })).clientId).toBe(c1.id);
    expect((await createTask(w.manager, { title: "b", projectId: p.id, clientId: c1.id })).clientId).toBe(c1.id);
    await expect(createTask(w.manager, { title: "c", projectId: p.id, clientId: c2.id })).rejects.toMatchObject({ code: "VALIDATION" });
    const internal = await w.project();
    await expect(createTask(w.manager, { title: "d", projectId: internal.id, clientId: c1.id })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await createTask(w.manager, { title: "e", clientId: c2.id })).clientId).toBe(c2.id);
  });

  it("rejects archived projects and foreign projects/clients", async () => {
    const w = await workWorld();
    const other = await workWorld();
    const p = await w.project();
    await db.execute((await import("drizzle-orm")).sql`UPDATE projects SET archived_at = now(), status = 'Archived' WHERE id = ${p.id}`);
    await expect(createTask(w.manager, { title: "x", projectId: p.id })).rejects.toMatchObject({ code: "VALIDATION" });
    const foreignProject = await other.project();
    const foreignClient = await other.client();
    await expect(createTask(w.manager, { title: "x", projectId: foreignProject.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createTask(w.manager, { title: "x", clientId: foreignClient.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("gives 12 concurrent creations distinct codes", async () => {
    const w = await workWorld();
    const all = await Promise.all(Array.from({ length: 12 }, (_, i) => createTask(w.manager, { title: `T${i}` })));
    expect(new Set(all.map((t) => t.taskCode)).size).toBe(12);
  });
});

describe("updateTask", () => {
  it("updates fields and logs old/new for changed fields only", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "Old", priority: "Low" });
    const u = await updateTask(w.manager, t.id, { title: "New", priority: "High", dueDate: "2026-12-31" });
    expect(u).toMatchObject({ title: "New", priority: "High", dueDate: "2026-12-31" });
    const log = (await activity(t.id)).find((a) => a.action === "updated");
    expect(log?.oldValue).toEqual({ title: "Old", priority: "Low", dueDate: null });
    expect(log?.newValue).toEqual({ title: "New", priority: "High", dueDate: "2026-12-31" });
  });

  it("writes no activity entry when nothing changed", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "Same" });
    await updateTask(w.manager, t.id, { title: "Same" });
    expect((await activity(t.id)).map((a) => a.action)).toEqual(["created"]);
  });

  it("re-checks client/project consistency and merged dates", async () => {
    const w = await workWorld();
    const c1 = await w.client();
    const c2 = await w.client();
    const p1 = await w.project({ clientId: c1.id });
    const p2 = await w.project({ clientId: c2.id });
    const t = await createTask(w.manager, { title: "x", projectId: p1.id, startDate: "2026-03-01", dueDate: "2026-04-01" });
    await expect(updateTask(w.manager, t.id, { clientId: c2.id })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateTask(w.manager, t.id, { dueDate: "2026-02-01" })).rejects.toMatchObject({ code: "VALIDATION" });
    const moved = await updateTask(w.manager, t.id, { projectId: p2.id, clientId: c2.id });
    expect(moved).toMatchObject({ projectId: p2.id, clientId: c2.id });
    await expect(updateTask(w.manager, t.id, { projectId: p2.id, clientId: c1.id })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires tasks.update, hides out-of-scope tasks and other companies", async () => {
    const w = await workWorld();
    const other = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    const e = await w.employee();
    await expect(updateTask(e.actor, t.id, { title: "y" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateTask(other.manager, t.id, { title: "y" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const limited = await workWorld(["tasks.update"]); // can update but sees nothing (no read.all, no employee tasks)
    const lt = await createTask((await workWorld()).manager, { title: "z" });
    await expect(updateTask(limited.manager, lt.id, { title: "y" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getTask / archiveTask", () => {
  it("lets an assignee see their task but not an unrelated one", async () => {
    const w = await workWorld();
    const e = await w.employee();
    const mine = await createTask(w.manager, { title: "mine", assigneeIds: [e.employeeId] });
    const other = await createTask(w.manager, { title: "other" });
    expect((await getTask(e.actor, mine.id)).assignees[0].employeeId).toBe(e.employeeId);
    await expect(getTask(e.actor, other.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getTask(buildActor({ companyId: w.company.id }), mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets a project member see the project's tasks", async () => {
    const w = await workWorld();
    const e = await w.employee();
    const p = await w.project({ members: [e.employeeId] });
    const t = await createTask(w.manager, { title: "in project", projectId: p.id });
    expect((await getTask(e.actor, t.id)).id).toBe(t.id);
  });

  it("archives (not deletes), logs it, and needs tasks.archive", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    const e = await w.employee();
    await expect(archiveTask(e.actor, t.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const a = await archiveTask(w.manager, t.id);
    expect(a.archived).toBe(true);
    expect((await activity(t.id)).map((x) => x.action)).toContain("archived");
    expect(await db.select().from(tasks).where(eq(tasks.id, t.id))).toHaveLength(1);
    await expect(archiveTask(w.manager, t.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
