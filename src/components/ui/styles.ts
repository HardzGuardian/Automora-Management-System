import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-field bg-surface text-foreground hover:bg-primary-soft",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-foreground hover:bg-primary-soft",
};

/** Class string for buttons and link-buttons. Min 44px high for touch (the design's target size). */
export function buttonClass(variant: Variant = "primary", extra?: string): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    extra,
  );
}

export const inputClass =
  "min-h-11 w-full rounded-md border border-field bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:bg-background";
/** Inline text link inside body copy and tables. */
export const linkClass = "text-primary-ink underline underline-offset-2 hover:text-primary-hover";
/** Single-column form container (max ~40rem). */
export const formClass = "flex w-full max-w-xl flex-col gap-4";
export const cardClass = "rounded-lg border border-border bg-surface p-5";
