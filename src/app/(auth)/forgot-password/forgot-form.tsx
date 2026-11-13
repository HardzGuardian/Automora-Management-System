"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { forgotPasswordAction, type ForgotState } from "./actions";

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  if (state.done) {
    return <Alert tone="success">If an account exists for that email, we have sent a link to reset the password.</Alert>;
  }
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="email" label="Email" required>
        <input id="email" name="email" type="email" required autoComplete="username" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
