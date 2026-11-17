"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import {
  addInvoiceLineAction,
  removeInvoiceLineAction,
  updateInvoiceDraftAction,
  updateInvoiceLineAction,
} from "../../actions";
import { FormError, Section } from "../../_components/finance-ui";
import { ProjectSelect, type ProjectChoice } from "../../_components/project-select";
import type { FinanceActionResult, InvoiceDetailDTO } from "@/modules/finance";

type Line = InvoiceDetailDTO["items"][number];
type State = FinanceActionResult<{ id: string }> | null;

function useRefreshOnSuccess(state: State) {
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
}

const errorOf = (state: State) => (state && !state.ok ? state.error.message : null);

function LineFields({ item, prefix }: { item?: Line; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <div className="sm:col-span-6">
        <Field id={`${prefix}-description`} label="Description" required>
          <input id={`${prefix}-description`} name="description" maxLength={500} required defaultValue={item?.description ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-quantity`} label="Quantity" required>
          <input id={`${prefix}-quantity`} name="quantity" type="number" min="0.0001" step="0.0001" required defaultValue={item?.quantity ?? "1"} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-unitPrice`} label="Unit price" required>
          <input id={`${prefix}-unitPrice`} name="unitPrice" type="number" min="0.01" step="0.01" required defaultValue={item?.unitPrice ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field id={`${prefix}-discount`} label="Discount">
          <input id={`${prefix}-discount`} name="discount" type="number" min="0" step="0.01" defaultValue={item?.discount ?? "0"} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field id={`${prefix}-taxRate`} label="Tax rate (%)">
          <input id={`${prefix}-taxRate`} name="taxRate" type="number" min="0" step="0.0001" defaultValue={item?.taxRate ?? "0"} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}

function EditableLine({ invoiceId, item, index }: { invoiceId: string; item: Line; index: number }) {
  const [updateState, updateAction, updating] = useActionState<State, FormData>(updateInvoiceLineAction, null);
  const [removeState, removeAction, removing] = useActionState<State, FormData>(removeInvoiceLineAction, null);
  useRefreshOnSuccess(updateState);
  useRefreshOnSuccess(removeState);
  const removeFormId = `remove-${item.id}`;
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Line {index + 1}</p>
      <form action={updateAction} className="flex flex-col gap-3">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <LineFields item={item} prefix={`line-${item.id}`} />
        <FormError message={errorOf(updateState) ?? errorOf(removeState)} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={updating} className={buttonClass("secondary")}>
            {updating ? "Saving…" : "Save line"}
          </button>
          <button type="submit" form={removeFormId} disabled={removing} className={buttonClass("ghost", "text-danger")}>
            {removing ? "Removing…" : "Remove line"}
          </button>
        </div>
      </form>
      <form id={removeFormId} action={removeAction} className="hidden">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="itemId" value={item.id} />
      </form>
    </li>
  );
}

export function InvoiceDraftEditor({
  invoiceId,
  clientId,
  projectId,
  dueDate,
  items,
  projects,
}: {
  invoiceId: string;
  clientId: string;
  projectId: string | null;
  dueDate: string | null;
  items: Line[];
  projects: ProjectChoice[];
}) {
  const [metadataState, metadataAction, savingMetadata] = useActionState<State, FormData>(updateInvoiceDraftAction, null);
  const [addState, addAction, adding] = useActionState<State, FormData>(addInvoiceLineAction, null);
  useRefreshOnSuccess(metadataState);
  useRefreshOnSuccess(addState);

  return (
    <Section title="Edit draft" description="Changes apply to the draft only. Issuing locks the lines.">
      <form action={metadataAction} className="flex max-w-xl flex-col gap-3">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="clientId" value={clientId} />
        <ProjectSelect id="draft-projectId" projects={projects} defaultValue={projectId} />
        <Field id="draft-dueDate" label="Due date">
          <input id="draft-dueDate" name="dueDate" type="date" defaultValue={dueDate ?? ""} className={inputClass} />
        </Field>
        <FormError message={errorOf(metadataState)} />
        <div>
          <button type="submit" disabled={savingMetadata} className={buttonClass("secondary")}>
            {savingMetadata ? "Saving…" : "Save invoice details"}
          </button>
        </div>
      </form>

      <h3 className="mt-2 text-base font-semibold">Line items</h3>
      <ul className="flex list-none flex-col gap-3 p-0">
        {items.map((item, index) => (
          <EditableLine key={item.id} invoiceId={invoiceId} item={item} index={index} />
        ))}
      </ul>

      <form action={addAction} className="flex flex-col gap-3">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <fieldset className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
          <legend className="px-1 text-sm font-medium">Add line</legend>
          <LineFields prefix="new-line" />
        </fieldset>
        <FormError message={errorOf(addState)} />
        <div>
          <button type="submit" disabled={adding} className={buttonClass("secondary")}>
            {adding ? "Adding…" : "Add line"}
          </button>
        </div>
      </form>
    </Section>
  );
}
