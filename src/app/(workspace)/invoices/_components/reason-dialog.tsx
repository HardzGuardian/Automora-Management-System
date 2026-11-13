"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";

/**
 * Confirmation step for destructive finance actions. The trigger opens a modal that explains the consequence and
 * asks for the required reason; the form inside it submits the caller's existing `useActionState` action.
 * Errors from the server stay visible inside the open dialog; it closes itself once `done` is true.
 */
export function ReasonDialog({
  triggerLabel,
  title,
  consequence,
  reasonLabel,
  confirmLabel,
  pendingLabel,
  action,
  pending,
  error,
  done,
  hidden,
}: {
  triggerLabel: string;
  title: string;
  consequence: string;
  reasonLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  action: (formData: FormData) => void;
  pending: boolean;
  error?: string | null;
  done?: boolean;
  hidden: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const errorId = useId();

  useEffect(() => {
    if (done) ref.current?.close();
  }, [done]);

  return (
    <>
      <button type="button" className={buttonClass("secondary", "border-danger/40 text-danger")} onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </button>
      <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(28rem,92vw)] rounded-md border border-border p-0 shadow-lg backdrop:bg-black/40">
        <form action={action} className="flex flex-col gap-3 p-5">
          {hidden}
          <h2 id={titleId} className="m-0 text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted">{consequence}</p>
          <Field id={reasonId} label={reasonLabel} required hint="Recorded in the audit log.">
            <input id={reasonId} name="reason" maxLength={500} required aria-describedby={error ? errorId : `${reasonId}-hint`} className={inputClass} />
          </Field>
          {error ? (
            <p id={errorId} role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()}>
              Go back
            </button>
            <button type="submit" disabled={pending} className={buttonClass("danger")}>
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
