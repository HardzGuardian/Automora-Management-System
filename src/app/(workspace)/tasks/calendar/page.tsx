import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { buildMonthGrid, listCalendarTasks, shiftMonth } from "@/modules/tasks";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    <main className="flex flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Task calendar · {month}</h1>
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Calendar navigation">
          <Link href={link(shiftMonth(month, -1), view)} className="underline">
            ← Previous
          </Link>
          <Link href={link(today.slice(0, 7), view)} className="underline">
            Today
          </Link>
          <Link href={link(shiftMonth(month, 1), view)} className="underline">
            Next →
          </Link>
          <Link href={link(month, "mine")} className={view === "mine" ? "font-semibold underline" : "underline"}>
            My tasks
          </Link>
          <Link href={link(month, "all")} className={view === "all" ? "font-semibold underline" : "underline"}>
            All tasks
          </Link>
        </nav>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {DAYS.map((d) => (
                <th key={d} className="border-b p-1 text-left">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((cell) => (
                  <td key={cell.date} className={`h-24 border align-top p-1 ${cell.inMonth ? "" : "bg-gray-50 text-gray-400"} ${cell.date === today ? "outline outline-1 outline-black" : ""}`}>
                    <div className="text-xs">{Number(cell.date.slice(8))}</div>
                    <ul className="flex flex-col gap-0.5">
                      {cell.tasks.map((t) => {
                        const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
                        return (
                          <li key={t.id} className="truncate">
                            <Link href={`/tasks/${t.id}`} className={`underline ${overdue ? "text-red-600" : ""}`} title={`${t.taskCode} · ${t.status} · ${t.priority}`}>
                              {t.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 ? <p className="text-sm text-gray-600">No tasks due this month.</p> : null}
    </main>
  );
}
