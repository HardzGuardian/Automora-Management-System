import type { IconName } from "./icons";

export type Tone = "success" | "info" | "warning" | "danger" | "neutral";
/** `icon` names an icon in ui/icons: every status shows an icon and its text, never colour alone. */
export type StatusView = { tone: Tone; icon: IconName; label: string };

const MAP: Record<string, { tone: Tone; icon: IconName }> = {
  // tasks
  Pending: { tone: "warning", icon: "pending" },
  "In Progress": { tone: "info", icon: "inProgress" },
  "In Review": { tone: "info", icon: "review" },
  Completed: { tone: "success", icon: "completed" },
  // projects
  Planning: { tone: "warning", icon: "pending" },
  Active: { tone: "info", icon: "inProgress" },
  "On Hold": { tone: "warning", icon: "onHold" },
  Cancelled: { tone: "neutral", icon: "cancelled" },
  Archived: { tone: "neutral", icon: "archived" },
  // employees / clients
  Inactive: { tone: "neutral", icon: "inactive" },
  Suspended: { tone: "danger", icon: "suspended" },
  // invoices / payments / expenses (finance uses snake_case)
  draft: { tone: "neutral", icon: "draft" },
  issued: { tone: "info", icon: "issued" },
  partially_paid: { tone: "warning", icon: "partial" },
  paid: { tone: "success", icon: "completed" },
  overdue: { tone: "danger", icon: "overdue" },
  cancelled: { tone: "neutral", icon: "cancelled" },
  pending: { tone: "warning", icon: "pending" },
  confirmed: { tone: "success", icon: "completed" },
  reversed: { tone: "danger", icon: "reversed" },
  unpaid: { tone: "warning", icon: "pending" },
};

/** "In Progress" and "partially_paid" both read as sentence case: "In progress", "Partially paid". */
const sentenceCase = (s: string) => {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

/** An overdue item shows only as Overdue, like the design; the date column still says when it was due. */
export function statusView(status: string, opts: { overdue?: boolean } = {}): StatusView {
  if (opts.overdue) return { tone: "danger", icon: "overdue", label: "Overdue" };
  const hit = MAP[status];
  const label = sentenceCase(status);
  return hit ? { ...hit, label } : { tone: "neutral", icon: "dot", label };
}

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-background text-muted border border-border",
};
