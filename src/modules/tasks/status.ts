import "server-only";
import { and, eq } from "drizzle-orm";
import { withTransaction } from "@/db";
import { taskAssignees, tasks } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { notify, type NotifyEvent } from "@/lib/notify";
import { can, requirePermission } from "@/lib/permissions";
import { loadTask, loadTaskDTO, logTaskActivity } from "./core";
import type { TaskDTO } from "./dto";
import { statusSchema } from "./schemas";
import { canTransition, isOwnTransitionAllowed } from "./status-machine";

export async function changeTaskStatus(actor: Actor, taskId: string, toRaw: string): Promise<TaskDTO> {
  const to = statusSchema.parse(toRaw);

  const { dto, event } = await withTransaction(async (tx) => {
    const before = await loadTask(tx, actor, taskId); // out of scope → NOT_FOUND
    if (before.archivedAt) throw new DomainError("VALIDATION", "Archived tasks cannot change status");
    if (!canTransition(before.status, to)) {
      throw new DomainError("CONFLICT", `A task cannot move from ${before.status} to ${to}`);
    }

    if (!can(actor, "tasks.update")) {
      requirePermission(actor, "tasks.status.update.own");
      const isAssignee = actor.employeeId
        ? (
            await tx
              .select({ id: taskAssignees.employeeId })
              .from(taskAssignees)
              .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.employeeId, actor.employeeId)))
          ).length > 0
        : false;
      if (!isAssignee || !isOwnTransitionAllowed(before.status, to)) {
        throw new DomainError("FORBIDDEN", "You cannot make this status change");
      }
    }

    const completing = to === "Completed";
    const reopening = before.status === "Completed";
    const now = new Date();
    // Compare-and-set: of several concurrent identical transitions exactly one matches the expected status.
    const updated = await tx
      .update(tasks)
      .set({
        status: to,
        completedAt: completing ? now : null,
        completedBy: completing ? actor.userId : null,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.companyId, actor.companyId), eq(tasks.status, before.status)))
      .returning({ updatedAt: tasks.updatedAt, completedAt: tasks.completedAt });
    if (updated.length === 0) {
      throw new DomainError("CONFLICT", "This task was changed by someone else; reload and try again");
    }

    await logTaskActivity(tx, actor, taskId, reopening ? "reopened" : "status_changed", { status: before.status }, { status: to });

    let event: NotifyEvent | null = null;
    if ((to === "In Review" || to === "Completed") && before.createdBy && before.createdBy !== actor.userId) {
      event = {
        type: to === "Completed" ? "task.completed" : "task.review",
        userIds: [before.createdBy],
        entity: { type: "task", id: taskId },
        eventKey:
          to === "Completed"
            ? `task:${taskId}:completed:${updated[0].completedAt?.toISOString()}`
            : `task:${taskId}:review:${updated[0].updatedAt.toISOString()}`,
        title: to === "Completed" ? `Completed: ${before.title}` : `Ready for review: ${before.title}`,
      };
    }
    return { dto: await loadTaskDTO(tx, actor, taskId), event };
  });

  if (event) await notify(event); // after commit
  return dto;
}
