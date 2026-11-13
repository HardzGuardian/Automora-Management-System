"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "./styles";

/**
 * Wraps a sensitive action. The trigger opens a modal <dialog> (focus handled by the browser,
 * Esc closes). The action runs only when the user confirms.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
  triggerClassName,
}: {
  /** Optional extra classes for the trigger button (e.g. a compact size). */
  triggerClassName?: string;
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass("secondary", triggerClassName)} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,92vw)] rounded-md border border-border p-0 shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 id={titleId} className="m-0 text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass(danger ? "danger" : "primary")}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                  ref.current?.close();
                }
              }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** A <form action={serverAction}> that asks for confirmation before submitting. */
export function ConfirmForm({
  action,
  children,
  label,
  title,
  description,
  confirmLabel,
  danger = true,
  triggerClassName,
}: {
  triggerClassName?: string;
  action: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  /** Trigger content. May include an sr-only suffix so repeated triggers have distinct names. */
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex">
      {children}
      <ConfirmDialog
        triggerClassName={triggerClassName}
        trigger={label}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        danger={danger}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
