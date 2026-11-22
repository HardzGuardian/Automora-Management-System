import Link from "next/link";
import { cn } from "@/lib/cn";

export type Pill = { label: string; href: string; count?: number; active: boolean };

/** Round filter pills with counts (design). They are links, so a filter is a shareable URL. */
export function FilterPills({ label, pills }: { label: string; pills: Pill[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <Link
          key={p.label}
          href={p.href}
          aria-current={p.active ? "true" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
            p.active
              ? "border-primary/30 bg-primary-soft text-primary-ink shadow-[var(--elev-1)]"
              : "border-border bg-surface text-body hover:border-field hover:bg-background hover:text-foreground",
          )}
        >
          {p.label}
          {p.count !== undefined ? (
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums leading-5", p.active ? "bg-primary text-white" : "bg-background text-muted")}>{p.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
