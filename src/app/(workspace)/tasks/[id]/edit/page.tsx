import { notFound } from "next/navigation";
import { z } from "zod";
import { ControlPanel, sheetClass } from "@/components/ui/odoo";
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
    <div className="flex flex-col gap-4">
      <ControlPanel crumbs={[{ label: task.taskCode, href: `/tasks/${id}` }, { label: "Edit task" }]} />
      <div data-sheet className={`${sheetClass} max-w-[800px] flex flex-col gap-5`}>
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
    </div>
  );
}
