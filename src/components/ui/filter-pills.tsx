import Link from "next/link";
import { cn } from "@/lib/cn";

export type Pill = { label: string; href: string; count?: number; active: boolean };

/** Round filter pills with counts (design). They are links, so a filter is a shareable URL. */
export function FilterPills({ label, pills }: { label: string; pills: Pill[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <Link
          key={p.label}
          href={p.href}
          aria-current={p.active ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
            p.active
              ? "border-primary/40 bg-primary-soft text-primary-ink"
              : "border-field bg-surface text-body hover:bg-background hover:text-foreground",
          )}
        >
          {p.label}
          {p.count !== undefined ? (
            <span className={cn("rounded px-1.5 text-[11.5px] tabular-nums leading-[18px]", p.active ? "bg-primary text-white" : "bg-background text-muted")}>{p.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
