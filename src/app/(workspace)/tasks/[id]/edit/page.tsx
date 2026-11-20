import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getTask } from "@/modules/tasks";
import { EditTaskForm } from "../edit-task-form";

export const metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let task;
  try {
    task = await getTask(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const allowed = can(actor, "tasks.update") && !task.archived;
  return (
    <div className="flex max-w-[800px] flex-col gap-5">
      <div>
        <BackLink href={`/tasks/${id}`}>{task.taskCode}</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Edit task</h1>
      </div>
      {allowed ? (
        <EditTaskForm
          id={id}
          title={task.title}
          description={task.description}
          priority={task.priority}
          startDate={task.startDate}
          dueDate={task.dueDate}
          estimatedHours={task.estimatedHours}
          actualHours={task.actualHours}
        />
      ) : (
        <p role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">You cannot edit this task.</p>
      )}
    </div>
  );
}
