import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-primary-soft",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-foreground hover:bg-primary-soft",
};

/** Class string for buttons and link-buttons. Min 40px high for touch. */
export function buttonClass(variant: Variant = "primary", extra?: string): string {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    extra,
  );
}

export const inputClass =
  "min-h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:bg-background";
export const cardClass = "rounded-md border border-border bg-surface p-4 shadow-sm";
