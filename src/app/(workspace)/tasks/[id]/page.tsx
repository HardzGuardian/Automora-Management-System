import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DetailHeader } from "@/components/ui/detail-header";
import { DetailsList } from "@/components/ui/details-list";
import { DueDate } from "@/components/ui/due-date";
import { formatDateTime } from "@/components/ui/format";
import { Priority } from "@/components/ui/priority";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { getProject } from "@/modules/projects";
import {
  allowedTransitions,
  getTask,
  isOwnTransitionAllowed,
  listAttachments,
  listComments,
  listTaskActivity,
} from "@/modules/tasks";
import { toTimeline } from "../_components/activity";
import { CommentForm, UploadForm } from "../_components/collab-forms";
import { deleteCommentAction, removeAttachmentAction } from "../collab-actions";
import { archiveTaskAction, assignAction, changeStatusFormAction, unassignAction } from "../actions";

const compact = "min-h-8 px-2.5 text-xs";

export const metadata = { title: "Task" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  // Show the project's name (only if this user may see the project).
  const project = task.projectId ? await getProject(actor, task.projectId).catch(() => null) : null;
  const [history, comments, attachments] = await Promise.all([
    listTaskActivity(actor, id),
    listComments(actor, id),
    listAttachments(actor, id),
  ]);
  const today = todayInTz(actor.timezone);
  const overdue = task.dueDate !== null && task.dueDate < today && task.status !== "Completed" && !task.archived;
  const isAssignee = actor.employeeId !== null && task.assignees.some((a) => a.employeeId === actor.employeeId);
  const manage = can(actor, "tasks.update");
  const moves = task.archived
    ? []
    : allowedTransitions(task.status).filter(
        (to) => manage || (can(actor, "tasks.status.update.own") && isAssignee && isOwnTransitionAllowed(task.status, to)),
      );
  const canAssign = can(actor, "tasks.assign") && !task.archived;
  const candidates =
    canAssign && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !task.assignees.some((a) => a.employeeId === e.id))
      : [];
  const canArchive = can(actor, "tasks.archive") && !task.archived;
  const names = new Map<string, string>([...task.assignees.map((a) => [a.employeeId, a.fullName] as const), ...candidates.map((e) => [e.id, e.fullName] as const)]);
  const tz = actor.timezone;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/tasks">Tasks</BackLink>
      <DetailHeader
        title={task.title}
        code={task.taskCode}
        badges={
          <>
            <StatusBadge status={task.status} overdue={overdue} />
            {task.archived ? <StatusBadge status="Archived" /> : null}
          </>
        }
        facts={[
          <span key="p">
            Priority <Priority value={task.priority} />
          </span>,
          <span key="d">
            Due <DueDate value={task.dueDate} overdue={overdue} />
          </span>,
          <span key="a">{task.assignees.length === 0 ? "Unassigned" : task.assignees.map((a) => a.fullName).join(", ")}</span>,
        ]}
      />

      {moves.length > 0 || canArchive ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Task actions" role="group">
          {moves.map((to, i) => (
            <form key={to} action={changeStatusFormAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="to" value={to} />
              <button type="submit" className={buttonClass(i === 0 ? "primary" : "secondary")}>
                {task.status === "Completed" ? "Reopen" : `Move to ${to}`}
              </button>
            </form>
          ))}
          {canArchive ? (
            <ConfirmForm
              action={archiveTaskAction}
              label="Archive task"
              title="Archive this task?"
              description="It disappears from task lists and the board. Its history, comments and files are kept."
              confirmLabel="Archive task"
            >
              <input type="hidden" name="id" value={id} />
            </ConfirmForm>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {task.description ? (
            <SectionCard title="Description">
              <p className="whitespace-pre-wrap text-sm">{task.description}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Assignees" count={task.assignees.length}>
            {task.assignees.length === 0 ? (
              <p className="text-sm text-muted">Nobody is assigned yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {task.assignees.map((a) => (
                  <li key={a.employeeId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="font-medium">{a.fullName}</span>
                    {canAssign ? (
                      <ConfirmForm
                        action={unassignAction}
                        triggerClassName={compact}
                        label={
                          <>
                            Remove<span className="sr-only"> {a.fullName}</span>
                          </>
                        }
                        title={`Remove ${a.fullName}?`}
                        description="They will no longer see this task in My tasks. The task and its history are not affected."
                        confirmLabel="Remove"
                      >
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="employeeId" value={a.employeeId} />
                      </ConfirmForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {candidates.length > 0 ? (
              <form action={assignAction} className="flex flex-wrap gap-2 border-t border-border pt-3">
                <input type="hidden" name="id" value={id} />
                <select name="employeeId" aria-label="Employee to assign" required className={`${inputClass} sm:max-w-xs`}>
                  {candidates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeCode} {e.fullName}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonClass("secondary")}>
                  Assign
                </button>
              </form>
            ) : null}
          </SectionCard>

          <SectionCard title="Comments" count={comments.length}>
            {comments.length === 0 ? (
              <p className="text-sm text-muted">No comments yet.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-md bg-background p-3">
                    <p className="whitespace-pre-wrap">{c.body}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        {c.authorName} · {formatDateTime(c.createdAt, tz)}
                        {c.edited ? " · edited" : ""}
                      </span>
                      {c.authorId === actor.userId || manage ? (
                        <ConfirmForm
                          action={deleteCommentAction}
                          triggerClassName={compact}
                          label={
                            <>
                              Delete<span className="sr-only"> comment by {c.authorName}</span>
                            </>
                          }
                          title="Delete this comment?"
                          description="The comment is removed for everyone. This cannot be undone."
                          confirmLabel="Delete comment"
                        >
                          <input type="hidden" name="taskId" value={id} />
                          <input type="hidden" name="commentId" value={c.id} />
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {can(actor, "tasks.comment") && !task.archived ? (
              <div className="border-t border-border pt-3">
                <CommentForm taskId={id} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Attachments" count={attachments.length}>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted">No files attached.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {attachments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <a href={`/api/files/${a.fileId}`} className={`${linkClass} break-all font-medium`}>
                        {a.name}
                      </a>
                      <span className="block text-xs text-muted">
                        {Math.max(1, Math.round(a.size / 1024))} KB · {a.uploadedByName ?? "unknown"}
                      </span>
                    </span>
                    {a.uploadedBy === actor.userId || manage ? (
                      <ConfirmForm
                        action={removeAttachmentAction}
                        triggerClassName={compact}
                        label={
                          <>
                            Remove<span className="sr-only"> {a.name}</span>
                          </>
                        }
                        title="Remove this file?"
                        description={`${a.name} is detached from the task and can no longer be downloaded from it.`}
                        confirmLabel="Remove file"
                      >
                        <input type="hidden" name="taskId" value={id} />
                        <input type="hidden" name="attachmentId" value={a.id} />
                      </ConfirmForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {can(actor, "tasks.attach") && !task.archived ? (
              <div className="border-t border-border pt-3">
                <UploadForm taskId={id} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Activity">
            <ActivityTimeline entries={toTimeline(history, names)} timeZone={tz} />
          </SectionCard>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <DetailsList
            items={[
              { label: "Status", value: <StatusBadge status={task.status} overdue={overdue} /> },
              { label: "Priority", value: <Priority value={task.priority} /> },
              { label: "Start date", value: task.startDate },
              { label: "Due date", value: <DueDate value={task.dueDate} overdue={overdue} /> },
              { label: "Estimated", value: task.estimatedHours ? `${task.estimatedHours} h` : null },
              { label: "Actual", value: task.actualHours ? `${task.actualHours} h` : null },
              {
                label: "Project",
                value: project ? (
                  <Link href={`/projects/${project.id}`} className={linkClass}>
                    {project.projectCode} {project.name}
                  </Link>
                ) : null,
              },
              { label: "Created", value: formatDateTime(task.createdAt, tz) },
              { label: "Completed", value: task.completedAt ? formatDateTime(task.completedAt, tz) : null },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
