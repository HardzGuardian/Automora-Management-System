import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary font-semibold text-white shadow-[var(--elev-1)] hover:bg-primary-hover active:translate-y-px",
  secondary: "border border-field bg-surface text-foreground shadow-[var(--elev-1)] hover:border-[#b9c2bb] hover:bg-background active:translate-y-px",
  danger: "bg-danger font-semibold text-white shadow-[var(--elev-1)] hover:opacity-90 active:translate-y-px",
  ghost: "text-body hover:bg-primary-soft hover:text-foreground",
};

/** Class string for buttons and link-buttons. 40px high (44px on touch screens via the coarse-pointer rule in globals.css). */
export function buttonClass(variant: Variant = "primary", extra?: string): string {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    extra,
  );
}

export const inputClass =
  "min-h-10 w-full rounded-lg border border-field bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--elev-1)] placeholder:text-muted disabled:bg-background";
/** Inline text link inside body copy and tables. */
export const linkClass = "text-primary-ink underline underline-offset-2 hover:text-primary-hover";
/** Single-column form container (max ~40rem). */
export const formClass = "flex w-full max-w-xl flex-col gap-4";
export const cardClass = "rounded-xl border border-border bg-surface p-5 shadow-[var(--elev-1)]";
