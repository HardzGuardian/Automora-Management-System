"use client";

import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit, NewPasswordFields, authInputClass } from "@/components/ui/auth-fields";
import { acceptInviteAction, type AcceptState } from "./actions";

const initial: AcceptState = {};

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex w-full flex-col gap-[18px]">
      <input type="hidden" name="token" value={token} />
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <AuthField id="name" label="Your name" icon="team" error={err("name")}>
        <input id="name" name="name" required autoComplete="name" placeholder="Full name" className={authInputClass} aria-invalid={err("name") ? true : undefined} />
      </AuthField>
      <NewPasswordFields errors={{ password: err("password"), confirm: err("confirm") }} />
      <AuthSubmit pending={pending} label="Create account" pendingLabel="Activating…" />
    </form>
  );
}
