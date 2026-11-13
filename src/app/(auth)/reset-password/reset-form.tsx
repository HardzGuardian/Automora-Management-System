"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { resetPasswordAction, type ResetState } from "./actions";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="password" label="New password" required hint="At least 10 characters.">
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" aria-describedby="password-hint" className={inputClass} />
      </Field>
      <Field id="confirm" label="Confirm new password" required>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
