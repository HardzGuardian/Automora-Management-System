import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

/** "‹ Projects" link above a detail page header (design: 13px, medium, brand colour). */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} data-back className="inline-flex min-h-8 w-fit items-center gap-1 text-[13px] font-medium text-primary-ink hover:text-primary-hover">
      <Icon name="chevronLeft" size={16} strokeWidth={2.2} />
      {children}
    </Link>
  );
}
