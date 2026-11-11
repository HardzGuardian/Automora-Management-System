"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "./actions";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        New password (at least 10 characters)
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <input name="confirm" type="password" required autoComplete="new-password" className="rounded border border-gray-300 px-3 py-2" />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
