"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Settings section links; the current one is highlighted and marked with aria-current. */
export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("rounded-md px-3 py-2", active ? "bg-primary-soft font-semibold text-primary" : "hover:bg-primary-soft")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
