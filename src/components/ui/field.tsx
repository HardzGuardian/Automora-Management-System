import type { ReactNode } from "react";

/** `aria-invalid` / `aria-describedby` props for the control inside a `Field` with the same id. */
export function fieldAria(id: string, opts: { error?: string; hint?: string | boolean }): { "aria-invalid"?: true; "aria-describedby"?: string } {
  if (opts.error) return { "aria-invalid": true, "aria-describedby": `${id}-error` };
  if (opts.hint) return { "aria-describedby": `${id}-hint` };
  return {};
}

/** Groups related fields in a long form: `<fieldset>` with a visible legend. */
export function FormSection({ legend, description, children }: { legend: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="mb-1 p-0 text-base font-semibold">{legend}</legend>
      {description ? <p className="-mt-3 text-sm text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

/** Label + control + inline error. The control is passed as children; give it the same `id`. */
export function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-danger"> *</span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
