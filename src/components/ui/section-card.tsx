import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled group on a detail page: `rounded-md border bg-surface p-4 shadow-sm`, optional right-aligned action. */
export function SectionCard({
  title,
  count,
  action,
  children,
  id,
  className,
}: {
  title: string;
  /** Shown after the title, e.g. the number of rows. */
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="m-0 text-base font-semibold">
          {title}
          {count !== undefined ? <span className="ml-1.5 font-normal text-muted">({count})</span> : null}
        </h2>
        {action ? <div className="flex flex-wrap items-center gap-2 text-sm">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
