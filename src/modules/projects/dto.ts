import type { projects } from "@/db/schema";

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

export function toProjectDTO(r: typeof projects.$inferSelect): ProjectDTO {
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
    budgetAmount: r.budgetAmount,
    currency: r.currency,
    archived: r.archivedAt !== null,
    createdAt: r.createdAt,
  };
}
