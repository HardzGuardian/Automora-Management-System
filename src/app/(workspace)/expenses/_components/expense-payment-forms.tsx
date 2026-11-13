"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { confirmExpensePaymentAction, recordExpensePaymentAction, reverseExpensePaymentAction } from "../actions";
import { FormError, PAYMENT_METHODS, Section } from "../../invoices/_components/finance-ui";
import { ReasonDialog } from "../../invoices/_components/reason-dialog";
import type { FinanceActionResult } from "@/modules/finance";

export function NewExpensePaymentForm({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(recordExpensePaymentAction, null);
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
  return (
    <Section title="Record outgoing payment" description="A new payment is pending. It only counts toward the expense once confirmed.">
      <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input type="hidden" name="expenseId" value={expenseId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <Field id="pay-amount" label="Amount" required>
          <input id="pay-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field id="pay-paymentDate" label="Payment date" required>
          <input id="pay-paymentDate" name="paymentDate" type="date" required className={inputClass} />
        </Field>
        <Field id="pay-method" label="Method">
          <select id="pay-method" name="method" defaultValue="bank_transfer" className={inputClass}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field id="pay-reference" label="Reference" hint="Bank or UPI reference, cheque number, etc.">
          <input id="pay-reference" name="reference" maxLength={120} aria-describedby="pay-reference-hint" className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="pay-notes" label="Notes">
            <textarea id="pay-notes" name="notes" rows={3} maxLength={1000} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <FormError message={state && !state.ok ? state.error.message : null} />
          <div>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "Recording…" : "Record pending payment"}
            </button>
          </div>
        </div>
      </form>
    </Section>
  );
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
  const showConfirm = status === "pending" && canPay;
  const showReverse = status === "confirmed" && canReverse;
  if (!showConfirm && !showReverse) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {showConfirm && (
        <form action={confirmAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <button type="submit" disabled={confirming} className={buttonClass("primary")}>
            {confirming ? "Confirming…" : "Confirm payment"}
          </button>
        </form>
      )}
      {showReverse && (
        <ReasonDialog
          triggerLabel="Reverse payment"
          title="Reverse this payment?"
          consequence="Reversing removes this amount from what has been paid, so the expense’s outstanding balance goes back up. The payment stays on record as reversed."
          reasonLabel="Reversal reason"
          confirmLabel="Reverse payment"
          pendingLabel="Reversing…"
          action={reverseAction}
          pending={reversing}
          error={reverseState && !reverseState.ok ? reverseState.error.message : null}
          done={reverseState?.ok === true}
          hidden={<input type="hidden" name="paymentId" value={paymentId} />}
        />
      )}
      {confirmState && !confirmState.ok && <FormError message={confirmState.error.message} />}
    </div>
  );
}
