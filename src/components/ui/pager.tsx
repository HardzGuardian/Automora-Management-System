import Link, { type LinkProps } from "next/link";

type Href = LinkProps["href"];

/** Previous / Next for simple server-paged lists. Pass `undefined` hrefs for the disabled ends. */
export function Pager({ page, pages, prevHref, nextHref }: { page: number; pages: number; prevHref?: Href; nextHref?: Href }) {
  if (pages <= 1) return null; // nothing to page through
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-end gap-2 text-[13px]">
      {prevHref ? (
        <Link href={prevHref} className="inline-flex h-8 items-center rounded-md border border-field bg-surface px-3 font-medium text-foreground hover:bg-background">
          Previous
        </Link>
      ) : (
        <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-muted">Previous</span>
      )}
      <span className="tabular-nums text-muted">
        Page {page} of {pages}
      </span>
      {nextHref ? (
        <Link href={nextHref} className="inline-flex h-8 items-center rounded-md border border-field bg-surface px-3 font-medium text-foreground hover:bg-background">
          Next
        </Link>
      ) : (
        <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-muted">Next</span>
      )}
    </nav>
  );
}
