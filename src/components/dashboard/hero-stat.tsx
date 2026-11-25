import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Tone = "danger" | "warning" | "info" | "success" | "neutral";

/** Tint for the whole card, the icon chip and the number. A zero never looks alarming. */
const TONE: Record<Tone, { card: string; chip: string; value: string }> = {
  danger: { card: "border-danger/25 bg-danger-soft", chip: "bg-danger text-white", value: "text-danger" },
  warning: { card: "border-[var(--tone-amber)]/25 bg-[var(--tone-amber-soft)]", chip: "bg-[var(--tone-amber)] text-white", value: "text-[var(--tone-amber)]" },
  info: { card: "border-[var(--tone-blue)]/20 bg-[var(--tone-blue-soft)]", chip: "bg-[var(--tone-blue)] text-white", value: "text-[var(--tone-blue)]" },
  success: { card: "border-primary/20 bg-primary-soft", chip: "bg-primary text-white", value: "text-primary-ink" },
  neutral: { card: "border-border bg-surface", chip: "bg-[var(--tone-slate-soft)] text-[var(--tone-slate)]", value: "text-foreground" },
};

/** A "needs attention" card: what it is, how many, and one line saying what to do or that all is well. */
export function HeroStat({ label, value, hint, icon, tone, href }: { label: string; value: number; hint: string; icon: IconName; tone: Tone; href: string }) {
  const t = TONE[value === 0 && tone !== "info" ? "neutral" : tone];
  return (
    <Link href={href} className={cn("group flex items-start justify-between gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-[var(--elev-2)]", t.card)}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[13.5px] font-medium text-body">{label}</span>
        <span className={cn("text-[2.5rem] font-semibold leading-none tabular-nums tracking-tight", t.value)}>{value}</span>
        <span className="mt-1 text-[12.5px] text-muted">{hint}</span>
      </span>
      <span aria-hidden="true" className={cn("inline-flex size-11 flex-none items-center justify-center rounded-xl", t.chip)}>
        <Icon name={icon} size={21} />
      </span>
    </Link>
  );
}

/** One quiet number in the overview strip. */
export function StripStat({ label, value, note, href }: { label: string; value: number; note?: string; href: string }) {
  return (
    <Link href={href} className="flex flex-1 basis-[150px] flex-col gap-0.5 px-5 py-3.5 hover:bg-background">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[1.5rem] font-semibold leading-8 tabular-nums tracking-tight text-foreground">{value}</span>
      {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
    </Link>
  );
}
