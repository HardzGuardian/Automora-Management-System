import Link, { type LinkProps } from "next/link";

type Href = LinkProps["href"];

/** Previous / Next for simple server-paged lists. Pass `undefined` hrefs for the disabled ends. */
export function Pager({ page, pages, prevHref, nextHref }: { page: number; pages: number; prevHref?: Href; nextHref?: Href }) {
  if (pages <= 1) return null; // nothing to page through
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3 text-sm">
      {prevHref ? (
        <Link href={prevHref} className="text-primary underline underline-offset-2">
          Previous
        </Link>
      ) : (
        <span className="text-muted">Previous</span>
      )}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {nextHref ? (
        <Link href={nextHref} className="text-primary underline underline-offset-2">
          Next
        </Link>
      ) : (
        <span className="text-muted">Next</span>
      )}
    </nav>
  );
}
