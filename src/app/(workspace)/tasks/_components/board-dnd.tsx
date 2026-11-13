"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveTaskAction } from "../actions";

const COLUMNS = ["Pending", "In Progress", "In Review", "Completed"] as const;

export type BoardTask = {
  id: string;
  taskCode: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  overdue: boolean;
  /** Statuses this user may move the task to (decided on the server). */
  allowed: string[];
};

/**
 * Kanban board. Drag a card to another column, or use the buttons (touch / keyboard).
 * The browser only proposes the move; the server's status machine decides.
 */
export function BoardDnd({ tasks }: { tasks: BoardTask[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(task: BoardTask, to: string) {
    if (to === task.status) return;
    setMessage(null);
    if (!task.allowed.includes(to)) {
      setMessage(`${task.taskCode} cannot move from ${task.status} to ${to}.`);
      return;
    }
    startTransition(async () => {
      const r = await moveTaskAction(task.id, to);
      if (!r.ok) setMessage(r.error ?? "That move was not allowed.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={pending}>
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <section
              key={col}
              aria-label={col}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(col);
              }}
              onDragLeave={() => setOverColumn((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                const task = tasks.find((t) => t.id === e.dataTransfer.getData("text/plain"));
                if (task) move(task, col);
              }}
              className={`flex min-h-24 flex-col gap-2 rounded border p-2 ${overColumn === col ? "border-black bg-background" : "border-border"}`}
            >
              <h2 className="text-sm font-semibold">
                {col} ({items.length})
              </h2>
              {items.length === 0 ? <p className="text-xs text-muted">Nothing here.</p> : null}
              {items.map((t) => (
                <article
                  key={t.id}
                  draggable={t.allowed.length > 0}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className="flex cursor-grab flex-col gap-1 rounded border border-border bg-white p-2 text-sm"
                >
                  <Link href={`/tasks/${t.id}`} className="font-medium underline">
                    {t.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {t.taskCode} · {t.priority} ·{" "}
                    <span className={t.overdue ? "font-semibold text-danger" : ""}>due {t.dueDate ?? "—"}</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {t.allowed.map((to) => (
                      <button
                        key={to}
                        type="button"
                        disabled={pending}
                        onClick={() => move(t, to)}
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        → {to}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
