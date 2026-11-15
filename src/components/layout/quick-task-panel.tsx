"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icons";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

export type QuickTaskOptions = {
  projects: { id: string; name: string }[];
  people: { id: string; name: string; designation: string | null; openTasks: number }[];
};
export type QuickTaskForm = { title: string; projectId: string; assigneeId: string; dueDate: string; priority: string };
export type QuickTaskResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
/** Server actions passed in from the page, so this component stays free of module imports. */
export type QuickTaskActions = {
  load: () => Promise<{ ok: true; options: QuickTaskOptions } | { ok: false; error: string }>;
  create: (input: QuickTaskForm) => Promise<QuickTaskResult>;
};

const PRIORITIES = ["Low", "Medium", "High"] as const;

type Form = QuickTaskForm;
const EMPTY: Form = { title: "", projectId: "", assigneeId: "", dueDate: "", priority: "Medium" };

/** Admin shortcut from the top bar: a right-hand panel that makes one task without leaving the page. */
export function QuickTaskButton({ actions }: { actions: QuickTaskActions }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<QuickTaskOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => setCreated(false);
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  const open = () => {
    setForm(EMPTY);
    setError(null);
    setFieldErrors({});
    setCreated(false);
    ref.current?.showModal();
    // Fresh counts every time: someone may have been given work since the last open.
    start(async () => {
      const r = await actions.load();
      if (r.ok) {
        setOptions(r.options);
        setLoadError(null);
      } else setLoadError(r.error);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await actions.create(form);
      if (r.ok) {
        setCreated(true);
        return;
      }
      setError(r.error);
      setFieldErrors(r.fieldErrors ?? {});
    });
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <>
      <button type="button" onClick={open} className={cn(buttonClass("primary"), "gap-2")}>
        <Icon name="plus" size={18} />
        New task
      </button>

      <dialog
        ref={ref}
        aria-labelledby="quick-task-title"
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-md border-l border-border bg-surface p-0 text-body backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="quick-task-title" className="text-lg font-semibold text-foreground">
              {created ? "Task created" : "New task"}
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="flex size-11 items-center justify-center rounded-md hover:bg-primary-soft">
              <Icon name="close" />
            </button>
          </div>

          {created ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
                <Icon name="check" size={28} />
              </span>
              <p className="text-base font-medium text-foreground">The assignee has been notified.</p>
              <div className="flex gap-2">
                <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()}>
                  Done
                </button>
                <button
                  type="button"
                  className={buttonClass("primary")}
                  onClick={() => {
                    setForm(EMPTY);
                    setCreated(false);
                  }}
                >
                  Add another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto" noValidate>
              <div className="flex flex-1 flex-col gap-5 p-5">
                {loadError ? (
                  <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                    {loadError}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                    {error}
                  </p>
                ) : null}

                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Task title <span aria-hidden="true" className="text-danger">*</span><span className="sr-only"> (required)</span>
                  <input
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    className={inputClass}
                    placeholder="What needs doing?"
                    aria-invalid={fe("title") ? true : undefined}
                    required
                  />
                  {fe("title") ? <span className="text-sm font-normal text-danger">{fe("title")}</span> : null}
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Project <span aria-hidden="true" className="text-danger">*</span><span className="sr-only"> (required)</span>
                  <select value={form.projectId} onChange={(e) => set("projectId", e.target.value)} className={inputClass}>
                    <option value="">Choose a project</option>
                    {options?.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-medium text-foreground">Assign to <span aria-hidden="true" className="text-danger">*</span><span className="sr-only"> (required)</span></legend>
                  {!options ? <p className="text-sm text-muted">Loading people…</p> : null}
                  <div className="flex flex-col gap-2">
                    {options?.people.map((p) => {
                      const on = form.assigneeId === p.id;
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                            on ? "border-primary bg-primary-soft" : "border-field bg-surface hover:bg-primary-soft",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input type="radio" name="assignee" value={p.id} checked={on} onChange={() => set("assigneeId", p.id)} className="size-4 accent-primary" />
                            <span className="font-medium text-foreground">{p.name}</span>
                          </span>
                          <span className="text-xs text-muted">{p.openTasks} open</span>
                        </label>
                      );
                    })}
                  </div>
                  {fe("assigneeIds") ? <span className="text-sm text-danger">{fe("assigneeIds")}</span> : null}
                </fieldset>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Due date
                  <input type="date" value={form.dueDate} min={new Date().toLocaleDateString("en-CA")} onChange={(e) => set("dueDate", e.target.value)} className={inputClass} />
                  {fe("dueDate") ? <span className="text-sm font-normal text-danger">{fe("dueDate")}</span> : null}
                </label>

                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-foreground">Priority</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITIES.map((p) => (
                      <label
                        key={p}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium",
                          form.priority === p ? "border-primary bg-primary-soft text-primary-ink" : "border-field bg-surface text-body hover:bg-primary-soft",
                        )}
                      >
                        <input type="radio" name="priority" value={p} checked={form.priority === p} onChange={() => set("priority", p)} className="sr-only" />
                        {p}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex gap-2 border-t border-border p-4">
                <button type="submit" disabled={pending || !form.title.trim() || !form.projectId || !form.assigneeId} className={cn(buttonClass("primary"), "flex-1")}>
                  {pending ? "Creating…" : "Create task"}
                </button>
                <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
