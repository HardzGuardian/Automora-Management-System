import type { projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { can } from "@/lib/permissions";

export type ProjectDTO = {
  id: string;
  projectCode: string;
  name: string;
  description: string | null;
  type: string;
  clientId: string | null;
  ownerEmployeeId: string;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  budgetAmount: string | null;
  currency: string;
  archived: boolean;
  createdAt: Date;
};

/** The budget is commercially sensitive: only people who can edit the project or use finance see it. */
export function canSeeBudget(actor: Actor): boolean {
  return can(actor, "projects.update") || can(actor, "finance.invoices.read") || can(actor, "finance.reports.read");
}

export function toProjectDTO(r: typeof projects.$inferSelect, actor?: Actor): ProjectDTO {
  return {
    id: r.id,
    projectCode: r.projectCode,
    name: r.name,
    description: r.description,
    type: r.type,
    clientId: r.clientId,
    ownerEmployeeId: r.ownerEmployeeId,
    startDate: r.startDate,
    dueDate: r.dueDate,
    status: r.status,
    budgetAmount: actor && !canSeeBudget(actor) ? null : r.budgetAmount,
    currency: r.currency,
    archived: r.archivedAt !== null,
    createdAt: r.createdAt,
  };
}
