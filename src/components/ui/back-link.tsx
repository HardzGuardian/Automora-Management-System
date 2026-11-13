import Link from "next/link";
import type { ReactNode } from "react";

/** "← Projects" link above a detail page header. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
