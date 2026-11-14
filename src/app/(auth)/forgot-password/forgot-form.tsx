"use client";

import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit, authInputClass } from "@/components/ui/auth-fields";
import { Icon } from "@/components/ui/icons";
import { forgotPasswordAction, type ForgotState } from "./actions";

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  if (state.done) {
    return (
      <div role="status" className="flex flex-col items-start gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-[#e6f4ec] text-primary">
          <Icon name="mail" size={28} />
        </span>
        <div>
          <div className="text-xl font-bold tracking-tight">Check your email</div>
          <p className="mb-0 mt-1.5 leading-normal text-muted">
            If an account exists for that address, a reset link is on its way. The link works once and expires in 1 hour.
          </p>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="flex w-full flex-col gap-[18px]">
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <AuthField id="email" label="Email" icon="mail">
        <input id="email" name="email" type="email" required autoComplete="username" placeholder="name@company.com" className={authInputClass} />
      </AuthField>
      <AuthSubmit pending={pending} label="Send reset link" pendingLabel="Sending…" />
    </form>
  );
}
