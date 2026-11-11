import "server-only";
import type { Actor } from "@/lib/auth/actor";
import { addDays } from "@/lib/dates";
import type { TaskDTO } from "./dto";
import { listTasks } from "./queries";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parse(month: string): { y: number; m: number } {
  const match = MONTH_RE.exec(month);
  if (!match) throw new RangeError("Month must be YYYY-MM");
  return { y: Number(match[1]), m: Number(match[2]) };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function monthBounds(month: string): { from: string; to: string } {
  const { y, m } = parse(month);
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
}

export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parse(month);
  return iso(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
}

export type CalendarCell<T> = { date: string; inMonth: boolean; tasks: T[] };

/** Month grid in whole Monday–Sunday weeks, with items placed on their due date. */
export function buildMonthGrid<T extends { dueDate: string | null }>(
  month: string,
  items: readonly T[],
): { month: string; weeks: CalendarCell<T>[][] } {
  const { from, to } = monthBounds(month);
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  const start = addDays(from, -((first.getUTCDay() + 6) % 7));
  const end = addDays(to, (7 - last.getUTCDay()) % 7);

  const byDate = new Map<string, T[]>();
  for (const item of items) {
    if (!item.dueDate) continue;
    const list = byDate.get(item.dueDate) ?? [];
    list.push(item);
    byDate.set(item.dueDate, list);
  }

  const weeks: CalendarCell<T>[][] = [];
  let cursor = start;
  while (cursor <= end) {
    const week: CalendarCell<T>[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor >= from && cursor <= to, tasks: byDate.get(cursor) ?? [] });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return { month, weeks };
}

/** All of a month's tasks (by due date) that the actor may see. Pages through the list. */
export async function listCalendarTasks(
  actor: Actor,
  input: { month: string; view: "mine" | "all" },
): Promise<TaskDTO[]> {
  const { from, to } = monthBounds(input.month);
  const out: TaskDTO[] = [];
  for (let page = 1; page <= 20; page++) {
    const { rows, total } = await listTasks(actor, {
      view: input.view,
      dueFrom: from,
      dueTo: to,
      sort: "due",
      page,
      pageSize: 100,
    });
    out.push(...rows);
    if (out.length >= total || rows.length === 0) break;
  }
  return out;
}
