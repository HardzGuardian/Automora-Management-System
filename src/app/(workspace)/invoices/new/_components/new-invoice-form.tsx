"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { MoreOptions } from "@/components/forms/more-options";
import { Field } from "@/components/ui/field";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import { createInvoiceAction } from "../../actions";
import { FormError } from "../../_components/finance-ui";
import { ProjectSelect, type ProjectChoice } from "../../_components/project-select";
import type { FinanceActionResult } from "@/modules/finance";

type ClientOption = { id: string; name: string };

export function NewInvoiceForm({ clients, projects }: { clients: ClientOption[]; projects: ProjectChoice[] }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(createInvoiceAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/invoices/${state.data.id}`);
  }, [router, state]);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormError message={state && !state.ok ? state.error.message : null} />

      <div className={`${cardClass} flex flex-col gap-4`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="clientId" label="Client" required>
            <select id="clientId" name="clientId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="dueDate" label="Due date" hint="Overdue is worked out from this date.">
            <input id="dueDate" name="dueDate" type="date" aria-describedby="dueDate-hint" className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <h2 className="m-0 text-sm font-semibold">What you are charging for</h2>
          <Field id="description" label="Description" required>
            <input id="description" name="description" maxLength={500} required className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="quantity" label="Quantity" required>
              <input id="quantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required className={inputClass} />
            </Field>
            <Field id="unitPrice" label="Unit price" required>
              <input id="unitPrice" name="unitPrice" type="number" min="0.01" step="0.01" required className={inputClass} />
            </Field>
            <Field id="taxRate" label="Tax rate (%)">
              <input id="taxRate" name="taxRate" type="number" min="0" step="0.0001" defaultValue="0" className={inputClass} />
            </Field>
          </div>
        </div>

        <MoreOptions>
          <ProjectSelect id="projectId" projects={projects} />
          <Field id="discount" label="Discount" hint="Amount taken off this line.">
            <input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue="0" aria-describedby="discount-hint" className={inputClass} />
          </Field>
        </MoreOptions>
        <p className="text-xs text-muted">Add more lines after creating the draft. The invoice is numbered when you issue it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <UnsavedChangesGuard />
        <button type="submit" disabled={pending || clients.length === 0} className={buttonClass("primary")}>
          {pending ? "Creating draft…" : "Create draft invoice"}
        </button>
        <Link href="/invoices" className={buttonClass("ghost")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
