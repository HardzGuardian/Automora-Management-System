"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmExpensePaymentAction, recordExpensePaymentAction, reverseExpensePaymentAction } from "../actions";
import type { FinanceActionResult } from "@/modules/finance";

export function NewExpensePaymentForm({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(recordExpensePaymentAction, null);
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
  return <section>
    <h3>Record outgoing payment</h3>
    <form action={action}>
      <input type="hidden" name="expenseId" value={expenseId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
      <label>Payment date<input name="paymentDate" type="date" required /></label>
      <label>Method<select name="method" defaultValue="bank_transfer">
        <option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
      </select></label>
      <label>Reference<input name="reference" maxLength={120} /></label>
      <label>Notes<textarea name="notes" maxLength={1000} /></label>
      {state && !state.ok && <p role="alert">{state.error.message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Recording…" : "Record pending payment"}</button>
    </form>
  </section>;
}

export function ExpensePaymentActions({ paymentId, status, canPay, canReverse }: {
  paymentId: string;
  status: "pending" | "confirmed" | "reversed";
  canPay: boolean;
  canReverse: boolean;
}) {
  const router = useRouter();
  const [confirmState, confirmAction, confirming] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(confirmExpensePaymentAction, null);
  const [reverseState, reverseAction, reversing] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(reverseExpensePaymentAction, null);
  useEffect(() => { if (confirmState?.ok || reverseState?.ok) router.refresh(); }, [confirmState, reverseState, router]);
  return <>
    {status === "pending" && canPay && <form action={confirmAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      {confirmState && !confirmState.ok && <p role="alert">{confirmState.error.message}</p>}
      <button type="submit" disabled={confirming}>{confirming ? "Confirming…" : "Confirm payment"}</button>
    </form>}
    {status === "confirmed" && canReverse && <form action={reverseAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <label>Reversal reason<input name="reason" maxLength={500} required /></label>
      {reverseState && !reverseState.ok && <p role="alert">{reverseState.error.message}</p>}
      <button type="submit" disabled={reversing}>{reversing ? "Reversing…" : "Reverse payment"}</button>
    </form>}
  </>;
}
