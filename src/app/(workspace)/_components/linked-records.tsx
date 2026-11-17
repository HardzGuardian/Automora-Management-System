import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { linkClass } from "@/components/ui/styles";

export type LinkedRow = {
  id: string;
  href: string;
  title: string;
  /** Small grey line under the title (date, code, who). */
  subtitle?: string;
  /** Text status; shown as a badge (never colour alone). */
  status?: string;
  /** Right-aligned amount or figure. */
  amount?: string;
};

/**
 * A short list of records linked to the page's subject (a client's invoices, a project's expenses).
 * Shows the first rows and, when there are more, how many and where to see them all.
 */
export function LinkedRecords({
  title,
  rows,
  total,
  empty,
  viewAllHref,
}: {
  title: string;
  rows: LinkedRow[];
  total: number;
  empty: string;
  viewAllHref?: string;
}) {
  return (
    <SectionCard
      title={title}
      count={total}
      action={
        viewAllHref && total > rows.length ? (
          <Link href={viewAllHref} className={linkClass}>
            View all {total}
          </Link>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1">
                <Link href={r.href} className={`${linkClass} font-medium`}>
                  {r.title}
                </Link>
                {r.subtitle ? <span className="block text-xs text-muted">{r.subtitle}</span> : null}
              </span>
              {r.status ? <StatusBadge status={r.status} /> : null}
              {r.amount ? <span className="whitespace-nowrap font-medium tabular-nums">{r.amount}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && !viewAllHref ? <p className="text-xs text-muted">Showing the latest {rows.length}.</p> : null}
    </SectionCard>
  );
}
