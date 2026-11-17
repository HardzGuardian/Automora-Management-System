import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { createCompany, createTask } from "@/test/factories";
import { tasks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { dueTodayCondition, isOverdue, overdueCondition, upcomingCondition, todayInTz } from "./index";

describe("isOverdue (pure)", () => {
  const today = "2026-03-10";
  it.each([
    [{ dueDate: "2026-03-09", status: "Pending", archivedAt: null }, true],
    [{ dueDate: "2026-03-10", status: "Pending", archivedAt: null }, false], // due today is not overdue
    [{ dueDate: "2026-03-11", status: "In Progress", archivedAt: null }, false],
    [{ dueDate: "2026-03-01", status: "Completed", archivedAt: null }, false], // completed never overdue
    [{ dueDate: "2026-03-01", status: "In Review", archivedAt: null }, true],
    [{ dueDate: "2026-03-01", status: "Pending", archivedAt: new Date() }, false], // archived excluded
    [{ dueDate: null, status: "Pending", archivedAt: null }, false], // no due date
  ])("%j -> %s", (t, expected) => {
    expect(isOverdue(t, today)).toBe(expected);
  });

  it("uses company-local today at the timezone boundary", () => {
    const instant = new Date("2026-03-10T20:00:00Z"); // Mar 11 in Kolkata, Mar 10 in New York
    const task = { dueDate: "2026-03-10", status: "Pending", archivedAt: null };
    expect(isOverdue(task, todayInTz("Asia/Kolkata", instant))).toBe(true);
    expect(isOverdue(task, todayInTz("America/New_York", instant))).toBe(false);
  });
});

describe("SQL conditions agree with isOverdue", () => {
  it("overdue / dueToday / upcoming select the right tasks", async () => {
    const c = await createCompany();
    const today = "2026-03-10";
    const mk = (title: string, o: Partial<typeof tasks.$inferInsert>) => createTask(c.id, { title, ...o });
    await mk("late", { dueDate: "2026-03-09", status: "Pending" });
    await mk("today", { dueDate: "2026-03-10", status: "In Progress" });
    await mk("soon", { dueDate: "2026-03-12", status: "Pending" });
    await mk("far", { dueDate: "2026-04-30", status: "Pending" });
    await mk("done-late", { dueDate: "2026-03-01", status: "Completed", completedAt: new Date() });
    await mk("none", { status: "Pending" });
    const arch = await mk("arch-late", { dueDate: "2026-03-01", status: "Pending" });
    await db.execute(sql`UPDATE tasks SET archived_at = now() WHERE id = ${arch.id}`);

    const titles = async (cond: ReturnType<typeof overdueCondition>) =>
      (await db.select({ t: tasks.title }).from(tasks).where(and(eq(tasks.companyId, c.id), cond))).map((r) => r.t).sort();

    expect(await titles(overdueCondition(today))).toEqual(["late"]);
    expect(await titles(dueTodayCondition(today))).toEqual(["today"]);
    expect(await titles(upcomingCondition(today, 3))).toEqual(["soon", "today"]);
    expect(await titles(upcomingCondition(today, 60))).toEqual(["far", "soon", "today"]);
  });
});
