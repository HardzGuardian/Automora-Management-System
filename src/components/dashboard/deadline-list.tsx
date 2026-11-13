import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export type DeadlineItem = { id: string; taskCode: string; title: string; status: string; priority: string; dueDate: string; href: string };

export function DeadlineList({
  title,
  items,
  empty,
  overdue = false,
  viewAllHref,
}: {
  title: string;
  items: DeadlineItem[];
  empty: string;
  overdue?: boolean;
  viewAllHref?: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-xs text-primary underline">
            View all
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={t.href} className="min-w-0 flex-1 truncate font-medium underline">
                {t.title}
              </Link>
              <span className="text-xs text-muted">{t.taskCode}</span>
              <StatusBadge status={t.status} overdue={overdue} />
              <span className={overdue ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                {overdue ? "Was due " : "Due "}
                {t.dueDate}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
