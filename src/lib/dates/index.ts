import { sql, type SQL } from "drizzle-orm";
import { tasks } from "@/db/schema";

/** Company-local calendar date (YYYY-MM-DD) for an instant. ADR-06: "today" is never UTC today. */
export function todayInTz(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date (calendar arithmetic, no timezone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type DueFields = { dueDate: string | null; status: string; archivedAt: Date | null };

/**
 * THE overdue predicate (ADR-06): due date strictly before company-local today, task not
 * completed, not archived. Overdue is derived, never stored. Dashboards, reports and
 * notifications must use this (or overdueCondition) and never re-implement it.
 */
export function isOverdue(t: DueFields, today: string): boolean {
  return t.dueDate !== null && t.dueDate < today && t.status !== "Completed" && t.archivedAt === null;
}

/** SQL twin of isOverdue. */
export function overdueCondition(today: string): SQL {
  return sql`(${tasks.dueDate} < ${today}::date AND ${tasks.status} <> 'Completed' AND ${tasks.archivedAt} IS NULL)`;
}

/** Open (not completed, not archived) tasks due exactly today. */
export function dueTodayCondition(today: string): SQL {
  return sql`(${tasks.dueDate} = ${today}::date AND ${tasks.status} <> 'Completed' AND ${tasks.archivedAt} IS NULL)`;
}

/** Open tasks due from today through today + days (inclusive). Overdue tasks are excluded. */
export function upcomingCondition(today: string, days: number): SQL {
  const end = addDays(today, days);
  return sql`(${tasks.dueDate} >= ${today}::date AND ${tasks.dueDate} <= ${end}::date AND ${tasks.status} <> 'Completed' AND ${tasks.archivedAt} IS NULL)`;
}
