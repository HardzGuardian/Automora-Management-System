"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptState } from "./actions";

const initial: AcceptState = {};

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input name="name" required autoComplete="name" className="rounded border border-gray-300 px-3 py-2" />
        {err("name") ? <span className="text-red-600">{err("name")}</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password (at least 10 characters)
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="rounded border border-gray-300 px-3 py-2" />
        {err("password") ? <span className="text-red-600">{err("password")}</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input name="confirm" type="password" required autoComplete="new-password" className="rounded border border-gray-300 px-3 py-2" />
        {err("confirm") ? <span className="text-red-600">{err("confirm")}</span> : null}
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}
