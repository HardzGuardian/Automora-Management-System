"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { updateProjectAction, type EditProjectState } from "../../actions";

const initial: EditProjectState = {};

type Props = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  budgetAmount: string | null;
  currency: string;
  canSeeBudget: boolean;
};

/** Change a project's details after it was created. */
export function EditProjectForm(p: Props) {
  const [state, action, pending] = useActionState(updateProjectAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={p.id} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.saved ? <Alert tone="success">Saved.</Alert> : null}
      <Field id="ep-name" label="Project name" required error={err("name")}>
        <input id="ep-name" name="name" defaultValue={p.name} required maxLength={160} className={inputClass} {...fieldAria("ep-name", { error: err("name") })} />
      </Field>
      <Field id="ep-desc" label="Description" error={err("description")}>
        <textarea id="ep-desc" name="description" rows={4} defaultValue={p.description ?? ""} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ep-start" label="Start date" error={err("startDate")}>
          <input id="ep-start" name="startDate" type="date" defaultValue={p.startDate ?? ""} className={inputClass} />
        </Field>
        <Field id="ep-due" label="Due date" error={err("dueDate")}>
          <input id="ep-due" name="dueDate" type="date" defaultValue={p.dueDate ?? ""} className={inputClass} {...fieldAria("ep-due", { error: err("dueDate") })} />
        </Field>
        {p.canSeeBudget ? (
          <Field id="ep-budget" label={`Budget (${p.currency})`} error={err("budgetAmount")}>
            <input id="ep-budget" name="budgetAmount" inputMode="decimal" defaultValue={p.budgetAmount ?? ""} className={inputClass} />
          </Field>
        ) : null}
      </div>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Save project"}
        </button>
      </div>
    </form>
  );
}
