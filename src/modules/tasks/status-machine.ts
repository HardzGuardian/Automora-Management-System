import type { TASK_STATUSES } from "@/db/schema";

export type TaskStatus = (typeof TASK_STATUSES)[number];

// Pending → In Progress → In Review → Completed, with step-backs and reopen (Completed → In Progress).
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  Pending: ["In Progress"],
  "In Progress": ["In Review", "Pending"],
  "In Review": ["Completed", "In Progress"],
  Completed: ["In Progress"],
};

export function allowedTransitions(from: string): readonly TaskStatus[] {
  return TASK_TRANSITIONS[from as TaskStatus] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as TaskStatus);
}

/**
 * Assignees (with tasks.status.update.own) may move work between Pending / In Progress / In Review.
 * Completing a task and reopening a completed one are review decisions that need tasks.update.
 */
export function isOwnTransitionAllowed(from: string, to: string): boolean {
  return canTransition(from, to) && to !== "Completed" && from !== "Completed";
}
