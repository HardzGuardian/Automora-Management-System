"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotState } from "./actions";

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  if (state.done) {
    return (
      <p role="status" className="max-w-sm text-sm">
        If an account exists for that email, we have sent a link to reset the password.
      </p>
    );
  }
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="username" className="rounded border border-gray-300 px-3 py-2" />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
