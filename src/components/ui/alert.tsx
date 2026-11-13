import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info" | "warning";
const TONE: Record<Tone, string> = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  info: "border-info/30 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
};

/** Inline message box. Errors use role="alert"; everything else role="status". */
export function Alert({ tone = "error", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", TONE[tone], className)}>
      {children}
    </div>
  );
}
