import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const TONE = {
  neutral: "text-foreground",
  danger: "text-danger",
  success: "text-success",
  info: "text-info",
} as const;

/**
 * Stat card from the design: small label with icon, big number, one line of context.
 * Only period totals carry a label (`basis`); the page says once that the rest are as of today.
 */
export function KpiCard({
  label,
  value,
  basis,
  href,
  tone = "neutral",
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  basis?: "period total" | "point in time";
  href?: string;
  tone?: keyof typeof TONE;
  hint?: string;
  icon?: IconName;
}) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
      </p>
      <p className={cn("text-3xl font-semibold tabular-nums tracking-tight", TONE[tone])}>{value}</p>
      {basis === "period total" ? <p className="text-xs text-muted">period total</p> : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  const cls = "flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-[18px] py-4";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
