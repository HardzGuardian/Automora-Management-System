import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, taskAssignees, tasks } from "@/db/schema";
import { buildActor } from "@/test/factories";
import { workWorld } from "@/test/work";
import { bulkArchive, bulkChangeStatus, bulkReassign } from "./bulk";
import { createTask } from "./service";

const statusOf = async (id: string) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0].status;

describe("bulkChangeStatus", () => {
  it("requires tasks.bulk even for an otherwise capable user", async () => {
    const w = await workWorld(["tasks.read.all", "tasks.update", "tasks.create"]);
    const t = await createTask(w.manager, { title: "x" });
    await expect(bulkChangeStatus(w.manager, [t.id], "In Progress")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changes many tasks and reports each", async () => {
    const w = await workWorld();
    const [a, b, c] = await Promise.all([1, 2, 3].map((i) => createTask(w.manager, { title: `T${i}` })));
    const r = await bulkChangeStatus(w.manager, [a.id, b.id, c.id], "In Progress");
    expect(r.results.map((x) => x.ok)).toEqual([true, true, true]);
    expect(r.succeeded).toBe(3);
    expect(r.failed).toBe(0);
    expect(await statusOf(b.id)).toBe("In Progress");
  });

  it("reports per-record failures without applying the forbidden or invalid ones", async () => {
    const w = await workWorld();
    const e = await w.employee(); // has status.update.own only (+ bulk below)
    const bulkEmployee = await (async () => {
      const x = await w.employee(["tasks.status.update.own", "tasks.bulk"]);
      return x;
    })();
    const mine = await createTask(w.manager, { title: "mine", assigneeIds: [bulkEmployee.employeeId] });
    const notMine = await createTask(w.manager, { title: "visible but not mine", assigneeIds: [e.employeeId] });
    const invisible = await createTask(w.manager, { title: "invisible" });
    // project membership makes "notMine"-style tasks visible without assignment
    const p = await w.project({ members: [bulkEmployee.employeeId] });
    const memberOnly = await createTask(w.manager, { title: "member only", projectId: p.id });
    const alreadyDone = await createTask(w.manager, { title: "wrong state", assigneeIds: [bulkEmployee.employeeId] });
    await db.update(tasks).set({ status: "In Progress" }).where(eq(tasks.id, alreadyDone.id));

    const r = await bulkChangeStatus(bulkEmployee.actor, [mine.id, notMine.id, invisible.id, memberOnly.id, alreadyDone.id], "In Progress");
    const byId = new Map(r.results.map((x) => [x.taskId, x]));
    expect(byId.get(mine.id)?.ok).toBe(true);
    expect(byId.get(notMine.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(byId.get(invisible.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(byId.get(memberOnly.id)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(byId.get(alreadyDone.id)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.succeeded).toBe(1);
    expect(r.failed).toBe(4);
    expect(await statusOf(mine.id)).toBe("In Progress");
    expect(await statusOf(memberOnly.id)).toBe("Pending");
    expect(await statusOf(invisible.id)).toBe("Pending");
  });

  it("validates the id list: empty, too many, not uuids; de-duplicates", async () => {
    const w = await workWorld();
    await expect(bulkChangeStatus(w.manager, [], "In Progress")).rejects.toThrow();
    await expect(bulkChangeStatus(w.manager, Array.from({ length: 101 }, () => "00000000-0000-4000-8000-000000000000"), "In Progress")).rejects.toThrow();
    await expect(bulkChangeStatus(w.manager, ["nope"], "In Progress")).rejects.toThrow();
    const t = await createTask(w.manager, { title: "dup" });
    const r = await bulkChangeStatus(w.manager, [t.id, t.id, t.id], "In Progress");
    expect(r.results).toHaveLength(1);
    expect(r.succeeded).toBe(1);
  });

  it("writes one audit summary", async () => {
    const w = await workWorld();
    const t = await createTask(w.manager, { title: "x" });
    await bulkChangeStatus(w.manager, [t.id], "In Progress");
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, w.company.id));
    const bulk = logs.filter((l) => l.action === "tasks.bulk_status");
    expect(bulk).toHaveLength(1);
    expect(bulk[0].after).toMatchObject({ to: "In Progress", succeeded: 1, failed: 0 });
  });
});

describe("bulkReassign / bulkArchive", () => {
  it("moves work from one employee to another where applicable", async () => {
    const w = await workWorld();
    const from = await w.employee();
    const to = await w.employee();
    const other = await w.employee();
    const a = await createTask(w.manager, { title: "a", assigneeIds: [from.employeeId] });
    const b = await createTask(w.manager, { title: "b", assigneeIds: [from.employeeId, other.employeeId] });
    const c = await createTask(w.manager, { title: "c", assigneeIds: [other.employeeId] }); // from is not on this one
    const r = await bulkReassign(w.manager, [a.id, b.id, c.id], from.employeeId, to.employeeId);
    expect(r.succeeded).toBe(2);
    expect(r.results.find((x) => x.taskId === c.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const assigned = async (id: string) => (await db.select().from(taskAssignees).where(eq(taskAssignees.taskId, id))).map((x) => x.employeeId).sort();
    expect(await assigned(a.id)).toEqual([to.employeeId]);
    expect(await assigned(b.id)).toEqual([to.employeeId, other.employeeId].sort());
  });

  it("rejects an inactive target for every record", async () => {
    const w = await workWorld();
    const from = await w.employee();
    const inactive = await w.bareEmployee({ employmentStatus: "Inactive" });
    const a = await createTask(w.manager, { title: "a", assigneeIds: [from.employeeId] });
    const r = await bulkReassign(w.manager, [a.id], from.employeeId, inactive.id);
    expect(r.failed).toBe(1);
    expect(r.results[0]).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("archives many, skipping ones already archived, and needs tasks.archive per record", async () => {
    const w = await workWorld();
    const a = await createTask(w.manager, { title: "a" });
    const b = await createTask(w.manager, { title: "b" });
    const r1 = await bulkArchive(w.manager, [a.id, b.id]);
    expect(r1.succeeded).toBe(2);
    const r2 = await bulkArchive(w.manager, [a.id]);
    expect(r2.results[0]).toMatchObject({ ok: false, error: { code: "CONFLICT" } });

    const noArchive = await workWorld(["tasks.read.all", "tasks.bulk"]);
    const t = await createTask((await workWorld()).manager, { title: "z" });
    const r3 = await bulkArchive(noArchive.manager, [t.id]);
    expect(r3.results[0].ok).toBe(false);
    void buildActor;
  });
});
