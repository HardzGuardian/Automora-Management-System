import Link from "next/link";
import type { TaskDTO } from "@/modules/tasks";
import { changeStatusFormAction } from "../actions";

const COLUMNS = ["Pending", "In Progress", "In Review", "Completed"] as const;

/** Board with one-click moves. Drag-and-drop enhancement lives in board-dnd (D1-28). */
export function Board({ rows, today, allowed }: { rows: TaskDTO[]; today: string; allowed: (t: TaskDTO) => string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = rows.filter((t) => t.status === col);
        return (
          <section key={col} aria-label={col} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
            <h2 className="text-sm font-semibold">
              {col} ({items.length})
            </h2>
            {items.length === 0 ? <p className="text-xs text-gray-500">Nothing here.</p> : null}
            {items.map((t) => {
              const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
              return (
                <article key={t.id} className="flex flex-col gap-1 rounded border border-gray-200 p-2 text-sm">
                  <Link href={`/tasks/${t.id}`} className="font-medium underline">
                    {t.title}
                  </Link>
                  <span className="text-xs text-gray-600">
                    {t.taskCode} · {t.priority} · <span className={overdue ? "font-semibold text-red-600" : ""}>due {t.dueDate ?? "—"}</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {allowed(t).map((to) => (
                      <form key={to} action={changeStatusFormAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="to" value={to} />
                        <button type="submit" className="rounded border border-gray-300 px-2 py-1 text-xs">
                          → {to}
                        </button>
                      </form>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
