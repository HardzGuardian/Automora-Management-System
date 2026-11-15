import { describe, expect, it } from "vitest";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { listTasks } from "./queries";
import { archiveTask, createTask, unarchiveTask } from "./service";

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
