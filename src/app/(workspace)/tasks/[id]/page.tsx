import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Chatter, type ChatterEntry } from "@/components/ui/chatter";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DueDate } from "@/components/ui/due-date";
import { Field } from "@/components/ui/field";
import { formatDateTime } from "@/components/ui/format";
import { FieldGrid, FormView, SheetTitle, SmartButtons, StatusBar, type Stage } from "@/components/ui/odoo";
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
import { allowedTransitions, getTask, isOwnTransitionAllowed, listAttachments, listComments, listTaskActivity } from "@/modules/tasks";
import { toTimeline } from "../_components/activity";
import { CommentForm, UploadForm } from "../_components/collab-forms";
import { deleteCommentAction, removeAttachmentAction } from "../collab-actions";
import { addAssigneeAction, archiveTaskAction, changeStatusFormAction, removeAssigneeAction, logHoursAction, restoreTaskAction } from "../actions";

const compact = "min-h-8 px-2.5 text-xs";
/** The task stages in order, for the status bar. */
const TASK_STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;

export const metadata = { title: "Task" };

export default async function TaskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
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
  const [history, comments, attachments] = await Promise.all([listTaskActivity(actor, id), listComments(actor, id), listAttachments(actor, id)]);
  const today = todayInTz(actor.timezone);
  const overdue = task.dueDate !== null && task.dueDate < today && task.status !== "Completed" && !task.archived;
  const isAssignee = actor.employeeId !== null && task.assignees.some((a) => a.employeeId === actor.employeeId);
  const manage = can(actor, "tasks.update");
  const moves = task.archived
    ? []
    : allowedTransitions(task.status).filter((to) => manage || (can(actor, "tasks.status.update.own") && isAssignee && isOwnTransitionAllowed(task.status, to)));
  const canAssign = can(actor, "tasks.assign") && !task.archived;
  const candidates =
    canAssign && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !task.assignees.some((a) => a.employeeId === e.id))
      : [];
  const canArchive = can(actor, "tasks.archive") && !task.archived;
  const names = new Map<string, string>([...task.assignees.map((a) => [a.employeeId, a.fullName] as const), ...candidates.map((e) => [e.id, e.fullName] as const)]);
  const tz = actor.timezone;

  const current = TASK_STATUSES.indexOf(task.status as (typeof TASK_STATUSES)[number]);
  const stages: Stage[] = TASK_STATUSES.map((s, i) => ({ key: s, label: s, state: i < current ? "done" : i === current ? "current" : "todo" }));

  const chatter: ChatterEntry[] = [
    ...comments.map<ChatterEntry>((c) => ({
      id: `c-${c.id}`,
      author: c.authorName,
      at: c.createdAt,
      kind: "message",
      body: (
        <>
          {c.body}
          {c.edited ? <span className="ml-1 text-xs text-muted">(edited)</span> : null}
        </>
      ),
      actions:
        c.authorId === actor.userId || manage ? (
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
        ) : undefined,
    })),
    ...toTimeline(history, names).map<ChatterEntry>((h) => ({ id: `h-${h.id}`, author: h.actor, at: h.at, kind: "change", body: h.text })),
  ];

  return (
    <FormView
      crumbs={[project ? { label: project.name, href: `/projects/${project.id}` } : { label: "Tasks", href: "/tasks" }, { label: task.title }]}
      toolbar={
        manage && !task.archived ? (
          <Link href={`/tasks/${id}/edit`} className={buttonClass("secondary", "min-h-9")}>
            Edit task
          </Link>
        ) : null
      }
      actions={
        <>
          {task.archived && can(actor, "tasks.archive") ? (
            <form action={restoreTaskAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={id} />
              <button type="submit" className={buttonClass("primary", "min-h-9")}>
                Restore task
              </button>
              <span className="text-sm text-muted">This task is archived and hidden from the lists.</span>
            </form>
          ) : null}
          {moves.length > 0 || canArchive ? (
            <div className="flex flex-wrap items-center gap-2" aria-label="Task actions" role="group">
              {moves.map((to, i) => (
                <form key={to} action={changeStatusFormAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value={to} />
                  <button type="submit" className={buttonClass(i === 0 ? "primary" : "secondary", "min-h-9")}>
                    {task.status === "Completed" ? "Reopen" : `Move to ${to}`}
                  </button>
                </form>
              ))}
              {canArchive ? (
                <ConfirmForm
                  action={archiveTaskAction}
                  label="Archive task"
                  triggerClassName="min-h-9"
                  title="Archive this task?"
                  description="It disappears from task lists and the board. Its history, comments and files are kept."
                  confirmLabel="Archive task"
                >
                  <input type="hidden" name="id" value={id} />
                </ConfirmForm>
              ) : null}
            </div>
          ) : null}
        </>
      }
      statusbar={<StatusBar label="Task stage" stages={stages} />}
      chatter={
        <Chatter
          entries={chatter}
          timeZone={tz}
          composer={can(actor, "tasks.comment") && !task.archived ? <CommentForm taskId={id} /> : undefined}
          empty="No comments or changes yet."
        />
      }
    >
      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error.slice(0, 300)}</Alert>
        </div>
      ) : null}
      <SheetTitle
        code={task.taskCode}
        title={task.title}
        badges={
          <>
            {overdue ? <StatusBadge status={task.status} overdue /> : null}
            {task.archived ? <StatusBadge status="Archived" /> : null}
          </>
        }
        smart={
          <SmartButtons
            items={[
              { icon: "team", value: task.assignees.length, label: task.assignees.length === 1 ? "Assignee" : "Assignees" },
              { icon: "comment", value: comments.length, label: "Comments" },
              { icon: "documents", value: attachments.length, label: "Files" },
              { icon: "pending", value: `${task.actualHours ?? 0}${task.estimatedHours ? ` / ${task.estimatedHours}` : ""} h`, label: "Hours spent" },
            ]}
          />
        }
      />

      <FieldGrid
        items={[
          {
            label: "Project",
            value: project ? (
              <Link href={`/projects/${project.id}`} className={linkClass}>
                {project.projectCode} {project.name}
              </Link>
            ) : (
              <span className="text-muted">Individual task</span>
            ),
          },
          { label: "Assigned to", value: task.assignees.length === 0 ? <span className="text-muted">Unassigned</span> : task.assignees.map((a) => a.fullName).join(", ") },
          { label: "Status", value: <StatusBadge status={task.status} overdue={overdue} /> },
          { label: "Priority", value: <Priority value={task.priority} /> },
          { label: "Start date", value: task.startDate },
          { label: "Due date", value: <DueDate value={task.dueDate} overdue={overdue} /> },
          { label: "Estimated", value: task.estimatedHours ? `${task.estimatedHours} h` : null },
          { label: "Actual", value: task.actualHours ? `${task.actualHours} h` : null },
          { label: "Created", value: formatDateTime(task.createdAt, tz) },
          { label: "Completed", value: task.completedAt ? formatDateTime(task.completedAt, tz) : null },
        ]}
      />

      {task.description ? (
        <SectionCard title="Description" className="mt-6">
          <p className="whitespace-pre-wrap text-sm">{task.description}</p>
        </SectionCard>
      ) : null}

      {isAssignee && !manage && !task.archived ? (
        <SectionCard title="Your time" className="mt-6">
          <form action={logHoursAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <Field id="log-hours" label="Hours you have spent so far" hint="A running total. Change it any time.">
              <input id="log-hours" name="hours" inputMode="decimal" required defaultValue={task.actualHours ?? ""} aria-describedby="log-hours-hint" className={`${inputClass} w-40`} />
            </Field>
            <button type="submit" className={buttonClass("secondary")}>
              Save hours
            </button>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Assigned to" count={task.assignees.length} className="mt-6">
        {task.assignees.length === 0 ? (
          <p className="text-sm text-muted">Nobody is assigned yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {task.assignees.map((a) => (
              <li key={a.employeeId} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                    {a.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  {a.fullName}
                  {a.viaTeamId ? <span className="text-xs font-normal text-muted">via team</span> : null}
                </span>
                {canAssign && !a.viaTeamId ? (
                  <form action={removeAssigneeAction}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="employeeId" value={a.employeeId} />
                    <button type="submit" className={`${buttonClass("secondary")} ${compact}`} aria-label={`Remove ${a.fullName}`}>
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 ? (
          <form action={addAssigneeAction} className="flex flex-wrap gap-2 pt-1">
            <input type="hidden" name="id" value={id} />
            <select name="employeeId" aria-label="Person to add" required className={`${inputClass} sm:max-w-xs`}>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass("secondary")}>
              Add person
            </button>
          </form>
        ) : null}
      </SectionCard>

      <SectionCard title="Attachments" count={attachments.length} className="mt-6">
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
          <div className="pt-1">
            <UploadForm taskId={id} />
          </div>
        ) : null}
      </SectionCard>
    </FormView>
  );
}
