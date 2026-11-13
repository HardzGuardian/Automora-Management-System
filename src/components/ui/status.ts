export type Tone = "success" | "info" | "warning" | "danger" | "neutral";
export type StatusView = { tone: Tone; icon: string; label: string };

// Colour is never the only cue: every status carries an icon glyph and its text.
const MAP: Record<string, { tone: Tone; icon: string }> = {
  // tasks
  Pending: { tone: "warning", icon: "◔" },
  "In Progress": { tone: "info", icon: "▶" },
  "In Review": { tone: "info", icon: "◉" },
  Completed: { tone: "success", icon: "✓" },
  // projects
  Planning: { tone: "warning", icon: "◔" },
  Active: { tone: "info", icon: "▶" },
  "On Hold": { tone: "warning", icon: "❚❚" },
  Cancelled: { tone: "neutral", icon: "✕" },
  Archived: { tone: "neutral", icon: "▣" },
  // employees / clients
  Inactive: { tone: "neutral", icon: "○" },
  Suspended: { tone: "danger", icon: "⊘" },
  // invoices / payments / expenses (finance uses snake_case)
  draft: { tone: "neutral", icon: "✎" },
  issued: { tone: "info", icon: "➤" },
  partially_paid: { tone: "warning", icon: "◑" },
  paid: { tone: "success", icon: "✓" },
  overdue: { tone: "danger", icon: "!" },
  cancelled: { tone: "neutral", icon: "✕" },
  pending: { tone: "warning", icon: "◔" },
  confirmed: { tone: "success", icon: "✓" },
  reversed: { tone: "danger", icon: "↺" },
  unpaid: { tone: "warning", icon: "◔" },
};

export function statusView(status: string, opts: { overdue?: boolean } = {}): StatusView {
  if (opts.overdue) return { tone: "danger", icon: "!", label: `${status} · Overdue` };
  const hit = MAP[status];
  const label = status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return hit ? { ...hit, label } : { tone: "neutral", icon: "•", label };
}

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-background text-muted border border-border",
};
