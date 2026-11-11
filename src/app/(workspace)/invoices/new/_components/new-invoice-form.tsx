"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceAction } from "../../actions";
import type { FinanceActionResult } from "@/modules/finance";

type ClientOption = { id: string; name: string };

export function NewInvoiceForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(createInvoiceAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/invoices/${state.data.id}`);
  }, [router, state]);

  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>
        Client
        <select name="clientId" required defaultValue="">
          <option value="" disabled>Select a client</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </label>
      <label>Project ID (optional)<input name="projectId" inputMode="text" /></label>
      <label>Due date<input name="dueDate" type="date" /></label>
      <fieldset>
        <legend>First line item</legend>
        <label>Description<input name="description" maxLength={500} required /></label>
        <label>Quantity<input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></label>
        <label>Unit price<input name="unitPrice" type="number" min="0.01" step="0.01" required /></label>
        <label>Discount<input name="discount" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label>Tax rate (%)<input name="taxRate" type="number" min="0" step="0.0001" defaultValue="0" /></label>
      </fieldset>
      {state && !state.ok && <p role="alert">{state.error.message}</p>}
      <button type="submit" disabled={pending || clients.length === 0}>
        {pending ? "Creating draft…" : "Create draft invoice"}
      </button>
    </form>
  );
}
