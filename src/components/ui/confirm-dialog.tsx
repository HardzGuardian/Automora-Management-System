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
}: {
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
      <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,92vw)] rounded-md border border-border p-0 shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
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
}: {
  action: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      {children}
      <ConfirmDialog
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
