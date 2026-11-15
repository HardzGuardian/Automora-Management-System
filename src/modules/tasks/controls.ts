import type { Actor } from "@/lib/auth/actor";
import { can } from "@/lib/permissions";
import type { TaskDTO } from "./dto";
import { allowedTransitions, isOwnTransitionAllowed } from "./status-machine";

/**
 * What a row may offer this person, so the screen never shows a control that would only fail.
 * People with tasks.update can move a task anywhere the state machine allows. Everyone else can
 * only step their own task forward as far as In Review (a manager completes it) and step it back.
 */
export function rowControls(actor: Actor, t: Pick<TaskDTO, "status" | "assignees" | "archived">): { canToggle: boolean; statuses: string[] } {
  if (t.archived) return { canToggle: false, statuses: [] };
  if (can(actor, "tasks.update")) return { canToggle: true, statuses: [t.status, ...allowedTransitions(t.status)] };
  const mine = actor.employeeId !== null && t.assignees.some((a) => a.employeeId === actor.employeeId) && can(actor, "tasks.status.update.own");
  if (!mine) return { canToggle: false, statuses: [] };
  return { canToggle: false, statuses: [t.status, ...allowedTransitions(t.status).filter((to) => isOwnTransitionAllowed(t.status, to))] };
}
