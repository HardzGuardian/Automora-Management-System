import type { ReactNode } from "react";

/** Filter row for list pages: a GET form with `role="search"` that wraps on mobile. Controls need labels. */
export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <form role="search" aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </form>
  );
}
