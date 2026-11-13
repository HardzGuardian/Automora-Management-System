import type { tasks } from "@/db/schema";

export type TaskAssigneeDTO = { employeeId: string; fullName: string; viaTeamId: string | null };

export type TaskDTO = {
  id: string;
  taskCode: string;
  projectId: string | null;
  clientId: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  createdBy: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignees: TaskAssigneeDTO[];
};

export function toTaskDTO(r: typeof tasks.$inferSelect, assignees: TaskAssigneeDTO[]): TaskDTO {
  return {
    id: r.id,
    taskCode: r.taskCode,
    projectId: r.projectId,
    clientId: r.clientId,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    startDate: r.startDate,
    dueDate: r.dueDate,
    estimatedHours: r.estimatedHours,
    actualHours: r.actualHours,
    completedAt: r.completedAt,
    completedBy: r.completedBy,
    createdBy: r.createdBy,
    archived: r.archivedAt !== null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    assignees,
  };
}
