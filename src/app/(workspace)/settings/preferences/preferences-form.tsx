"use client";

import { useActionState } from "react";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { Field } from "@/components/ui/field";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import type { Preferences } from "@/modules/settings";
import { savePreferencesAction, type SettingsState } from "../actions";

export function PreferencesForm({ prefs, canEdit }: { prefs: Preferences; canEdit: boolean }) {
  const [state, action, pending] = useActionState(savePreferencesAction, {} as SettingsState);
  return (
    <form action={action} className={`${cardClass} flex max-w-xl flex-col gap-4`}>
      <div>
        <h2 className="m-0 text-base font-semibold">Defaults</h2>
        <p className="mt-1 text-sm text-muted">Starting values for new tasks and invoices. People can still change them on each record.</p>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Field id="priority" label="Default task priority" hint="Used when a new task does not specify one.">
        <select id="priority" name="tasks.defaultPriority" defaultValue={prefs["tasks.defaultPriority"]} disabled={!canEdit} aria-describedby="priority-hint" className={inputClass}>
          {["Low", "Medium", "High", "Urgent"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field id="dueDays" label="Default invoice payment terms (days)" hint="Days between the issue date and the due date.">
        <input id="dueDays" name="invoices.defaultDueDays" type="number" min={0} max={365} step={1} defaultValue={prefs["invoices.defaultDueDays"]} disabled={!canEdit} aria-describedby="dueDays-hint" className={inputClass} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="finance.requireSecondConfirmer"
          defaultChecked={prefs["finance.requireSecondConfirmer"]}
          disabled={!canEdit}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="block font-medium">Require a second person to confirm payments</span>
          <span className="block text-muted">Whoever records a receipt or an outgoing payment cannot confirm it themselves.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? <UnsavedChangesGuard /> : null}
        {canEdit ? (
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Save preferences"}
          </button>
        ) : (
          <p className="text-sm text-muted">You can view these settings but not change them.</p>
        )}
        {state.saved ? (
          <p role="status" className="text-sm text-success">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
