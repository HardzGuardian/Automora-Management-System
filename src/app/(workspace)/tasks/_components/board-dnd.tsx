"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { DueDate } from "@/components/ui/due-date";
import { Priority } from "@/components/ui/priority";
import { cn } from "@/lib/cn";
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
 * Columns scroll horizontally inside the board, never the page.
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
      {message ? <Alert tone="error">{message}</Alert> : null}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[64rem] grid-cols-4 gap-3" aria-busy={pending}>
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
                className={cn(
                  "flex min-h-32 flex-col gap-2 rounded-md border p-2",
                  overColumn === col ? "border-primary bg-primary-soft" : "border-border bg-background",
                )}
              >
                <h2 className="m-0 flex items-center justify-between px-1 text-sm font-semibold">
                  {col}
                  <span className="font-normal text-muted">{items.length}</span>
                </h2>
                {items.length === 0 ? <p className="px-1 text-xs text-muted">Nothing here.</p> : null}
                {items.map((t) => (
                  <article
                    key={t.id}
                    draggable={t.allowed.length > 0}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm shadow-sm",
                      t.allowed.length > 0 && "cursor-grab",
                    )}
                  >
                    <Link href={`/tasks/${t.id}`} className="font-medium underline">
                      {t.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{t.taskCode}</span>
                      <span aria-hidden="true">·</span>
                      <Priority value={t.priority} />
                    </div>
                    <p className="text-xs">
                      <span className="text-muted">Due </span>
                      <DueDate value={t.dueDate} overdue={t.overdue} />
                    </p>
                    {t.allowed.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.allowed.map((to) => (
                          <button
                            key={to}
                            type="button"
                            disabled={pending}
                            onClick={() => move(t, to)}
                            className="min-h-8 rounded-md border border-border bg-surface px-2 text-xs hover:bg-primary-soft disabled:opacity-50"
                          >
                            → {to}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
