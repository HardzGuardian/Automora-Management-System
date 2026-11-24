import Link from "next/link";
import { cn } from "@/lib/cn";

export type CalendarTask = { id: string; taskCode: string; title: string; status: string; priority: string; dueDate: string; late: boolean };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Month grid (Monday first) with tasks on their due dates. Pure server rendering, links only. */
export function TaskCalendar({
  month,
  today,
  tasks,
  prevHref,
  nextHref,
  todayHref,
}: {
  month: string;
  today: string;
  tasks: CalendarTask[];
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const byDay = new Map<string, CalendarTask[]>();
  for (const t of tasks) byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]);
  const title = first.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  const navCls = "rounded-md border border-field bg-surface px-3 py-1.5 hover:bg-primary-soft";

  return (
    <section aria-label={`Calendar, ${title}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        <nav aria-label="Month" className="flex items-center gap-2 text-sm">
          <Link href={prevHref} className={navCls}>
            Previous
          </Link>
          <Link href={todayHref} className={navCls}>
            Today
          </Link>
          <Link href={nextHref} className={navCls}>
            Next
          </Link>
        </nav>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-lg border border-border bg-surface">
          {DOW.map((d) => (
            <div key={d} className="border-b border-border bg-background px-2 py-2 text-xs font-medium text-muted">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const key = day ? `${month}-${pad(day)}` : "";
            const list = day ? (byDay.get(key) ?? []) : [];
            return (
              <div key={i} className={cn("min-h-28 border-b border-r border-border p-1.5 text-xs", !day && "bg-background/60", key === today && "bg-primary-soft/40")}>
                {day ? <div className={cn("mb-1 font-medium tabular-nums", key === today ? "text-primary-ink" : "text-muted")}>{day}</div> : null}
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {list.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.id}`}
                        title={`${t.taskCode} · ${t.status} · ${t.priority}`}
                        className={cn(
                          "block truncate rounded px-1.5 py-1 hover:underline",
                          t.status === "Completed" ? "bg-primary-soft text-muted line-through" : t.late ? "bg-danger/10 text-danger" : "bg-background text-foreground",
                        )}
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > 4 ? <li className="px-1 text-muted">+{list.length - 4} more</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
