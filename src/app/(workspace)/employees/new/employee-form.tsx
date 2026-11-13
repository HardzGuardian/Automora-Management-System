"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { formClass, inputClass } from "@/components/ui/styles";
import { createEmployeeAction, type EmployeeFormState } from "../actions";

const initial: EmployeeFormState = {};

const FIELDS: { name: string; label: string; type?: string; required?: boolean; hint?: string }[] = [
  { name: "fullName", label: "Full name", required: true },
  { name: "workEmail", label: "Work email", type: "email", required: true, hint: "Used to invite them to sign in later." },
  { name: "phone", label: "Phone" },
  { name: "designation", label: "Designation" },
  { name: "department", label: "Department" },
  { name: "joiningDate", label: "Joining date", type: "date" },
];

export function EmployeeForm() {
  const [state, action, pending] = useActionState(createEmployeeAction, initial);
  return (
    <form action={action} className={formClass}>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {FIELDS.map((f) => {
        const error = state.fieldErrors?.[f.name]?.[0];
        return (
          <Field key={f.name} id={f.name} label={f.label} required={f.required} error={error} hint={f.hint}>
            <input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              required={f.required}
              className={inputClass}
              {...fieldAria(f.name, { error, hint: f.hint })}
            />
          </Field>
        );
      })}
      <FormActions label="Create employee" pending={pending} cancelHref="/employees" />
    </form>
  );
}
