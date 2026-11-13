"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { formClass, inputClass } from "@/components/ui/styles";
import { createTaskAction, type TaskFormState } from "../actions";

const initial: TaskFormState = {};
type Option = { id: string; label: string };

export function TaskForm({ projects, employees }: { projects: Option[]; employees: Option[] }) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className={formClass}>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="title" label="Title" required error={err("title")}>
        <input id="title" name="title" required className={inputClass} {...fieldAria("title", { error: err("title") })} />
      </Field>
      <Field id="description" label="Description" hint="Optional. What needs to be done and what done looks like.">
        <textarea id="description" name="description" rows={4} className={inputClass} aria-describedby="description-hint" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="priority" label="Priority">
          <select id="priority" name="priority" defaultValue="Medium" className={inputClass}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </Field>
        <Field id="estimatedHours" label="Estimated hours" error={err("estimatedHours")}>
          <input
            id="estimatedHours"
            name="estimatedHours"
            inputMode="decimal"
            className={inputClass}
            {...fieldAria("estimatedHours", { error: err("estimatedHours") })}
          />
        </Field>
      </div>
      <Field id="projectId" label="Project (optional)">
        <select id="projectId" name="projectId" className={inputClass}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startDate" label="Start date">
          <input id="startDate" name="startDate" type="date" className={inputClass} />
        </Field>
        <Field id="dueDate" label="Due date" error={err("dueDate")}>
          <input id="dueDate" name="dueDate" type="date" className={inputClass} {...fieldAria("dueDate", { error: err("dueDate") })} />
        </Field>
      </div>
      {employees.length > 0 ? (
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 p-0 text-sm font-medium">Assign to</legend>
          <div className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-border bg-surface p-1">
            {employees.map((e) => (
              <label key={e.id} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-background">
                <input type="checkbox" name="assigneeIds" value={e.id} className="size-4 accent-primary" /> {e.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <FormActions label="Create task" pending={pending} cancelHref="/tasks" />
    </form>
  );
}
