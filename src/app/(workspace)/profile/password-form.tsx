"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { changePasswordAction, type PasswordState } from "./actions";

const initial: PasswordState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Password changed. Your other devices were signed out.</Alert> : null}
      <Field id="current" label="Current password">
        <input id="current" name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <Field id="next" label="New password" hint="At least 10 characters.">
        <input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" className={inputClass} aria-describedby="next-hint" />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
      </Field>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary", "px-5 font-semibold")}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
