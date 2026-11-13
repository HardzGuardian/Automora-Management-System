import Link from "next/link";
import type { ReactNode } from "react";
import { cardClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

/** `CUR 1180.00`. Amounts arrive from the server as exact decimal strings and are never re-parsed as floats. */
/** "INR 1,180.00". Groups the integer part with commas on the decimal string (no float conversion). */
export function money(currency: string, amount: string): string {
  const [whole, frac] = amount.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${sign}${grouped}${frac !== undefined ? `.${frac}` : ""}`;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 w-fit items-center text-sm text-muted hover:text-foreground">
      <span aria-hidden="true">←&nbsp;</span>
      {children}
    </Link>
  );
}

/** Title row of a detail page: code/number, status badge and a line of key facts. */
export function DetailHeader({ title, badge, facts }: { title: string; badge: ReactNode; facts?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      {facts ? <p className="text-sm text-muted">{facts}</p> : null}
    </div>
  );
}

/** Section card: `h2` plus an optional right-aligned action. */
export function Section({ title, action, description, children, className }: { title: string; action?: ReactNode; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {action}
      </div>
      {description ? <p className="-mt-2 text-sm text-muted">{description}</p> : null}
      {children}
    </section>
  );
}

/** Label/value pairs for the "Details" side card. */
export function DetailList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="m-0 min-w-0 break-words text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Tone = "default" | "success" | "danger";
const TONE: Record<Tone, string> = { default: "", success: "text-success", danger: "text-danger" };

/** Large figures (total / received / outstanding) in one card. */
export function Figures({ items }: { items: Array<{ label: string; value: string; tone?: Tone }> }) {
  return (
    <dl className={cn(cardClass, "grid gap-4 sm:grid-cols-3")}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={cn("m-0 text-xl font-semibold tabular-nums", TONE[item.tone ?? "default"])}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const tableClass = "table w-full border-0 text-left text-sm";
export const thClass = "px-3 py-2 font-semibold";
export const thNumClass = "px-3 py-2 text-right font-semibold";
export const tdClass = "px-3 py-2";
export const tdNumClass = "whitespace-nowrap px-3 py-2 text-right tabular-nums";

/** Bordered, horizontally scrolling table frame with a screen-reader caption. */
export function TableShell({ caption, minWidth = "32rem", children }: { caption: string; minWidth?: string; children: ReactNode }) {
  return (
    <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className={tableClass} style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export const PAYMENT_METHODS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export function methodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method.replaceAll("_", " ");
}

export const notSet = <span className="text-muted">—</span>;
