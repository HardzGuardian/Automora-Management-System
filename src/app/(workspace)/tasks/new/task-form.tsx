"use client";

import { useActionState } from "react";
import { MoreOptions } from "@/components/forms/more-options";
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
          </select>
        </Field>
        <Field id="dueDate" label="Due date" error={err("dueDate")}>
          <input id="dueDate" name="dueDate" type="date" className={inputClass} {...fieldAria("dueDate", { error: err("dueDate") })} />
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
      {employees.length > 0 ? (
        <Field id="assigneeIds" label="Assign to" hint="One person owns each task.">
          <select id="assigneeIds" name="assigneeIds" defaultValue="" className={inputClass} aria-describedby="assigneeIds-hint">
            <option value="">Nobody yet</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <MoreOptions>
        <Field id="startDate" label="Start date">
          <input id="startDate" name="startDate" type="date" className={inputClass} />
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
      </MoreOptions>
      <FormActions label="Create task" pending={pending} cancelHref="/tasks" />
    </form>
  );
}
