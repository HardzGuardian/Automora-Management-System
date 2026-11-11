import Link from "next/link";
import type { TaskDTO } from "@/modules/tasks";

/** Responsive list: scrolls horizontally on narrow screens. */
export function TaskTable({ rows, today }: { rows: TaskDTO[]; today: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-600">No tasks match.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Code</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Assignees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
            return (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.taskCode}</td>
                <td>
                  <Link href={`/tasks/${t.id}`} className="underline">
                    {t.title}
                  </Link>
                </td>
                <td>{t.status}</td>
                <td>{t.priority}</td>
                <td className={overdue ? "font-semibold text-red-600" : ""}>
                  {t.dueDate ?? "—"}
                  {overdue ? " (overdue)" : ""}
                </td>
                <td>{t.assignees.map((a) => a.fullName).join(", ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
