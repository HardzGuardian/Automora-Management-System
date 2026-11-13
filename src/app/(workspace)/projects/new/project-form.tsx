"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { formClass, inputClass } from "@/components/ui/styles";
import { createProjectAction, type ProjectFormState } from "../actions";

const initial: ProjectFormState = {};
type Option = { id: string; label: string };

export function ProjectForm({ clients, employees, defaultOwnerId }: { clients: Option[]; employees: Option[]; defaultOwnerId: string | null }) {
  const [state, action, pending] = useActionState(createProjectAction, initial);
  const [type, setType] = useState<"Client" | "Internal">("Client");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className={formClass}>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="name" label="Project name" required error={err("name")}>
        <input id="name" name="name" required className={inputClass} {...fieldAria("name", { error: err("name") })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="type" label="Type" hint="Client projects belong to a client; internal ones do not.">
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "Client" | "Internal")}
            className={inputClass}
            aria-describedby="type-hint"
          >
            <option>Client</option>
            <option>Internal</option>
          </select>
        </Field>
        {type === "Client" ? (
          <Field id="clientId" label="Client" required>
            <select id="clientId" name="clientId" required className={inputClass}>
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <Field id="ownerEmployeeId" label="Owner" required hint="The owner is added to the project team.">
        <select id="ownerEmployeeId" name="ownerEmployeeId" required defaultValue={defaultOwnerId ?? ""} className={inputClass} aria-describedby="ownerEmployeeId-hint">
          <option value="">Choose an owner</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="description" label="Description">
        <textarea id="description" name="description" rows={3} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startDate" label="Start date">
          <input id="startDate" name="startDate" type="date" className={inputClass} />
        </Field>
        <Field id="dueDate" label="Due date" error={err("dueDate")}>
          <input id="dueDate" name="dueDate" type="date" className={inputClass} {...fieldAria("dueDate", { error: err("dueDate") })} />
        </Field>
      </div>
      <Field id="budgetAmount" label="Budget (optional)" error={err("budgetAmount")} hint="Up to 2 decimals. Leave empty if there is no fixed budget.">
        <input
          id="budgetAmount"
          name="budgetAmount"
          inputMode="decimal"
          placeholder="0.00"
          className={inputClass}
          {...fieldAria("budgetAmount", { error: err("budgetAmount"), hint: true })}
        />
      </Field>
      <FormActions label="Create project" pending={pending} cancelHref="/projects" />
    </form>
  );
}
