"use client";

import { useActionState, useState } from "react";
import { createProjectAction, type ProjectFormState } from "../actions";

const initial: ProjectFormState = {};
type Option = { id: string; label: string };

export function ProjectForm({ clients, employees, defaultOwnerId }: { clients: Option[]; employees: Option[]; defaultOwnerId: string | null }) {
  const [state, action, pending] = useActionState(createProjectAction, initial);
  const [type, setType] = useState<"Client" | "Internal">("Client");
  const input = "rounded border border-border px-3 py-2";
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Project name
        <input name="name" required className={input} />
        {err("name") ? <span className="text-danger">{err("name")}</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="type" value={type} onChange={(e) => setType(e.target.value as "Client" | "Internal")} className={input}>
          <option>Client</option>
          <option>Internal</option>
        </select>
      </label>
      {type === "Client" ? (
        <label className="flex flex-col gap-1 text-sm">
          Client
          <select name="clientId" required className={input}>
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Owner
        <select name="ownerEmployeeId" required defaultValue={defaultOwnerId ?? ""} className={input}>
          <option value="">Choose an owner</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea name="description" rows={3} className={input} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Start date
          <input name="startDate" type="date" className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Due date
          <input name="dueDate" type="date" className={input} />
          {err("dueDate") ? <span className="text-danger">{err("dueDate")}</span> : null}
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Budget (optional)
        <input name="budgetAmount" inputMode="decimal" placeholder="0.00" className={input} />
        {err("budgetAmount") ? <span className="text-danger">{err("budgetAmount")}</span> : null}
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Create project"}
      </button>
    </form>
  );
}
