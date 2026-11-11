"use client";

import { useActionState } from "react";
import { createEmployeeAction, type EmployeeFormState } from "../actions";

const initial: EmployeeFormState = {};

const FIELDS: { name: string; label: string; type?: string; required?: boolean }[] = [
  { name: "fullName", label: "Full name", required: true },
  { name: "workEmail", label: "Work email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "designation", label: "Designation" },
  { name: "department", label: "Department" },
  { name: "joiningDate", label: "Joining date", type: "date" },
];

export function EmployeeForm() {
  const [state, action, pending] = useActionState(createEmployeeAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          {f.label}
          <input name={f.name} type={f.type ?? "text"} required={f.required} className="rounded border border-gray-300 px-3 py-2" />
          {state.fieldErrors?.[f.name]?.[0] ? <span className="text-red-600">{state.fieldErrors[f.name][0]}</span> : null}
        </label>
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Create employee"}
      </button>
    </form>
  );
}
