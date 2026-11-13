import Link from "next/link";
import { cn } from "@/lib/cn";

const TONE = {
  neutral: "text-foreground",
  danger: "text-danger",
  success: "text-success",
  info: "text-info",
} as const;

/**
 * KPI tile. Only period totals carry a label (`basis`); point-in-time figures are the default and
 * the page says so once, instead of repeating it on every tile.
 */
export function KpiCard({
  label,
  value,
  basis,
  href,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  basis?: "period total" | "point in time";
  href?: string;
  tone?: keyof typeof TONE;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", TONE[tone])}>{value}</p>
      {basis === "period total" ? <p className="mt-1 text-xs text-muted">period total</p> : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-md border border-border bg-surface p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
