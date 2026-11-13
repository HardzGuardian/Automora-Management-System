import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import {
  allowedTransitions,
  getTask,
  isOwnTransitionAllowed,
  listAttachments,
  listComments,
  listTaskActivity,
} from "@/modules/tasks";
import { CommentForm, UploadForm } from "../_components/collab-forms";
import { deleteCommentAction, removeAttachmentAction } from "../collab-actions";
import { archiveTaskAction, assignAction, changeStatusFormAction, unassignAction } from "../actions";

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
  const btn = "rounded border border-border px-3 py-2";

  return (
    <main className="flex flex-col gap-6">
      <Link href="/tasks" className="text-sm underline">
        ← Tasks
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <p className="text-sm text-muted">
          {task.taskCode} · {task.status} · {task.priority} ·{" "}
          <span className={overdue ? "font-semibold text-danger" : ""}>
            due {task.dueDate ?? "—"}
            {overdue ? " (overdue)" : ""}
          </span>
          {task.archived ? " · Archived" : ""}
        </p>
        {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm">{task.description}</p> : null}
        <p className="text-sm text-muted">
          Estimated {task.estimatedHours ?? "—"} h · actual {task.actualHours ?? "—"} h
        </p>
      </header>

      {moves.length > 0 ? (
        <section className="flex flex-wrap gap-2" aria-label="Change status">
          {moves.map((to) => (
            <form key={to} action={changeStatusFormAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="to" value={to} />
              <button type="submit" className={btn}>
                {task.status === "Completed" ? "Reopen" : `Move to ${to}`}
              </button>
            </form>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Assignees ({task.assignees.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {task.assignees.map((a) => (
            <li key={a.employeeId} className="flex items-center gap-3">
              {a.fullName}
              {canAssign ? (
                <form action={unassignAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="employeeId" value={a.employeeId} />
                  <button type="submit" className="underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {candidates.length > 0 ? (
          <form action={assignAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={id} />
            <select name="employeeId" aria-label="Employee to assign" required className="rounded border border-border px-3 py-2">
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} {e.fullName}
                </option>
              ))}
            </select>
            <button type="submit" className={btn}>
              Assign
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Comments ({comments.length})</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {comments.map((c) => (
            <li key={c.id} className="rounded border border-border p-2">
              <p className="whitespace-pre-wrap">{c.body}</p>
              <div className="flex items-center gap-3 text-xs text-muted">
                {c.authorName} · {c.createdAt.toLocaleString()}
                {c.edited ? " · edited" : ""}
                {c.authorId === actor.userId || manage ? (
                  <form action={deleteCommentAction}>
                    <input type="hidden" name="taskId" value={id} />
                    <input type="hidden" name="commentId" value={c.id} />
                    <button type="submit" className="underline">
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {can(actor, "tasks.comment") && !task.archived ? <CommentForm taskId={id} /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Attachments ({attachments.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <a href={`/api/files/${a.fileId}`} className="underline">
                {a.name}
              </a>
              <span className="text-xs text-muted">
                {Math.max(1, Math.round(a.size / 1024))} KB · {a.uploadedByName ?? "unknown"}
              </span>
              {a.uploadedBy === actor.userId || manage ? (
                <form action={removeAttachmentAction}>
                  <input type="hidden" name="taskId" value={id} />
                  <input type="hidden" name="attachmentId" value={a.id} />
                  <button type="submit" className="underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {can(actor, "tasks.attach") && !task.archived ? <UploadForm taskId={id} /> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Activity</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {history.map((h) => (
            <li key={h.id}>
              <span className="text-muted">{h.createdAt.toLocaleString()}</span> · {h.actorName ?? "System"} · {h.action}
              {h.newValue ? ` → ${JSON.stringify(h.newValue)}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {can(actor, "tasks.archive") && !task.archived ? (
        <form action={archiveTaskAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={btn}>
            Archive task
          </button>
        </form>
      ) : null}
    </main>
  );
}
