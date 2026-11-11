import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";

export type ExpensePaymentRow = {
  id: string;
  expenseId: string;
  amount: string;
  paymentDate: string;
  method: "bank_transfer" | "upi" | "cash" | "card" | "other";
  reference: string | null;
  status: "pending" | "confirmed" | "reversed";
};

export async function listExpensePayments(actor: Actor, expenseId: string): Promise<ExpensePaymentRow[]> {
  requirePermission(actor, "finance.expenses.read");
  const [expense] = await db.select({ id: expenses.id }).from(expenses).where(and(
    eq(expenses.id, expenseId),
    eq(expenses.companyId, actor.companyId),
    isNull(expenses.archivedAt),
  )).limit(1);
  if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
  const rows = await db.select({
    id: expensePayments.id,
    expenseId: expensePayments.expenseId,
    amount: expensePayments.amount,
    paymentDate: expensePayments.paymentDate,
    method: expensePayments.method,
    reference: expensePayments.reference,
    status: expensePayments.status,
  }).from(expensePayments).where(and(
    eq(expensePayments.expenseId, expense.id),
    eq(expensePayments.companyId, actor.companyId),
  )).orderBy(desc(expensePayments.paymentDate), desc(expensePayments.id));
  return rows.map((row) => ({ ...row, amount: fromMinor(toMinor(row.amount)) }));
}
