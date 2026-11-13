"use client";

import { useActionState } from "react";
import { createTaskAction, type TaskFormState } from "../actions";

const initial: TaskFormState = {};
type Option = { id: string; label: string };

export function TaskForm({ projects, employees }: { projects: Option[]; employees: Option[] }) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  const input = "rounded border border-border px-3 py-2";
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input name="title" required className={input} />
        {err("title") ? <span className="text-danger">{err("title")}</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea name="description" rows={4} className={input} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Priority
          <select name="priority" defaultValue="Medium" className={input}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Estimated hours
          <input name="estimatedHours" inputMode="decimal" className={input} />
          {err("estimatedHours") ? <span className="text-danger">{err("estimatedHours")}</span> : null}
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Project (optional)
        <select name="projectId" className={input}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Start date
          <input name="startDate" type="date" className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Due date
          <input name="dueDate" type="date" className={input} />
          {err("dueDate") ? <span className="text-danger">{err("dueDate")}</span> : null}
        </label>
      </div>
      {employees.length > 0 ? (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>Assign to</legend>
          <div className="max-h-40 overflow-y-auto rounded border border-border p-2">
            {employees.map((e) => (
              <label key={e.id} className="flex items-center gap-2">
                <input type="checkbox" name="assigneeIds" value={e.id} /> {e.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Create task"}
      </button>
    </form>
  );
}
