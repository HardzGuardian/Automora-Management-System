"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmReceiptAction, reverseReceiptAction } from "../../actions";
import type { FinanceActionResult } from "@/modules/finance";

export function ReceiptActions({ paymentId, canConfirm, canReverse }: { paymentId: string; canConfirm: boolean; canReverse: boolean }) {
  const router = useRouter();
  const [confirmState, confirmAction, confirming] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(confirmReceiptAction, null);
  const [reverseState, reverseAction, reversing] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(reverseReceiptAction, null);
  useEffect(() => {
    if (confirmState?.ok || reverseState?.ok) router.refresh();
  }, [confirmState, reverseState, router]);

  return <section aria-label="Receipt actions">
    {canConfirm && <form action={confirmAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      {confirmState && !confirmState.ok && <p role="alert">{confirmState.error.message}</p>}
      <button type="submit" disabled={confirming}>{confirming ? "Confirming…" : "Confirm receipt"}</button>
    </form>}
    {canReverse && <form action={reverseAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <label>Reversal reason<input name="reason" maxLength={500} required /></label>
      {reverseState && !reverseState.ok && <p role="alert">{reverseState.error.message}</p>}
      <button type="submit" disabled={reversing}>{reversing ? "Reversing…" : "Reverse receipt"}</button>
    </form>}
  </section>;
}
