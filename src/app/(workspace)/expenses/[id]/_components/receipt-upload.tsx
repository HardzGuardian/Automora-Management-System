"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { uploadExpenseReceiptAction, type ReceiptUploadState } from "../attachment-actions";

export function ReceiptUploadForm({ expenseId }: { expenseId: string }) {
  const [state, action, pending] = useActionState(uploadExpenseReceiptAction, {} as ReceiptUploadState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="expenseId" value={expenseId} />
      <Field id="receipt-file" label="Attach a receipt" hint="PDF, PNG, JPG, DOCX, XLSX, CSV or TXT, up to 10 MB.">
        <input id="receipt-file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt" aria-describedby="receipt-file-hint" className={inputClass} />
      </Field>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          Receipt uploaded.
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "Uploading…" : "Upload receipt"}
        </button>
      </div>
    </form>
  );
}
