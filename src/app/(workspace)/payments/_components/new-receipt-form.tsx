"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordReceiptAction } from "../actions";
import type { FinanceActionResult } from "@/modules/finance";

export function NewReceiptForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(recordReceiptAction, null);
  useEffect(() => {
    if (state?.ok) router.push(`/payments/${state.data.id}`);
  }, [router, state]);

  return (
    <section>
      <h2>Record receipt</h2>
      <form action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label>Payment date<input name="paymentDate" type="date" required /></label>
        <label>Method
          <select name="method" defaultValue="bank_transfer">
            <option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option>
            <option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
          </select>
        </label>
        <label>Reference<input name="reference" maxLength={120} /></label>
        <label>Notes<textarea name="notes" maxLength={1000} /></label>
        {state && !state.ok && <p role="alert">{state.error.message}</p>}
        <button type="submit" disabled={pending}>{pending ? "Recording…" : "Record pending receipt"}</button>
      </form>
    </section>
  );
}
