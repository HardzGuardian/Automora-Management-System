"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { updateTaskAction, type TaskFormState } from "../actions";

const initial: TaskFormState = {};

type Props = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
};

/** Change a task's details after it was created (people with tasks.update). */
export function EditTaskForm(t: Props) {
  const [state, action, pending] = useActionState(updateTaskAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t.id} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.saved ? <Alert tone="success">Saved.</Alert> : null}
      <Field id="et-title" label="Title" required error={err("title")}>
        <input id="et-title" name="title" defaultValue={t.title} required maxLength={200} className={inputClass} {...fieldAria("et-title", { error: err("title") })} />
      </Field>
      <Field id="et-desc" label="Description">
        <textarea id="et-desc" name="description" rows={4} defaultValue={t.description ?? ""} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="et-priority" label="Priority">
          <select id="et-priority" name="priority" defaultValue={t.priority} className={inputClass}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </Field>
        <Field id="et-due" label="Due date" error={err("dueDate")}>
          <input id="et-due" name="dueDate" type="date" defaultValue={t.dueDate ?? ""} className={inputClass} {...fieldAria("et-due", { error: err("dueDate") })} />
        </Field>
        <Field id="et-start" label="Start date" error={err("startDate")}>
          <input id="et-start" name="startDate" type="date" defaultValue={t.startDate ?? ""} className={inputClass} />
        </Field>
        <Field id="et-est" label="Estimated hours" error={err("estimatedHours")}>
          <input id="et-est" name="estimatedHours" inputMode="decimal" defaultValue={t.estimatedHours ?? ""} className={inputClass} />
        </Field>
        <Field id="et-actual" label="Actual hours" error={err("actualHours")}>
          <input id="et-actual" name="actualHours" inputMode="decimal" defaultValue={t.actualHours ?? ""} className={inputClass} />
        </Field>
      </div>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Save task"}
        </button>
      </div>
    </form>
  );
}
