"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/styles";
import { confirmReceiptAction, reverseReceiptAction } from "../../actions";
import { FormError } from "../../../invoices/_components/finance-ui";
import { ReasonDialog } from "../../../invoices/_components/reason-dialog";
import type { FinanceActionResult } from "@/modules/finance";

export function ReceiptActions({ paymentId, canConfirm, canReverse }: { paymentId: string; canConfirm: boolean; canReverse: boolean }) {
  const router = useRouter();
  const [confirmState, confirmAction, confirming] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(confirmReceiptAction, null);
  const [reverseState, reverseAction, reversing] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(reverseReceiptAction, null);
  useEffect(() => {
    if (confirmState?.ok || reverseState?.ok) router.refresh();
  }, [confirmState, reverseState, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canConfirm && (
        <form action={confirmAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <button type="submit" disabled={confirming} className={buttonClass("primary")}>
            {confirming ? "Confirming…" : "Confirm receipt"}
          </button>
        </form>
      )}
      {canReverse && (
        <ReasonDialog
          triggerLabel="Reverse receipt"
          title="Reverse this receipt?"
          consequence="Reversing removes this amount from the invoice’s received total, so the outstanding balance goes back up. The receipt stays on record as reversed."
          reasonLabel="Reversal reason"
          confirmLabel="Reverse receipt"
          pendingLabel="Reversing…"
          action={reverseAction}
          pending={reversing}
          error={reverseState && !reverseState.ok ? reverseState.error.message : null}
          done={reverseState?.ok === true}
          hidden={<input type="hidden" name="paymentId" value={paymentId} />}
        />
      )}
      {canConfirm && <p className="basis-full text-xs text-muted">Confirming counts this amount toward the invoice and updates its balance.</p>}
      {confirmState && !confirmState.ok && (
        <div className="basis-full">
          <FormError message={confirmState.error.message} />
        </div>
      )}
    </div>
  );
}
