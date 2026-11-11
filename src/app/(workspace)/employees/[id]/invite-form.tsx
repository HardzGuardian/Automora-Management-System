"use client";

import { useActionState } from "react";
import { inviteEmployeeAction, type InviteState } from "../actions";

const initial: InviteState = {};

export function InviteForm({
  employeeId,
  email,
  roles,
}: {
  employeeId: string;
  email: string;
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(inviteEmployeeAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="email" value={email} />
      <label className="flex flex-col gap-1 text-sm">
        Role for {email}
        <select name="roleId" required className="rounded border border-gray-300 px-3 py-2">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.acceptUrl ? (
        <p role="status" className="break-all text-sm text-green-700">
          Invitation created (and emailed if mail is configured). Link: {state.acceptUrl}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Inviting…" : "Send invitation"}
      </button>
    </form>
  );
}
