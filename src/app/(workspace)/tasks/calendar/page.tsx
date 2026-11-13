import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { statusView, TONE_CLASS } from "@/components/ui/status";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { todayInTz } from "@/lib/dates";
import { buildMonthGrid, listCalendarTasks, shiftMonth } from "@/modules/tasks";

export const metadata = { title: "Task calendar" };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function TaskCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const today = todayInTz(actor.timezone);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? (sp.month as string) : today.slice(0, 7);
  const view = sp.view === "all" ? "all" : "mine";

  const tasks = await listCalendarTasks(actor, { month, view });
  const grid = buildMonthGrid(month, tasks);
  const link = (m: string, v: string) => ({ query: { month: m, view: v } });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Task calendar"
        description={`${monthLabel(month)} · tasks by due date`}
        actions={
          <Link href={view === "all" ? "/tasks" : "/my-tasks"} className={buttonClass("secondary")}>
            Back to list
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Calendar navigation">
          <Link href={link(shiftMonth(month, -1), view)} className={buttonClass("secondary")}>
            ← Previous
          </Link>
          <Link href={link(today.slice(0, 7), view)} className={buttonClass("secondary")}>
            Today
          </Link>
          <Link href={link(shiftMonth(month, 1), view)} className={buttonClass("secondary")}>
            Next →
          </Link>
        </nav>
        <SegmentedNav
          label="Calendar scope"
          items={[
            { label: "My tasks", href: link(month, "mine"), active: view === "mine" },
            { label: "All tasks", href: link(month, "all"), active: view === "all" },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="table w-full min-w-[46rem] table-fixed rounded-none border-0 border-collapse text-sm">
          <caption className="sr-only">Tasks due in {monthLabel(month)}</caption>
          <thead className="bg-primary-soft">
            <tr>
              {DAYS.map((d) => (
                <th key={d} scope="col" className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((cell) => {
                  const isToday = cell.date === today;
                  return (
                    <td
                      key={cell.date}
                      className={cn(
                        "h-28 border-l border-t border-border p-1.5 align-top first:border-l-0",
                        !cell.inMonth && "bg-background text-muted",
                        isToday && "bg-primary-soft",
                      )}
                    >
                      <div className="mb-1">
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                            isToday ? "bg-primary font-semibold text-white" : "text-muted",
                          )}
                        >
                          {Number(cell.date.slice(8))}
                          {isToday ? <span className="sr-only"> (today)</span> : null}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1">
                        {cell.tasks.map((t) => {
                          const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
                          const v = statusView(t.status, { overdue });
                          return (
                            <li key={t.id}>
                              <Link
                                href={`/tasks/${t.id}`}
                                className={cn("block truncate rounded-md px-1.5 py-0.5 text-xs font-medium hover:underline", TONE_CLASS[v.tone])}
                                title={`${t.taskCode} · ${t.status} · ${t.priority}${overdue ? " · overdue" : ""}`}
                              >
                                {t.title}
                                {overdue ? <span className="block text-[10px] font-semibold uppercase">overdue</span> : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 ? <p className="text-sm text-muted">No tasks due this month.</p> : null}
      <p className="text-xs text-muted">Chip colour shows status: amber pending, blue in progress or review, green completed, red overdue.</p>
    </div>
  );
}
