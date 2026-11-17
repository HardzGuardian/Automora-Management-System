"use client";

import { useEffect, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues, type UseFormRegister } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { parseMoneyInput } from "./money";

/** Warns before leaving the page with unsaved edits (browser reload/close). Pair with RHF's formState.isDirty. */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}

type BaseProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
};

export function TextField<T extends FieldValues>({ name, label, error, required, hint, register, type = "text" }: BaseProps<T> & { register: UseFormRegister<T>; type?: string }) {
  return (
    <Field id={name} label={label} error={error} required={required} hint={hint}>
      <input id={name} type={type} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} {...register(name)} />
    </Field>
  );
}

export function DateField<T extends FieldValues>(props: BaseProps<T> & { register: UseFormRegister<T> }) {
  return <TextField {...props} type="date" />;
}

/** Money input: shows what was typed, stores the canonical "1234.50" string (or "" when invalid). */
export function MoneyField<T extends FieldValues>({ name, label, error, required, hint, control, currency }: BaseProps<T> & { control: Control<T>; currency?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field id={name} label={currency ? `${label} (${currency})` : label} error={error} required={required} hint={hint ?? "Up to 2 decimals"}>
          <input
            id={name}
            inputMode="decimal"
            autoComplete="off"
            className={inputClass}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : `${name}-hint`}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={(e) => {
              const canonical = parseMoneyInput(e.target.value);
              if (canonical) field.onChange(canonical);
              field.onBlur();
            }}
          />
        </Field>
      )}
    />
  );
}

export type PickerOption = { id: string; label: string };

/** Employee/user picker over a pre-fetched, already-authorised option list. */
export function PickerField<T extends FieldValues>({ name, label, error, required, hint, register, options, placeholder = "Choose…" }: BaseProps<T> & { register: UseFormRegister<T>; options: PickerOption[]; placeholder?: string }) {
  return (
    <Field id={name} label={label} error={error} required={required} hint={hint}>
      <select id={name} className={inputClass} aria-invalid={error ? true : undefined} {...register(name)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SubmitRow({ pending, label, pendingLabel = "Saving…", children }: { pending: boolean; label: string; pendingLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? pendingLabel : label}
      </button>
      {children}
    </div>
  );
}
