import type { PROJECT_STATUSES } from "@/db/schema";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Planning → Active → On Hold ↔ Active → Completed | Cancelled → Archived
export const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  Planning: ["Active", "Cancelled"],
  Active: ["On Hold", "Completed", "Cancelled"],
  "On Hold": ["Active", "Cancelled"],
  Completed: ["Archived"],
  Cancelled: ["Archived"],
  Archived: [],
};

export function canTransition(from: string, to: string): boolean {
  return (PROJECT_TRANSITIONS[from as ProjectStatus] ?? []).includes(to as ProjectStatus);
}
