"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/styles";
import { cancelInvoiceAction, issueInvoiceAction } from "../../actions";
import { FormError } from "../../_components/finance-ui";
import { ReasonDialog } from "../../_components/reason-dialog";
import type { FinanceActionResult } from "@/modules/finance";

/** Issue / cancel controls. Renders inside the page's actions row; the PDF link is rendered by the page next to it. */
export function InvoiceActions({ invoiceId, canIssue, canCancel }: { invoiceId: string; canIssue: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [issueState, issueAction, issuing] = useActionState<FinanceActionResult<{ invoiceNumber: string }> | null, FormData>(issueInvoiceAction, null);
  const [cancelState, cancelAction, cancelling] = useActionState<FinanceActionResult<{ status: "cancelled" }> | null, FormData>(cancelInvoiceAction, null);

  useEffect(() => {
    if (issueState?.ok || cancelState?.ok) router.refresh();
  }, [cancelState, issueState, router]);

  return (
    <>
      {canIssue && (
        <form action={issueAction} className="flex flex-col gap-1">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button type="submit" disabled={issuing} className={buttonClass("primary")}>
            {issuing ? "Issuing…" : "Issue invoice"}
          </button>
        </form>
      )}
      {canCancel && (
        <ReasonDialog
          triggerLabel="Cancel invoice"
          title="Cancel this invoice?"
          consequence="Cancelling keeps the invoice for the record but it can no longer be paid. This cannot be undone."
          reasonLabel="Cancellation reason"
          confirmLabel="Cancel invoice"
          pendingLabel="Cancelling…"
          action={cancelAction}
          pending={cancelling}
          error={cancelState && !cancelState.ok ? cancelState.error.message : null}
          done={cancelState?.ok === true}
          hidden={<input type="hidden" name="invoiceId" value={invoiceId} />}
        />
      )}
      {issueState && !issueState.ok && (
        <div className="basis-full">
          <FormError message={issueState.error.message} />
        </div>
      )}
    </>
  );
}
