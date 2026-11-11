"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelInvoiceAction, issueInvoiceAction } from "../../actions";
import type { FinanceActionResult } from "@/modules/finance";

export function InvoiceActions({ invoiceId, canIssue, canCancel }: { invoiceId: string; canIssue: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [issueState, issueAction, issuing] = useActionState<FinanceActionResult<{ invoiceNumber: string }> | null, FormData>(issueInvoiceAction, null);
  const [cancelState, cancelAction, cancelling] = useActionState<FinanceActionResult<{ status: "cancelled" }> | null, FormData>(cancelInvoiceAction, null);

  useEffect(() => {
    if (issueState?.ok || cancelState?.ok) router.refresh();
  }, [cancelState, issueState, router]);

  return (
    <section aria-label="Invoice actions">
      {canIssue && <form action={issueAction}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        {issueState && !issueState.ok && <p role="alert">{issueState.error.message}</p>}
        <button type="submit" disabled={issuing}>{issuing ? "Issuing…" : "Issue invoice"}</button>
      </form>}
      {canCancel && <form action={cancelAction}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <label>Cancellation reason<input name="reason" maxLength={500} required /></label>
        {cancelState && !cancelState.ok && <p role="alert">{cancelState.error.message}</p>}
        <button type="submit" disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel invoice"}</button>
      </form>}
    </section>
  );
}
