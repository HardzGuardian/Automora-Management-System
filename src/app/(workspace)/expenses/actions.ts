"use server";

import {
  confirmExpensePayment,
  createExpense,
  financeActionFailure,
  recordExpensePayment,
  reverseExpensePayment,
  updateExpense,
  type FinanceActionResult,
} from "@/modules/finance";
import { getActor } from "@/lib/auth/actor";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createExpenseAction(_previous: FinanceActionResult<{ id: string }> | null, formData: FormData): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const expense = await createExpense(actor, {
      categoryId: text(formData, "categoryId"),
      projectId: text(formData, "projectId") || null,
      payee: text(formData, "payee"),
      description: text(formData, "description"),
      expenseDate: text(formData, "expenseDate"),
      dueDate: text(formData, "dueDate") || null,
      total: text(formData, "total"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
    return { ok: true, data: { id: expense.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function updateExpenseAction(_previous: FinanceActionResult<{ id: string }> | null, formData: FormData): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const expense = await updateExpense(actor, {
      expenseId: text(formData, "expenseId"),
      categoryId: text(formData, "categoryId"),
      projectId: text(formData, "projectId") || null,
      payee: text(formData, "payee"),
      description: text(formData, "description"),
      expenseDate: text(formData, "expenseDate"),
      dueDate: text(formData, "dueDate") || null,
      total: text(formData, "total"),
    });
    return { ok: true, data: { id: expense.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function recordExpensePaymentAction(_previous: FinanceActionResult<{ id: string }> | null, formData: FormData): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const payment = await recordExpensePayment(actor, {
      expenseId: text(formData, "expenseId"),
      amount: text(formData, "amount"),
      paymentDate: text(formData, "paymentDate"),
      method: text(formData, "method") as "bank_transfer" | "upi" | "cash" | "card" | "other",
      reference: text(formData, "reference"),
      notes: text(formData, "notes"),
      idempotencyKey: text(formData, "idempotencyKey"),
      status: "pending",
    });
    return { ok: true, data: { id: payment.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function confirmExpensePaymentAction(_previous: FinanceActionResult<{ id: string }> | null, formData: FormData): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const payment = await confirmExpensePayment(actor, text(formData, "paymentId"));
    return { ok: true, data: { id: payment.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}

export async function reverseExpensePaymentAction(_previous: FinanceActionResult<{ id: string }> | null, formData: FormData): Promise<FinanceActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const payment = await reverseExpensePayment(actor, {
      paymentId: text(formData, "paymentId"),
      reason: text(formData, "reason"),
    });
    return { ok: true, data: { id: payment.id } };
  } catch (error) {
    return financeActionFailure(error);
  }
}
