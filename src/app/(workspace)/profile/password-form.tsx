"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "./actions";

const initial: PasswordState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  const input = "rounded border border-border px-3 py-2";
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Current password
        <input name="current" type="password" required autoComplete="current-password" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input name="next" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <input name="confirm" type="password" required autoComplete="new-password" className={input} />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          Password changed. Other devices were signed out.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
