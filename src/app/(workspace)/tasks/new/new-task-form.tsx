"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { createTaskAction, type CreateTaskState } from "../actions";

const initial: CreateTaskState = {};

type Option = { id: string; name: string };

/** The full "New task" form: details, project, client, dates, hours and any number of assignees. */
export function NewTaskForm({
  projects,
  clients,
  people,
  defaultPriority,
  defaultProjectId,
  memberMode = false,
  projectPeople,
}: {
  /** Employee mode: a project is required, there is no client, and the people list follows the chosen project. */
  memberMode?: boolean;
  projectPeople?: Record<string, Option[]>;
  projects: Option[];
  clients: Option[];
  people: (Option & { openTasks: number })[] | null;
  defaultPriority: string;
  defaultProjectId?: string;
}) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  const [project, setProject] = useState(defaultProjectId ?? (memberMode ? (projects[0]?.id ?? "") : ""));
  const teammates = memberMode ? (projectPeople?.[project] ?? []) : [];
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="nt-title" label="Title" required error={err("title")}>
        <input id="nt-title" name="title" required maxLength={200} className={inputClass} {...fieldAria("nt-title", { error: err("title") })} />
      </Field>
      <Field id="nt-desc" label="Description" error={err("description")}>
        <textarea id="nt-desc" name="description" rows={4} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="nt-project" label="Project" required={memberMode} hint={memberMode ? undefined : "Leave empty for an individual task."}>
          <select id="nt-project" name="projectId" value={project} onChange={(e) => setProject(e.target.value)} required={memberMode} className={inputClass}>
            {memberMode ? null : <option value="">No project</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {memberMode ? null : (
        <Field id="nt-client" label="Client" hint="Used for tasks without a project." error={err("clientId")}>
          <select id="nt-client" name="clientId" className={inputClass}>
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        )}
        <Field id="nt-priority" label="Priority">
          <select id="nt-priority" name="priority" defaultValue={defaultPriority} className={inputClass}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </Field>
        <Field id="nt-est" label="Estimated hours" error={err("estimatedHours")}>
          <input id="nt-est" name="estimatedHours" inputMode="decimal" className={inputClass} />
        </Field>
        <Field id="nt-start" label="Start date" error={err("startDate")}>
          <input id="nt-start" name="startDate" type="date" className={inputClass} />
        </Field>
        <Field id="nt-due" label="Due date" error={err("dueDate")}>
          <input id="nt-due" name="dueDate" type="date" className={inputClass} {...fieldAria("nt-due", { error: err("dueDate") })} />
        </Field>
      </div>
      {memberMode ? (
        <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-medium">Assign to</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border bg-surface p-2 sm:grid-cols-2">
            {teammates.map((p) => (
              <label key={`${project}-${p.id}`} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-background">
                <input type="checkbox" name="assigneeIds" value={p.id} className="size-4" />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
          <p className="m-0 text-xs text-muted">Leave everyone unticked to keep the task for yourself.</p>
        </fieldset>
      ) : null}
      {people ? (
        <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-medium">Assign to</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border bg-surface p-2 sm:grid-cols-2">
            {people.map((p) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-background">
                <input type="checkbox" name="assigneeIds" value={p.id} className="size-4" />
                <span>{p.name}</span>
                <span className="ml-auto text-xs text-muted">{p.openTasks} open</span>
              </label>
            ))}
          </div>
          <p className="m-0 text-xs text-muted">Pick one or more people.</p>
        </fieldset>
      ) : null}
      <div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}
