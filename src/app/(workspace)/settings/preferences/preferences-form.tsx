"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import type { Preferences } from "@/modules/settings";
import { savePreferencesAction, type SettingsState } from "../actions";

export function PreferencesForm({ prefs, canEdit }: { prefs: Preferences; canEdit: boolean }) {
  const [state, action, pending] = useActionState(savePreferencesAction, {} as SettingsState);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <Field id="priority" label="Default task priority" hint="Used when a new task does not specify one.">
        <select id="priority" name="tasks.defaultPriority" defaultValue={prefs["tasks.defaultPriority"]} disabled={!canEdit} className={inputClass}>
          {["Low", "Medium", "High", "Urgent"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field id="dueDays" label="Default invoice payment terms (days)" hint="Days between the issue date and the due date.">
        <input id="dueDays" name="invoices.defaultDueDays" type="number" min={0} max={365} step={1} defaultValue={prefs["invoices.defaultDueDays"]} disabled={!canEdit} className={inputClass} />
      </Field>
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
      {canEdit ? (
        <button type="submit" disabled={pending} className={buttonClass("primary", "self-start")}>
          {pending ? "Saving…" : "Save preferences"}
        </button>
      ) : null}
    </form>
  );
}
