import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { taskActivityLogs, taskComments } from "@/db/schema";
import { workWorld } from "@/test/work";
import { addComment, deleteComment, editComment, listComments } from "./comments";
import { archiveTask, createTask } from "./service";

const acts = async (taskId: string) =>
  (await db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, taskId))).map((a) => a.action);

async function setup() {
  const w = await workWorld();
  const a = await w.employee();
  const b = await w.employee();
  const outsider = await w.employee();
  const t = await createTask(w.manager, { title: "Discuss", assigneeIds: [a.employeeId, b.employeeId] });
  return { w, a, b, outsider, t };
}

describe("addComment / listComments", () => {
  it("adds trimmed comments and lists them oldest first with author names", async () => {
    const s = await setup();
    await addComment(s.a.actor, s.t.id, "  first  ");
    await addComment(s.b.actor, s.t.id, "second");
    const list = await listComments(s.a.actor, s.t.id);
    expect(list.map((c) => c.body)).toEqual(["first", "second"]);
    expect(list[0].authorId).toBe(s.a.userId);
    expect(typeof list[0].authorName).toBe("string");
    expect(list[0].edited).toBe(false);
  });

  it("logs the activity without copying the comment text", async () => {
    const s = await setup();
    await addComment(s.a.actor, s.t.id, "secret-ish text");
    const logs = await db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, s.t.id));
    expect(logs.map((l) => l.action)).toContain("comment_added");
    expect(JSON.stringify(logs)).not.toContain("secret-ish text");
  });

  it("requires tasks.comment and task visibility", async () => {
    const s = await setup();
    const noPerm = await s.w.employee(["tasks.status.update.own"]);
    const t2 = await createTask(s.w.manager, { title: "x", assigneeIds: [noPerm.employeeId] });
    await expect(addComment(noPerm.actor, t2.id, "hi")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addComment(s.outsider.actor, s.t.id, "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listComments(s.outsider.actor, s.t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await workWorld();
    await expect(addComment(other.manager, s.t.id, "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates length and rejects comments on archived tasks", async () => {
    const s = await setup();
    await expect(addComment(s.a.actor, s.t.id, "   ")).rejects.toThrow();
    await expect(addComment(s.a.actor, s.t.id, "x".repeat(4001))).rejects.toThrow();
    await archiveTask(s.w.manager, s.t.id);
    await expect(addComment(s.a.actor, s.t.id, "late")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("editComment", () => {
  it("lets the author edit and marks it edited; others cannot", async () => {
    const s = await setup();
    const c = await addComment(s.a.actor, s.t.id, "orig");
    await new Promise((r) => setTimeout(r, 1100));
    const e = await editComment(s.a.actor, c.id, "changed");
    expect(e.body).toBe("changed");
    expect(e.edited).toBe(true);
    await expect(editComment(s.b.actor, c.id, "hijack")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(editComment(s.w.manager, c.id, "hijack")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await acts(s.t.id)).toContain("comment_edited");
  });

  it("hides comments of tasks the editor can no longer see", async () => {
    const s = await setup();
    const c = await addComment(s.a.actor, s.t.id, "orig");
    await expect(editComment(s.outsider.actor, c.id, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(editComment(s.a.actor, "00000000-0000-0000-0000-000000000000", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("deleteComment", () => {
  it("lets the author delete their own; a manager (tasks.update) can moderate; peers cannot", async () => {
    const s = await setup();
    const mine = await addComment(s.a.actor, s.t.id, "mine");
    const theirs = await addComment(s.b.actor, s.t.id, "theirs");
    await expect(deleteComment(s.a.actor, theirs.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteComment(s.a.actor, mine.id);
    await deleteComment(s.w.manager, theirs.id);
    expect(await listComments(s.w.manager, s.t.id)).toEqual([]);
    expect(await acts(s.t.id)).toEqual(expect.arrayContaining(["comment_deleted"]));
  });

  it("soft-deletes (row kept) and a deleted comment can no longer be edited or deleted", async () => {
    const s = await setup();
    const c = await addComment(s.a.actor, s.t.id, "bye");
    await deleteComment(s.a.actor, c.id);
    const [row] = await db.select().from(taskComments).where(eq(taskComments.id, c.id));
    expect(row.deletedAt).not.toBeNull();
    await expect(editComment(s.a.actor, c.id, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteComment(s.a.actor, c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
