import { cn } from "@/lib/cn";
import { Icon } from "./icons";
import { TONE_CLASS, statusView } from "./status";

/** Pill with an icon and the status in words (design: 12px, medium weight, soft background). */
export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const v = statusView(status, { overdue });
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-2 pr-2.5 text-xs font-medium", TONE_CLASS[v.tone])}>
      <Icon name={v.icon} size={13} strokeWidth={2.2} />
      {v.label}
    </span>
  );
}
