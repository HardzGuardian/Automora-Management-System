"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Settings sections as a vertical list (design); the current one is highlighted and marked with aria-current. */
export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="min-w-[190px] flex-[0_1_220px] rounded-lg border border-border bg-surface p-2">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center rounded-lg px-3 font-medium", active ? "bg-primary-soft text-primary-ink" : "text-foreground hover:bg-primary-soft")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
