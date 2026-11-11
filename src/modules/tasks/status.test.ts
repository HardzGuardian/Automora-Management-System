import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { taskActivityLogs, tasks } from "@/db/schema";
import { resetNotifier, setNotifier, type NotifyEvent } from "@/lib/notify";
import { buildActor } from "@/test/factories";
import { workWorld } from "@/test/work";
import { createTask } from "./service";
import { changeTaskStatus } from "./status";

afterEach(() => resetNotifier());

const row = async (id: string) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
const logs = async (id: string) => db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, id));

describe("manager transitions", () => {
  it("walks Pending → In Progress → In Review → Completed, recording completion", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    for (const s of ["In Progress", "In Review", "Completed"] as const) {
      expect((await changeTaskStatus(w.manager, t.id, s)).status).toBe(s);
    }
    const r = await row(t.id);
    expect(r.completedAt).toBeInstanceOf(Date);
    expect(r.completedBy).toBe(w.managerUserId);
    const l = (await logs(t.id)).filter((x) => x.action === "status_changed");
    expect(l.map((x) => x.newValue)).toEqual([{ status: "In Progress" }, { status: "In Review" }, { status: "Completed" }]);
    expect(l[0].oldValue).toEqual({ status: "Pending" });
  });

  it("reopening clears completion and logs a reopened event", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    for (const s of ["In Progress", "In Review", "Completed", "In Progress"] as const) await changeTaskStatus(w.manager, t.id, s);
    const r = await row(t.id);
    expect(r.completedAt).toBeNull();
    expect(r.completedBy).toBeNull();
    expect((await logs(t.id)).map((x) => x.action)).toContain("reopened");
  });

  it("rejects invalid transitions as CONFLICT", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    await expect(changeTaskStatus(w.manager, t.id, "Completed")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changeTaskStatus(w.manager, t.id, "In Review")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changeTaskStatus(w.manager, t.id, "Pending")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changeTaskStatus(w.manager, t.id, "Blocked" as never)).rejects.toThrow();
  });

  it("lets exactly one of two concurrent identical transitions win", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    const results = await Promise.allSettled([
      changeTaskStatus(w.manager, t.id, "In Progress"),
      changeTaskStatus(w.manager, t.id, "In Progress"),
      changeTaskStatus(w.manager, t.id, "In Progress"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(failures).toHaveLength(2);
    expect(failures.every((f) => (f.reason as { code: string }).code === "CONFLICT")).toBe(true);
    expect((await logs(t.id)).filter((x) => x.action === "status_changed")).toHaveLength(1);
  });
});

describe("assignee (own) transitions", () => {
  it("lets an assignee move their task between Pending / In Progress / In Review", async () => {
    const w = await workWorld();
    const e = await w.employee();
    const t = await createTask(w.manager, { title: "x", assigneeIds: [e.employeeId] });
    expect((await changeTaskStatus(e.actor, t.id, "In Progress")).status).toBe("In Progress");
    expect((await changeTaskStatus(e.actor, t.id, "In Review")).status).toBe("In Review");
    expect((await changeTaskStatus(e.actor, t.id, "In Progress")).status).toBe("In Progress");
  });

  it("does not let an assignee complete or reopen", async () => {
    const w = await workWorld();
    const e = await w.employee();
    const t = await createTask(w.manager, { title: "x", assigneeIds: [e.employeeId] });
    await changeTaskStatus(e.actor, t.id, "In Progress");
    await changeTaskStatus(e.actor, t.id, "In Review");
    await expect(changeTaskStatus(e.actor, t.id, "Completed")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await changeTaskStatus(w.manager, t.id, "Completed");
    await expect(changeTaskStatus(e.actor, t.id, "In Progress")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let a project member who is not assigned change status, nor an outsider see it", async () => {
    const w = await workWorld();
    const assignee = await w.employee();
    const member = await w.employee();
    const outsider = await w.employee();
    const p = await w.project({ members: [member.employeeId] });
    const t = await createTask(w.manager, { title: "x", projectId: p.id, assigneeIds: [assignee.employeeId] });
    await expect(changeTaskStatus(member.actor, t.id, "In Progress")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeTaskStatus(outsider.actor, t.id, "In Progress")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("denies users with no status permission, and other companies", async () => {
    const w = await workWorld();
    const other = await workWorld();
    const none = await w.employee(["tasks.comment"]);
    const t = await createTask(w.manager, { title: "x", assigneeIds: [none.employeeId] });
    await expect(changeTaskStatus(none.actor, t.id, "In Progress")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeTaskStatus(other.manager, t.id, "In Progress")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeTaskStatus(buildActor({ companyId: w.company.id }), t.id, "In Progress")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("notifications", () => {
  it("notifies the creator when work reaches In Review and Completed, not when the creator does it", async () => {
    const w = await workWorld();
    const e = await w.employee();
    const t = await createTask(w.manager, { title: "x", assigneeIds: [e.employeeId] });
    const events: NotifyEvent[] = [];
    setNotifier(async (ev) => void events.push(ev));
    await changeTaskStatus(e.actor, t.id, "In Progress");
    await changeTaskStatus(e.actor, t.id, "In Review");
    await changeTaskStatus(w.manager, t.id, "Completed"); // creator completes: no self-notification
    expect(events.map((x) => x.type)).toEqual(["task.review"]);
    expect(events[0].userIds).toEqual([w.managerUserId]);
  });
});
