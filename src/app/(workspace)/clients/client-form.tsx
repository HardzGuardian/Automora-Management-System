"use client";

import { useActionState } from "react";
import type { ClientDTO } from "@/modules/clients";
import { createClientAction, updateClientAction, type ClientFormState } from "./actions";

const initial: ClientFormState = {};
const FIELDS = [
  { name: "name", label: "Client name", required: true },
  { name: "contactPerson", label: "Contact person" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address" },
  { name: "serviceType", label: "Service type" },
] as const;

export function ClientForm({ client }: { client?: ClientDTO }) {
  const [state, action, pending] = useActionState(client ? updateClientAction : createClientAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          {f.label}
          <input
            name={f.name}
            type={"type" in f ? f.type : "text"}
            required={"required" in f}
            defaultValue={client ? (client[f.name] ?? "") : ""}
            className="rounded border border-border px-3 py-2"
          />
          {state.fieldErrors?.[f.name]?.[0] ? <span className="text-danger">{state.fieldErrors[f.name][0]}</span> : null}
        </label>
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-success">
          Saved.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : client ? "Save changes" : "Create client"}
      </button>
    </form>
  );
}
