"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addInvoiceLineAction,
  removeInvoiceLineAction,
  updateInvoiceDraftAction,
  updateInvoiceLineAction,
} from "../../actions";
import type { FinanceActionResult, InvoiceDetailDTO } from "@/modules/finance";

type Line = InvoiceDetailDTO["items"][number];

function useRefreshOnSuccess(state: FinanceActionResult<{ id: string }> | null) {
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
}

function LineFields({ item }: { item?: Line }) {
  return <>
    {item && <input type="hidden" name="itemId" value={item.id} />}
    <label>Description<input name="description" maxLength={500} required defaultValue={item?.description ?? ""} /></label>
    <label>Quantity<input name="quantity" type="number" min="0.0001" step="0.0001" required defaultValue={item?.quantity ?? "1"} /></label>
    <label>Unit price<input name="unitPrice" type="number" min="0.01" step="0.01" required defaultValue={item?.unitPrice ?? ""} /></label>
    <label>Discount<input name="discount" type="number" min="0" step="0.01" defaultValue={item?.discount ?? "0"} /></label>
    <label>Tax rate (%)<input name="taxRate" type="number" min="0" step="0.0001" defaultValue={item?.taxRate ?? "0"} /></label>
  </>;
}

function EditableLine({ invoiceId, item }: { invoiceId: string; item: Line }) {
  const [updateState, updateAction, updating] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(updateInvoiceLineAction, null);
  const [removeState, removeAction, removing] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(removeInvoiceLineAction, null);
  useRefreshOnSuccess(updateState);
  useRefreshOnSuccess(removeState);
  return <section>
    <form action={updateAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <LineFields item={item} />
      {updateState && !updateState.ok && <p role="alert">{updateState.error.message}</p>}
      <button type="submit" disabled={updating}>{updating ? "Saving…" : "Save line"}</button>
    </form>
    <form action={removeAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="itemId" value={item.id} />
      {removeState && !removeState.ok && <p role="alert">{removeState.error.message}</p>}
      <button type="submit" disabled={removing}>{removing ? "Removing…" : "Remove line"}</button>
    </form>
  </section>;
}

export function InvoiceDraftEditor({
  invoiceId,
  clientId,
  projectId,
  dueDate,
  items,
}: {
  invoiceId: string;
  clientId: string;
  projectId: string | null;
  dueDate: string | null;
  items: Line[];
}) {
  const [metadataState, metadataAction, savingMetadata] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(updateInvoiceDraftAction, null);
  const [addState, addAction, adding] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(addInvoiceLineAction, null);
  useRefreshOnSuccess(metadataState);
  useRefreshOnSuccess(addState);

  return <section>
    <h2>Edit draft</h2>
    <form action={metadataAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="clientId" value={clientId} />
      <label>Project ID<input name="projectId" defaultValue={projectId ?? ""} /></label>
      <label>Due date<input name="dueDate" type="date" defaultValue={dueDate ?? ""} /></label>
      {metadataState && !metadataState.ok && <p role="alert">{metadataState.error.message}</p>}
      <button type="submit" disabled={savingMetadata}>{savingMetadata ? "Saving…" : "Save invoice details"}</button>
    </form>
    <h3>Line items</h3>
    {items.map((item) => <EditableLine key={item.id} invoiceId={invoiceId} item={item} />)}
    <form action={addAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <fieldset><legend>Add line</legend><LineFields /></fieldset>
      {addState && !addState.ok && <p role="alert">{addState.error.message}</p>}
      <button type="submit" disabled={adding}>{adding ? "Adding…" : "Add line"}</button>
    </form>
  </section>;
}
