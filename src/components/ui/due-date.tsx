import { cn } from "@/lib/cn";

/** Due date as YYYY-MM-DD; overdue is flagged with the word, not just colour. */
export function DueDate({ value, overdue }: { value: string | null; overdue?: boolean }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className={cn("tabular-nums", overdue && "font-medium text-danger")}>
      {value}
      {overdue ? <span> · overdue</span> : null}
    </span>
  );
}
