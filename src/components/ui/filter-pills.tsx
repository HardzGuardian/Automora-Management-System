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
            "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
            p.active ? "border-primary bg-primary text-white" : "border-field bg-surface text-foreground hover:bg-primary-soft",
          )}
        >
          {p.label}
          {p.count !== undefined ? <span className="tabular-nums opacity-85">{p.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
