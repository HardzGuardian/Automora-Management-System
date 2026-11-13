"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { recordReceiptAction } from "../actions";
import { FormError, PAYMENT_METHODS, Section } from "../../invoices/_components/finance-ui";
import type { FinanceActionResult } from "@/modules/finance";

export function NewReceiptForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(recordReceiptAction, null);
  useEffect(() => {
    if (state?.ok) router.push(`/payments/${state.data.id}`);
  }, [router, state]);

  return (
    <Section title="Record receipt" description="A new receipt is pending. It only reduces the outstanding balance once someone confirms it.">
      <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <Field id="receipt-amount" label="Amount" required>
          <input id="receipt-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field id="receipt-paymentDate" label="Payment date" required>
          <input id="receipt-paymentDate" name="paymentDate" type="date" required className={inputClass} />
        </Field>
        <Field id="receipt-method" label="Method">
          <select id="receipt-method" name="method" defaultValue="bank_transfer" className={inputClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="receipt-reference" label="Reference" hint="Bank or UPI reference, cheque number, etc.">
          <input id="receipt-reference" name="reference" maxLength={120} aria-describedby="receipt-reference-hint" className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="receipt-notes" label="Notes">
            <textarea id="receipt-notes" name="notes" rows={3} maxLength={1000} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <FormError message={state && !state.ok ? state.error.message : null} />
          <div>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "Recording…" : "Record pending receipt"}
            </button>
          </div>
        </div>
      </form>
    </Section>
  );
}
