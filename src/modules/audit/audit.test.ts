import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, withTransaction } from "@/db";
import { activityLogs, taskActivityLogs } from "@/db/schema";
import { buildActor, createCompany, createTask, createUser } from "@/test/factories";
import { audit, redact } from "./index";

describe("redact", () => {
  it("strips password/token/secret/hash/credential keys recursively", () => {
    expect(
      redact({
        name: "x",
        password: "p",
        nested: { apiToken: "t", ok: 1, list: [{ clientSecret: "s", keep: true }] },
        passwordHash: "h",
        credentials: "c",
      }),
    ).toEqual({ name: "x", nested: { ok: 1, list: [{ keep: true }] } });
  });

  it("passes through primitives and null", () => {
    expect(redact(null)).toBeNull();
    expect(redact(5)).toBe(5);
  });
});

describe("audit.record", () => {
  it("stores a redacted before/after in the same transaction", async () => {
    const c = await createCompany();
    const u = await createUser(c.id);
    const actor = buildActor({ companyId: c.id, userId: u.id });
    await withTransaction((tx) =>
      audit.record(tx, {
        actor,
        entity: "user",
        entityId: "e1",
        action: "user.updated",
        before: { name: "a", password: "old" },
        after: { name: "b", token: "new" },
      }),
    );
    const [row] = await db.select().from(activityLogs).where(eq(activityLogs.companyId, c.id));
    expect(row).toMatchObject({ actorId: u.id, entity: "user", entityId: "e1", action: "user.updated" });
    expect(row.before).toEqual({ name: "a" });
    expect(row.after).toEqual({ name: "b" });
  });

  it("rolls back with the surrounding transaction", async () => {
    const c = await createCompany();
    const u = await createUser(c.id);
    const actor = buildActor({ companyId: c.id, userId: u.id });
    await expect(
      withTransaction(async (tx) => {
        await audit.record(tx, { actor, entity: "x", entityId: "1", action: "x.created" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await db.select().from(activityLogs).where(eq(activityLogs.companyId, c.id));
    expect(rows).toHaveLength(0);
  });
});

describe("append-only guard", () => {
  it("rejects UPDATE and DELETE on activity_logs", async () => {
    const c = await createCompany();
    const u = await createUser(c.id);
    await withTransaction((tx) =>
      audit.record(tx, { actor: buildActor({ companyId: c.id, userId: u.id }), entity: "x", entityId: "1", action: "x.created" }),
    );
    await expect(db.execute(sql`UPDATE activity_logs SET action = 'tampered' WHERE company_id = ${c.id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM activity_logs WHERE company_id = ${c.id}`)).rejects.toThrow();
  });

  it("rejects UPDATE and DELETE on task_activity_logs", async () => {
    const c = await createCompany();
    const t = await createTask(c.id);
    await db.insert(taskActivityLogs).values({ companyId: c.id, taskId: t.id, action: "created" });
    await expect(db.execute(sql`UPDATE task_activity_logs SET action = 'tampered' WHERE task_id = ${t.id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM task_activity_logs WHERE task_id = ${t.id}`)).rejects.toThrow();
  });
});
