"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import type { CompanyProfile } from "@/modules/settings";
import { saveCompanyAction, type SettingsState } from "../actions";

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];

export function CompanyForm({ profile, canEdit }: { profile: CompanyProfile; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveCompanyAction, {} as SettingsState);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const zones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];
  return (
    <form action={action} className={`${cardClass} flex max-w-2xl flex-col gap-4`}>
      <div>
        <h2 className="m-0 text-base font-semibold">Company profile</h2>
        <p className="mt-1 text-sm text-muted">Shown on invoices and exports. Currency and timezone apply company-wide.</p>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="legalName" label="Legal name" required error={err("legalName")}>
          <input id="legalName" name="legalName" defaultValue={profile.legalName} required disabled={!canEdit} className={inputClass} />
        </Field>
        <Field id="displayName" label="Display name" required error={err("displayName")}>
          <input id="displayName" name="displayName" defaultValue={profile.displayName} required disabled={!canEdit} className={inputClass} />
        </Field>
        <Field id="email" label="Email" error={err("email")}>
          <input id="email" name="email" type="email" defaultValue={profile.email ?? ""} disabled={!canEdit} className={inputClass} />
        </Field>
        <Field id="phone" label="Phone" error={err("phone")}>
          <input id="phone" name="phone" defaultValue={profile.phone ?? ""} disabled={!canEdit} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="address" label="Address" error={err("address")}>
            <textarea id="address" name="address" rows={3} defaultValue={profile.address ?? ""} disabled={!canEdit} className={inputClass} />
          </Field>
        </div>
        <Field id="currency" label="Currency" required hint="3-letter code, e.g. INR" error={err("currency")}>
          <input id="currency" name="currency" defaultValue={profile.currency} maxLength={3} required disabled={!canEdit} aria-describedby="currency-hint" className={inputClass} />
        </Field>
        <Field id="timezone" label="Timezone" required hint="Decides what “today” and “overdue” mean for everyone." error={err("timezone")}>
          <select id="timezone" name="timezone" defaultValue={profile.timezone} disabled={!canEdit} aria-describedby="timezone-hint" className={inputClass}>
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Save changes"}
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
