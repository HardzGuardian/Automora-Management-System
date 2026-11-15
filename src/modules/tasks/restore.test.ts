import { describe, expect, it } from "vitest";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { listTasks } from "./queries";
import { archiveTask, createTask, getTask, logActualHours, unarchiveTask } from "./service";

describe("archive and restore", () => {
  it("restores an archived task, shows it only in the archived view, and needs tasks.archive", async () => {
    const w = await workWorld([...MANAGER_KEYS]);
    const t = await createTask(w.manager, { title: "Old work" });
    await archiveTask(w.manager, t.id);
    expect((await listTasks(w.manager, { view: "all" })).total).toBe(0);
    expect((await listTasks(w.manager, { view: "all", archivedOnly: true })).rows.map((r) => r.title)).toEqual(["Old work"]);

    const e = await w.employee();
    await expect(unarchiveTask(e.actor, t.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await unarchiveTask(w.manager, t.id);
    expect((await listTasks(w.manager, { view: "all" })).rows.map((r) => r.title)).toEqual(["Old work"]);
    expect((await listTasks(w.manager, { view: "all", archivedOnly: true })).total).toBe(0);
    await expect(unarchiveTask(w.manager, t.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("logActualHours", () => {
  it("lets the assignee log a running total on their own task, but nobody else's, and checks the number", async () => {
    const w = await workWorld([...MANAGER_KEYS]);
    const mine = await w.employee();
    const other = await w.employee();
    const t = await createTask(w.manager, { title: "Do it", assigneeIds: [mine.employeeId] });
    await logActualHours(mine.actor, t.id, "2.5");
    expect((await getTask(w.manager, t.id)).actualHours).toBe("2.50");
    await logActualHours(mine.actor, t.id, "4");
    expect((await getTask(w.manager, t.id)).actualHours).toBe("4.00");
    await expect(logActualHours(other.actor, t.id, "1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(logActualHours(mine.actor, t.id, "abc")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(logActualHours(mine.actor, t.id, "-1")).rejects.toMatchObject({ code: "VALIDATION" });
    await logActualHours(w.manager, t.id, "9"); // managers can set it on any task
    expect((await getTask(w.manager, t.id)).actualHours).toBe("9.00");
  });
});
