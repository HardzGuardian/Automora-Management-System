"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { inputClass } from "@/components/ui/styles";
import { inviteEmployeeAction, type InviteState } from "../actions";

const initial: InviteState = {};

export function InviteForm({
  employeeId,
  email,
  roles,
}: {
  employeeId: string;
  email: string;
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(inviteEmployeeAction, initial);
  return (
    <form action={action} className="flex w-full max-w-xl flex-col gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="email" value={email} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.acceptUrl ? (
        <Alert tone="success">
          <span className="break-all">Invitation created (and emailed if mail is configured). Link: {state.acceptUrl}</span>
        </Alert>
      ) : null}
      <Field id="roleId" label={`Role for ${email}`} required hint="The role decides what they can see and do.">
        <select id="roleId" name="roleId" required className={inputClass} aria-describedby="roleId-hint">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <FormActions label="Send invitation" pendingLabel="Inviting…" pending={pending} />
    </form>
  );
}
