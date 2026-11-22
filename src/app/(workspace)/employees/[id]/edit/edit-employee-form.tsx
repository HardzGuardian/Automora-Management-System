"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { updateEmployeeAction, type EditEmployeeState } from "../../actions";

const initial: EditEmployeeState = {};

type Props = {
  id: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  designation: string | null;
  joiningDate: string | null;
};

const FIELDS = [
  { name: "fullName", label: "Full name", type: "text", required: true },
  { name: "workEmail", label: "Work email", type: "email", required: true },
  { name: "designation", label: "Designation", type: "text", required: false },
  { name: "phone", label: "Phone", type: "tel", required: false },
  { name: "joiningDate", label: "Joining date", type: "date", required: false },
] as const;

/** Edit a person's details. Inside the modal, saving closes it; on the full page it shows "Saved" and returns to the profile. */
export function EditEmployeeForm(p: Props) {
  const [state, action, pending] = useActionState(updateEmployeeAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state.saved) return;
    const dialog = ref.current?.closest("dialog");
    if (dialog) dialog.close();
    else router.push(`/employees/${p.id}`);
  }, [state.saved, p.id, router]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={p.id} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const error = state.fieldErrors?.[f.name]?.[0];
          const id = `ee-${f.name}`;
          return (
            <Field key={f.name} id={id} label={f.label} required={f.required} error={error}>
              <input
                id={id}
                name={f.name}
                type={f.type}
                required={f.required}
                defaultValue={p[f.name] ?? ""}
                maxLength={f.name === "workEmail" ? 254 : 120}
                className={inputClass}
                {...fieldAria(id, { error })}
              />
            </Field>
          );
        })}
      </div>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Save employee"}
        </button>
      </div>
    </form>
  );
}
