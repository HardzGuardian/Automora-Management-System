import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/cn";

export type SegmentItem = { label: string; href: LinkProps["href"]; active?: boolean };

/** A small link group for switching views (List / Board / Calendar, tabs). The active link has aria-current. */
export function SegmentedNav({ label, items }: { label: string; items: SegmentItem[] }) {
  return (
    <nav aria-label={label} className="inline-flex w-fit max-w-full overflow-x-auto rounded-md border border-border bg-surface p-0.5">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-3 text-sm",
            i.active ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-background hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
