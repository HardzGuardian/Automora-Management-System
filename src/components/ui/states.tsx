import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClass } from "./styles";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-border/70", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-6" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string } | ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action && typeof action === "object" && "href" in action ? (
        <Link href={action.href} className={buttonClass("primary", "mt-2")}>
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-danger/30 bg-danger-soft p-8 text-center">
      <p className="text-base font-medium text-danger">{title}</p>
      {message ? <p className="max-w-md text-sm">{message}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className={buttonClass("secondary", "mt-2")}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
