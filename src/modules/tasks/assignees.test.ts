import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { taskActivityLogs, taskAssignees } from "@/db/schema";
import { resetNotifier, setNotifier, type NotifyEvent } from "@/lib/notify";
import { workWorld } from "@/test/work";
import { assignTask, reassignTask, unassignTask } from "./assignees";
import { createTask } from "./service";

afterEach(() => resetNotifier());

const assignedIds = async (taskId: string) =>
  (await db.select().from(taskAssignees).where(eq(taskAssignees.taskId, taskId))).map((r) => r.employeeId).sort();
const actions = async (taskId: string) =>
  (await db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, taskId))).map((a) => a.action);

describe("assignTask", () => {
  it("assigns several employees, is idempotent, logs and notifies only new assignees", async () => {
    const w = await workWorld();
    const a = await w.employee();
    const b = await w.employee();
    const t = await createTask(w.manager, { title: "x" });
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));

    await assignTask(w.manager, t.id, [a.employeeId, b.employeeId]);
    await assignTask(w.manager, t.id, [a.employeeId]); // already assigned: ignored
    expect(await assignedIds(t.id)).toEqual([a.employeeId, b.employeeId].sort());
    expect(events.map((e) => e.userIds[0]).sort()).toEqual([a.userId, b.userId].sort());
    expect((await actions(t.id)).filter((x) => x === "assigned")).toHaveLength(2);
  });

  it("rejects inactive and foreign employees and archived tasks, changing nothing", async () => {
    const w = await workWorld();
    const other = await workWorld();
    const ok = await w.employee();
    const inactive = await w.bareEmployee({ employmentStatus: "Inactive" });
    const foreign = await other.bareEmployee();
    const t = await createTask(w.manager, { title: "x" });
    await expect(assignTask(w.manager, t.id, [ok.employeeId, inactive.id])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(assignTask(w.manager, t.id, [foreign.id])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await assignedIds(t.id)).toEqual([]);
    const { archiveTask } = await import("./service");
    await archiveTask(w.manager, t.id);
    await expect(assignTask(w.manager, t.id, [ok.employeeId])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires tasks.assign and scope", async () => {
    const w = await workWorld();
    const other = await workWorld();
    const e = await w.employee();
    const t = await createTask(w.manager, { title: "x" });
    await expect(assignTask(e.actor, t.id, [e.employeeId])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assignTask(other.manager, t.id, [e.employeeId])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assignTask(w.manager, t.id, [])).rejects.toThrow();
  });
});

describe("unassignTask / reassignTask", () => {
  it("unassigns and logs; unassigning someone not assigned is NOT_FOUND", async () => {
    const w = await workWorld();
    const a = await w.employee();
    const t = await createTask(w.manager, { title: "x", assigneeIds: [a.employeeId] });
    await unassignTask(w.manager, t.id, a.employeeId);
    expect(await assignedIds(t.id)).toEqual([]);
    expect(await actions(t.id)).toContain("unassigned");
    await expect(unassignTask(w.manager, t.id, a.employeeId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reassigns atomically and notifies the new assignee only", async () => {
    const w = await workWorld();
    const a = await w.employee();
    const b = await w.employee();
    const t = await createTask(w.manager, { title: "x", assigneeIds: [a.employeeId] });
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));
    await reassignTask(w.manager, t.id, a.employeeId, b.employeeId);
    expect(await assignedIds(t.id)).toEqual([b.employeeId]);
    expect(events).toHaveLength(1);
    expect(events[0].userIds).toEqual([b.userId]);
    expect(await actions(t.id)).toContain("reassigned");
  });

  it("leaves the original assignee in place if the new one is not assignable", async () => {
    const w = await workWorld();
    const a = await w.employee();
    const inactive = await w.bareEmployee({ employmentStatus: "Inactive" });
    const t = await createTask(w.manager, { title: "x", assigneeIds: [a.employeeId] });
    await expect(reassignTask(w.manager, t.id, a.employeeId, inactive.id)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await assignedIds(t.id)).toEqual([a.employeeId]);
  });
});
