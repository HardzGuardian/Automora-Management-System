"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { moveTaskAction } from "../actions";

export type BoardCard = {
  id: string;
  taskCode: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  late: boolean;
  assignees: string[];
  projectName: string | null;
  /** Statuses this person may move the card to (may be empty). */
  moves: string[];
};

const COLUMNS = [
  { status: "Pending", title: "Pending" },
  { status: "In Progress", title: "In progress" },
  { status: "In Review", title: "In review" },
  { status: "Completed", title: "Completed" },
] as const;
const LABEL: Record<string, string> = { Pending: "Pending", "In Progress": "In progress", "In Review": "In review", Completed: "Completed" };

/** Kanban board. Drag a card to another column to change its status; each card also has a "Move to" list for keyboard use. */
export function TaskBoard({ cards: initial }: { cards: BoardCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [cards, setCards] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  const move = (id: string, to: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    if (!card.moves.includes(to)) {
      toast(`${card.taskCode} cannot move to ${LABEL[to] ?? to}.`, "error");
      return;
    }
    const prev = cards;
    setCards((p) => p.map((c) => (c.id === id ? { ...c, status: to } : c)));
    start(async () => {
      const r = await moveTaskAction(id, to);
      if (!r.ok) {
        setCards(prev);
        toast(r.error ?? "Could not move the task", "error");
      } else {
        toast(`${card.taskCode} moved to ${LABEL[to] ?? to}.`, "success");
      }
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[repeat(4,minmax(240px,1fr))] items-start gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const list = cards.filter((c) => c.status === col.status);
        return (
          <section
            key={col.status}
            aria-label={col.title}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.status);
            }}
            onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) move(id, col.status);
            }}
            className={cn("flex min-h-40 flex-col gap-2.5 rounded-lg bg-[#ecefec] p-3 transition-colors", over === col.status && "ring-2 ring-primary")}
          >
            <h2 className="m-0 flex justify-between px-1 text-sm font-semibold">
              <span>{col.title}</span>
              <span className="tabular-nums text-muted">{list.length}</span>
            </h2>
            {list.map((t) => (
              <article
                key={t.id}
                draggable={t.moves.length > 0}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                className={cn("flex flex-col gap-2 rounded-lg border border-border bg-surface p-3", t.moves.length > 0 && "cursor-grab active:cursor-grabbing")}
              >
                <Link href={`/tasks/${t.id}`} className="font-medium text-foreground hover:text-primary-ink">
                  {t.title}
                </Link>
                <div className="text-xs text-muted">
                  {t.taskCode} · {t.priority} priority{t.projectName ? ` · ${t.projectName}` : ""}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px]">
                    <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                      {t.assignees[0] ? t.assignees[0].slice(0, 1).toUpperCase() : "?"}
                    </span>
                    <span className="truncate">{t.assignees.length === 0 ? "Unassigned" : t.assignees.length === 1 ? t.assignees[0] : `${t.assignees[0]} +${t.assignees.length - 1}`}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs tabular-nums", t.late ? "text-danger" : "text-muted")}>{t.late ? `Overdue · ${t.dueDate}` : (t.dueDate ?? "")}</span>
                </div>
                {t.moves.length > 0 ? (
                  <select
                    aria-label={`Move ${t.title} to`}
                    value=""
                    onChange={(e) => move(t.id, e.target.value)}
                    className="h-8 rounded-md border border-field bg-surface px-2 text-xs text-muted"
                  >
                    <option value="">Move to...</option>
                    {t.moves.map((m) => (
                      <option key={m} value={m}>
                        {LABEL[m] ?? m}
                      </option>
                    ))}
                  </select>
                ) : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
