import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  Critical: "font-semibold text-danger",
  High: "font-medium text-warning",
  Medium: "text-foreground",
  Low: "text-muted",
};

/** Priority as text with a subtle tone (never colour alone). */
export function Priority({ value }: { value: string }) {
  return <span className={cn("text-sm", TONE[value] ?? "text-foreground")}>{value}</span>;
}
