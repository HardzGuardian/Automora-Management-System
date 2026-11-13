import Link from "next/link";
import { DueDate } from "@/components/ui/due-date";
import { Priority } from "@/components/ui/priority";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TaskDTO } from "@/modules/tasks";
import { SelectAll } from "./bulk-bar";

/**
 * Task list. On a phone it shows title, status and due date (the code and priority sit under the
 * title); from tablet width up it shows every column. Any overflow scrolls inside its container.
 */
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
      <table className="w-full rounded-none border-0 text-left text-sm sm:min-w-[44rem]">
        <caption className="sr-only">Tasks</caption>
        <thead className="bg-primary-soft">
          <tr>
            {selectFormId ? (
              <th scope="col" className="w-10 px-2 py-2 sm:px-3">
                <SelectAll formId={selectFormId} name="taskIds" />
              </th>
            ) : null}
            <th scope="col" className="hidden px-2 py-2 sm:px-3 font-semibold sm:table-cell">Code</th>
            <th scope="col" className="px-2 py-2 sm:px-3 font-semibold">Title</th>
            <th scope="col" className="px-2 py-2 sm:px-3 font-semibold">Status</th>
            <th scope="col" className="hidden px-2 py-2 sm:px-3 font-semibold sm:table-cell">Priority</th>
            <th scope="col" className="px-2 py-2 sm:px-3 font-semibold">Due</th>
            <th scope="col" className="hidden px-2 py-2 sm:px-3 font-semibold sm:table-cell">Assignees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const overdue = t.dueDate !== null && t.dueDate < today && t.status !== "Completed";
            return (
              <tr key={t.id} className="border-t border-border hover:bg-background">
                {selectFormId ? (
                  <td className="px-2 py-2 sm:px-3">
                    <input type="checkbox" name="taskIds" value={t.id} form={selectFormId} aria-label={`Select ${t.taskCode}`} className="size-4 accent-primary" />
                  </td>
                ) : null}
                <td className="hidden whitespace-nowrap px-2 py-2 sm:px-3 text-muted sm:table-cell">{t.taskCode}</td>
                <td className="px-2 py-2 sm:px-3">
                  <Link href={`/tasks/${t.id}`} className="font-medium underline">
                    {t.title}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 whitespace-nowrap text-xs text-muted sm:hidden">
                    {t.taskCode}
                    <Priority value={t.priority} />
                  </span>
                </td>
                <td className="px-2 py-2 sm:px-3">
                  <StatusBadge status={t.status} overdue={overdue} />
                </td>
                <td className="hidden px-2 py-2 sm:px-3 sm:table-cell">
                  <Priority value={t.priority} />
                </td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                  <DueDate value={t.dueDate} overdue={overdue} />
                </td>
                <td className="hidden px-2 py-2 sm:px-3 sm:table-cell">{t.assignees.map((a) => a.fullName).join(", ") || <span className="text-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
