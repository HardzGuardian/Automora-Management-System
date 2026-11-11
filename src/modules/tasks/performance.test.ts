import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { getWorkload } from "@/modules/employees";
import { workWorld } from "@/test/work";
import { listCalendarTasks } from "./calendar";
import { listTasks } from "./queries";

// D1-31: dashboard-critical queries stay fast at ~10k tasks. Bounds are deliberately generous
// (CI machines vary); on a developer machine each is a few milliseconds (see EXPLAIN notes in docs).
const N = 10_000;
const BOUND_MS = 750;

let w: Awaited<ReturnType<typeof workWorld>>;
let worker: Awaited<ReturnType<Awaited<ReturnType<typeof workWorld>>["employee"]>>;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
}

beforeAll(async () => {
  w = await workWorld();
  worker = await w.employee();
  await db.execute(sql`
    INSERT INTO tasks (company_id, task_code, title, priority, status, due_date, completed_at)
    SELECT ${w.company.id}, 'PERF-' || lpad(g::text, 6, '0'), 'Perf task ' || g,
           (ARRAY['Low','Medium','High','Urgent'])[1 + g % 4],
           (ARRAY['Pending','In Progress','In Review','Completed'])[1 + (g / 4) % 4],
           date '2026-01-01' + (g % 200),
           CASE WHEN (g / 4) % 4 = 3 THEN now() END
    FROM generate_series(1, ${N}) g`);
  await db.execute(sql`
    INSERT INTO task_assignees (task_id, company_id, employee_id)
    SELECT id, company_id, ${worker.employeeId}::uuid FROM tasks
    WHERE company_id = ${w.company.id} AND (substr(task_code, 6)::int % 10) = 0`);
  await db.execute(sql`ANALYZE tasks`);
  await db.execute(sql`ANALYZE task_assignees`);
}, 60_000);

describe("query performance at ~10k tasks", () => {
  it("all-tasks list (default sort) returns a page quickly with the right total", async () => {
    const { value, ms } = await timed(() => listTasks(w.manager, { view: "all", pageSize: 25 }));
    expect(value.total).toBe(N);
    expect(value.rows).toHaveLength(25);
    expect(ms).toBeLessThan(BOUND_MS);
  });

  it("filters, search and priority sort stay fast", async () => {
    const a = await timed(() => listTasks(w.manager, { view: "all", status: ["Pending"], priority: ["Urgent", "High"], sort: "priority" }));
    expect(a.ms).toBeLessThan(BOUND_MS);
    const b = await timed(() => listTasks(w.manager, { view: "all", search: "Perf task 77" }));
    expect(b.value.total).toBeGreaterThan(0);
    expect(b.ms).toBeLessThan(BOUND_MS);
  });

  it("overdue filter agrees with the shared predicate and is fast", async () => {
    const { value, ms } = await timed(() => listTasks(w.manager, { view: "all", overdue: true, pageSize: 100 }));
    expect(value.total).toBeGreaterThan(0);
    expect(value.rows.every((t) => t.status !== "Completed" && t.dueDate !== null)).toBe(true);
    expect(ms).toBeLessThan(BOUND_MS);
  });

  it("an assignee's My Tasks and workload are fast and consistent", async () => {
    const mine = await timed(() => listTasks(worker.actor, { view: "mine", pageSize: 100 }));
    expect(mine.value.total).toBe(N / 10);
    expect(mine.ms).toBeLessThan(BOUND_MS);
    const wl = await timed(() => getWorkload(worker.actor));
    expect(wl.value.open + wl.value.completedInPeriod).toBeLessThanOrEqual(N / 10);
    expect(wl.value.open).toBeGreaterThan(0);
    expect(wl.ms).toBeLessThan(BOUND_MS);
  });

  it("a month of the calendar loads fast", async () => {
    const { value, ms } = await timed(() => listCalendarTasks(w.manager, { month: "2026-03", view: "all" }));
    expect(value.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(BOUND_MS * 2);
  });
});
