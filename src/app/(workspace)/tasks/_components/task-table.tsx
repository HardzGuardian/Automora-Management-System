import Link from "next/link";
import { DueDate } from "@/components/ui/due-date";
import { Priority } from "@/components/ui/priority";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TaskDTO } from "@/modules/tasks";

/** Task list: a table that scrolls horizontally inside its own container on narrow screens. */
export function TaskTable({
  rows,
  today,
  selectFormId,
  emptyTitle = "No tasks match",
  emptyDescription = "Try a different search or clear the filters.",
}: {
  rows: TaskDTO[];
  today: string;
  selectFormId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[44rem] rounded-none border-0 text-left text-sm">
        <caption className="sr-only">Tasks</caption>
        <thead className="bg-primary-soft">
          <tr>
            {selectFormId ? (
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2 font-semibold">Code</th>
            <th scope="col" className="px-3 py-2 font-semibold">Title</th>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 font-semibold">Priority</th>
            <th scope="col" className="px-3 py-2 font-semibold">Due</th>
            <th scope="col" className="px-3 py-2 font-semibold">Assignees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
            return (
              <tr key={t.id} className="border-t border-border hover:bg-background">
                {selectFormId ? (
                  <td className="px-3 py-2">
                    <input type="checkbox" name="taskIds" value={t.id} form={selectFormId} aria-label={`Select ${t.taskCode}`} className="size-4 accent-primary" />
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-3 py-2 text-muted">{t.taskCode}</td>
                <td className="px-3 py-2">
                  <Link href={`/tasks/${t.id}`} className="font-medium underline">
                    {t.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} overdue={overdue} />
                </td>
                <td className="px-3 py-2">
                  <Priority value={t.priority} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <DueDate value={t.dueDate} overdue={overdue} />
                </td>
                <td className="px-3 py-2">{t.assignees.map((a) => a.fullName).join(", ") || <span className="text-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
