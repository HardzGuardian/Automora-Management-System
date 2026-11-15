"use client";

import { useActionState } from "react";
import { AuthAlert, AuthSubmit, NewPasswordFields } from "@/components/ui/auth-fields";
import { resetPasswordAction, type ResetState } from "./actions";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="flex w-full flex-col gap-[18px]">
      <input type="hidden" name="token" value={token} />
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <NewPasswordFields />
      <AuthSubmit pending={pending} label="Set new password" pendingLabel="Saving…" />
    </form>
  );
}
