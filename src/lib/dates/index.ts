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

/**
 * SQL for "overdue": due date strictly before company-local today, task not completed,
 * not archived. Overdue is derived, never stored. D1-21 extends this module.
 */
export function overdueCondition(today: string): SQL {
  return sql`(${tasks.dueDate} < ${today}::date AND ${tasks.status} <> 'Completed' AND ${tasks.archivedAt} IS NULL)`;
}
