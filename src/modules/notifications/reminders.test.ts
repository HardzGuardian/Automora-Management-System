import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { companies, notifications, tasks } from "@/db/schema";
import { addDays, todayInTz } from "@/lib/dates";
import { resetNotifier } from "@/lib/notify";
import { archiveTask, createTask } from "@/modules/tasks";
import { workWorld } from "@/test/work";
import { registerNotifier } from "./service";
import { runReminders } from "./reminders";

afterEach(() => resetNotifier());

async function setup() {
  registerNotifier();
  const w = await workWorld();
  const a = await w.employee();
  const b = await w.employee();
  const today = todayInTz(w.manager.timezone);
  const d = (n: number) => addDays(today, n);
  const t = {
    overdue: await createTask(w.manager, { title: "Overdue one", dueDate: d(-2), assigneeIds: [a.employeeId] }),
    dueToday: await createTask(w.manager, { title: "Due today", dueDate: d(0), assigneeIds: [a.employeeId, b.employeeId] }),
    dueSoon: await createTask(w.manager, { title: "Due in 2 days", dueDate: d(2), assigneeIds: [b.employeeId] }),
    far: await createTask(w.manager, { title: "Far away", dueDate: d(10), assigneeIds: [a.employeeId] }),
    noDate: await createTask(w.manager, { title: "No date", assigneeIds: [a.employeeId] }),
    nobody: await createTask(w.manager, { title: "Unassigned overdue", dueDate: d(-1) }),
    done: await createTask(w.manager, { title: "Done and late", dueDate: d(-3), assigneeIds: [a.employeeId] }),
    archived: await createTask(w.manager, { title: "Archived late", dueDate: d(-3), assigneeIds: [a.employeeId] }),
  };
  await db.update(tasks).set({ status: "Completed", completedAt: new Date() }).where(eq(tasks.id, t.done.id));
  await archiveTask(w.manager, t.archived.id);
  return { w, a, b, t, today, d };
}

// Only reminder notifications (assignment notices are created by the live notifier and are not under test here).
const isReminder = (type: string) => /\.(due_soon|overdue|due)$/.test(type);
const titlesFor = async (userId: string) =>
  (await db.select().from(notifications).where(eq(notifications.userId, userId))).filter((n) => isReminder(n.type)).map((n) => n.title).sort();

describe("task reminders", () => {
  it("notifies assignees about overdue and due-soon tasks only", async () => {
    const s = await setup();
    const result = await runReminders({ companyId: s.w.company.id });
    expect(result.failures).toEqual([]);
    const forA = await titlesFor(s.a.userId);
    expect(forA.some((t) => t.includes("Overdue one"))).toBe(true);
    expect(forA.some((t) => t.includes("Due today"))).toBe(true);
    expect(forA.join("|")).not.toMatch(/Far away|No date|Done and late|Archived late|Unassigned/);
    const forB = await titlesFor(s.b.userId);
    expect(forB.some((t) => t.includes("Due in 2 days"))).toBe(true);
    expect(forB.some((t) => t.includes("Due today"))).toBe(true);
  });

  it("running twice (or concurrently) creates no duplicates", async () => {
    const s = await setup();
    await runReminders({ companyId: s.w.company.id });
    const first = (await titlesFor(s.a.userId)).length;
    await runReminders({ companyId: s.w.company.id });
    await Promise.all([runReminders({ companyId: s.w.company.id }), runReminders({ companyId: s.w.company.id })]);
    expect((await titlesFor(s.a.userId)).length).toBe(first);
  });

  it("the next day repeats the overdue reminder but not the due-soon one", async () => {
    const s = await setup();
    await runReminders({ companyId: s.w.company.id });
    const day1 = (await db.select().from(notifications).where(eq(notifications.userId, s.a.userId))).filter((n) => isReminder(n.type));
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    await runReminders({ companyId: s.w.company.id, now: tomorrow });
    const day2 = (await db.select().from(notifications).where(eq(notifications.userId, s.a.userId))).filter((n) => isReminder(n.type));
    const added = day2.filter((n) => !day1.some((o) => o.id === n.id)).map((n) => n.title);
    expect(added.some((t) => t.includes("Overdue one"))).toBe(true); // overdue is a daily nudge
    expect(added.some((t) => t.includes("Due today"))).toBe(true); // it became overdue
    // the earlier "due soon" notice for the same task/date is not repeated
    expect(day2.filter((n) => n.title.includes("Due today") && n.type === "task.due_soon")).toHaveLength(1);
  });

  it("uses each company's own timezone for 'today'", async () => {
    registerNotifier();
    const w = await workWorld();
    const e = await w.employee();
    const pago = todayInTz("Pacific/Pago_Pago");
    await createTask(w.manager, { title: "TZ task", dueDate: pago, assigneeIds: [e.employeeId] });

    await db.update(companies).set({ timezone: "Pacific/Pago_Pago" }).where(eq(companies.id, w.company.id));
    await runReminders({ companyId: w.company.id });
    expect((await titlesFor(e.userId)).some((t) => t.includes("TZ task") && !t.toLowerCase().includes("overdue"))).toBe(true);
    expect((await titlesFor(e.userId)).some((t) => t.toLowerCase().includes("overdue"))).toBe(false);
  });
});

describe("failure isolation", () => {
  it("a failing company does not stop the others, and is reported", async () => {
    registerNotifier();
    const good = await setup();
    const bad = await setup();
    const result = await runReminders({
      onCompany: async (id) => {
        if (id === bad.w.company.id) throw new Error("boom");
      },
    });
    expect(result.failures.map((f) => f.companyId)).toContain(bad.w.company.id);
    expect(result.failures.every((f) => f.companyId !== good.w.company.id)).toBe(true);
    expect((await titlesFor(good.a.userId)).length).toBeGreaterThan(0);
    // the failed company is picked up by the next run (nothing was lost, keys are stable)
    await runReminders({ companyId: bad.w.company.id });
    expect((await titlesFor(bad.a.userId)).length).toBeGreaterThan(0);
  });
});
