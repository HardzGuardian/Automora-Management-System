import { describe, expect, it } from "vitest";
import { workWorld } from "@/test/work";
import { buildMonthGrid, listCalendarTasks, monthBounds, shiftMonth } from "./calendar";
import { archiveTask, createTask } from "./service";

describe("monthBounds / shiftMonth", () => {
  it("returns first and last day, handling leap years", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("rejects malformed months", () => {
    for (const bad of ["2026-13", "2026-00", "26-01", "2026-1", "abc", ""]) expect(() => monthBounds(bad)).toThrow();
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });
});

describe("buildMonthGrid (weeks start Monday)", () => {
  it("covers the month in whole Monday-Sunday weeks", () => {
    const g = buildMonthGrid("2026-02", []); // 1 Feb 2026 is a Sunday
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    expect(g.weeks[0][0].date).toBe("2026-01-26");
    expect(g.weeks[0][6].date).toBe("2026-02-01");
    expect(g.weeks[0][6].inMonth).toBe(true);
    expect(g.weeks[0][0].inMonth).toBe(false);
    expect(g.weeks.at(-1)![6].date).toBe("2026-03-01");
    expect(g.weeks).toHaveLength(5);
  });

  it("needs only 4 weeks when February starts on Monday and has 28 days", () => {
    const g = buildMonthGrid("2027-02", []); // 1 Feb 2027 is a Monday
    expect(g.weeks).toHaveLength(4);
  });

  it("places tasks on their due dates and ignores tasks without one", () => {
    const g = buildMonthGrid("2026-03", [
      { id: "a", dueDate: "2026-03-10" },
      { id: "b", dueDate: "2026-03-10" },
      { id: "c", dueDate: "2026-03-31" },
      { id: "d", dueDate: null },
      { id: "e", dueDate: "2026-04-15" }, // outside the grid
    ]);
    const cells = g.weeks.flat();
    expect(cells.find((c) => c.date === "2026-03-10")!.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(cells.find((c) => c.date === "2026-03-31")!.tasks.map((t) => t.id)).toEqual(["c"]);
    expect(cells.flatMap((c) => c.tasks)).toHaveLength(3);
  });
});

describe("listCalendarTasks", () => {
  it("returns only tasks due in the month, within the actor's scope, excluding archived", async () => {
    const w = await workWorld();
    const e = await w.employee();
    await createTask(w.manager, { title: "in month", dueDate: "2026-03-15", assigneeIds: [e.employeeId] });
    await createTask(w.manager, { title: "other month", dueDate: "2026-04-01", assigneeIds: [e.employeeId] });
    await createTask(w.manager, { title: "no due date", assigneeIds: [e.employeeId] });
    await createTask(w.manager, { title: "not mine", dueDate: "2026-03-20" });
    const arch = await createTask(w.manager, { title: "archived", dueDate: "2026-03-05", assigneeIds: [e.employeeId] });
    await archiveTask(w.manager, arch.id);

    const mine = await listCalendarTasks(e.actor, { month: "2026-03", view: "mine" });
    expect(mine.map((t) => t.title)).toEqual(["in month"]);
    const all = await listCalendarTasks(w.manager, { month: "2026-03", view: "all" });
    expect(all.map((t) => t.title).sort()).toEqual(["in month", "not mine"]);
    expect((await listCalendarTasks(e.actor, { month: "2026-03", view: "all" })).map((t) => t.title)).toEqual(["in month"]);
  });

  it("pages through months with more than 100 tasks", async () => {
    const w = await workWorld();
    await Promise.all(Array.from({ length: 105 }, (_, i) => createTask(w.manager, { title: `T${i}`, dueDate: "2026-06-10" })));
    expect((await listCalendarTasks(w.manager, { month: "2026-06", view: "all" })).length).toBe(105);
  });
});
