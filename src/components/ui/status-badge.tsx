import { cn } from "@/lib/cn";
import { TONE_CLASS, statusView } from "./status";

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const v = statusView(status, { overdue });
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[v.tone])}>
      <span aria-hidden="true">{v.icon}</span>
      {v.label}
    </span>
  );
}
