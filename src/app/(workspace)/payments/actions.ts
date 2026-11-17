"use server";

import {
  confirmReceipt,
  financeActionFailure,
  recordReceipt,
  reverseReceipt,
  type FinanceActionResult,
} from "@/modules/finance";
import { getActor } from "@/lib/auth/actor";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function recordReceiptAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const receipt = await recordReceipt(actor, {
      invoiceId: text(formData, "invoiceId"),
      amount: text(formData, "amount"),
      paymentDate: text(formData, "paymentDate"),
      method: text(formData, "method") as "bank_transfer" | "upi" | "cash" | "card" | "other",
      reference: text(formData, "reference"),
      notes: text(formData, "notes"),
      idempotencyKey: text(formData, "idempotencyKey"),
      status: "pending",
    });
    return { ok: true, data: { id: receipt.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function confirmReceiptAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const receipt = await confirmReceipt(actor, text(formData, "paymentId"));
    return { ok: true, data: { id: receipt.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function reverseReceiptAction(
  _previous: FinanceActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const receipt = await reverseReceipt(actor, {
      paymentId: text(formData, "paymentId"),
      reason: text(formData, "reason"),
    });
    return { ok: true, data: { id: receipt.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}
