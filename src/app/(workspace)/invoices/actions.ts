"use server";

import { getActor } from "@/lib/auth/actor";
import {
  cancelInvoice,
  createInvoiceDraft,
  financeActionFailure,
  issueInvoice,
  updateInvoiceDraft,
  addInvoiceLine,
  updateInvoiceLine,
  removeInvoiceLine,
  type FinanceActionResult,
} from "@/modules/finance";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createInvoiceAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const invoice = await createInvoiceDraft(actor, {
      clientId: text(formData, "clientId"),
      projectId: text(formData, "projectId") || null,
      dueDate: text(formData, "dueDate") || null,
      idempotencyKey: text(formData, "idempotencyKey"),
      items: [{
        description: text(formData, "description"),
        quantity: text(formData, "quantity"),
        unitPrice: text(formData, "unitPrice"),
        discount: text(formData, "discount") || "0",
        taxRate: text(formData, "taxRate") || "0",
      }],
    });
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function issueInvoiceAction(
  _previous: FinanceActionResult<{ invoiceNumber: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ invoiceNumber: string }>> {
  try {
    const actor = await getActor();
    const invoice = await issueInvoice(actor, text(formData, "invoiceId"));
    return { ok: true, data: { invoiceNumber: invoice.invoiceNumber } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function cancelInvoiceAction(
  _previous: FinanceActionResult<{ status: "cancelled" }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ status: "cancelled" }>> {
  try {
    const actor = await getActor();
    const invoice = await cancelInvoice(actor, {
      invoiceId: text(formData, "invoiceId"),
      reason: text(formData, "reason"),
    });
    return { ok: true, data: { status: invoice.status } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function updateInvoiceDraftAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const invoice = await updateInvoiceDraft(actor, text(formData, "invoiceId"), {
      clientId: text(formData, "clientId"),
      projectId: text(formData, "projectId") || null,
      dueDate: text(formData, "dueDate") || null,
    });
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function addInvoiceLineAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const invoice = await addInvoiceLine(actor, text(formData, "invoiceId"), {
      description: text(formData, "description"),
      quantity: text(formData, "quantity"),
      unitPrice: text(formData, "unitPrice"),
      discount: text(formData, "discount") || "0",
      taxRate: text(formData, "taxRate") || "0",
    });
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function updateInvoiceLineAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const invoice = await updateInvoiceLine(actor, text(formData, "invoiceId"), {
      itemId: text(formData, "itemId"),
      description: text(formData, "description"),
      quantity: text(formData, "quantity"),
      unitPrice: text(formData, "unitPrice"),
      discount: text(formData, "discount") || "0",
      taxRate: text(formData, "taxRate") || "0",
    });
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function removeInvoiceLineAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const invoice = await removeInvoiceLine(actor, text(formData, "invoiceId"), text(formData, "itemId"));
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}
