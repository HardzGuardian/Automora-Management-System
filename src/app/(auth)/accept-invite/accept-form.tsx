"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { acceptInviteAction, type AcceptState } from "./actions";

const initial: AcceptState = {};
const PASSWORD_HINT = "At least 10 characters.";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="name" label="Your name" required error={err("name")}>
        <input id="name" name="name" required autoComplete="name" className={inputClass} {...fieldAria("name", { error: err("name") })} />
      </Field>
      <Field id="password" label="Password" required error={err("password")} hint={PASSWORD_HINT}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={inputClass}
          {...fieldAria("password", { error: err("password"), hint: PASSWORD_HINT })}
        />
      </Field>
      <Field id="confirm" label="Confirm password" required error={err("confirm")}>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} {...fieldAria("confirm", { error: err("confirm") })} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}
