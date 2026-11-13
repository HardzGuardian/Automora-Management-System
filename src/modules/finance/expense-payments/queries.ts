import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { requiresSecondConfirmer } from "@/modules/settings";

export type ExpensePaymentRow = {
  id: string;
  expenseId: string;
  amount: string;
  paymentDate: string;
  method: "bank_transfer" | "upi" | "cash" | "card" | "other";
  reference: string | null;
  status: "pending" | "confirmed" | "reversed";
  /** Pending, recorded by the viewer, and the company wants someone else to confirm it. */
  awaitingSecondPerson: boolean;
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
    createdBy: expensePayments.createdBy,
  }).from(expensePayments).where(and(
    eq(expensePayments.expenseId, expense.id),
    eq(expensePayments.companyId, actor.companyId),
  )).orderBy(desc(expensePayments.paymentDate), desc(expensePayments.id));
  const secondPerson = await requiresSecondConfirmer(actor.companyId);
  return rows.map(({ createdBy, ...row }) => ({
    ...row,
    amount: fromMinor(toMinor(row.amount)),
    awaitingSecondPerson: secondPerson && row.status === "pending" && createdBy === actor.userId,
  }));
}
