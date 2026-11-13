"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { inputClass } from "@/components/ui/styles";
import { changePasswordAction, type PasswordState } from "./actions";

const initial: PasswordState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Password changed. Other devices were signed out.</Alert> : null}
      <Field id="current" label="Current password" required>
        <input id="current" name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <Field id="next" label="New password" required hint="At least 10 characters. Other devices are signed out when you change it.">
        <input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" className={inputClass} aria-describedby="next-hint" />
      </Field>
      <Field id="confirm" label="Confirm new password" required>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
      </Field>
      <FormActions label="Change password" pending={pending} />
    </form>
  );
}
