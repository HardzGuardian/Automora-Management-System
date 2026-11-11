import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { calcExpenseOutstanding, deriveExpenseStatus } from "./balance";

export type ExpenseBalanceDTO = {
  expenseId: string;
  total: string;
  confirmedPayments: string;
  outstanding: string;
  status: "unpaid" | "partially_paid" | "paid";
};

const confirmedExpenseTotal = sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric`;

export async function getExpenseBalance(actor: Actor, expenseId: string): Promise<ExpenseBalanceDTO> {
  requirePermission(actor, "finance.expenses.read");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expenseId)) {
    throw new DomainError("VALIDATION", "Expense ID is invalid.");
  }
  const [expense] = await db.select({ id: expenses.id, total: expenses.total }).from(expenses).where(and(
    eq(expenses.id, expenseId),
    eq(expenses.companyId, actor.companyId),
    isNull(expenses.archivedAt),
  )).limit(1);
  if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");

  const [sum] = await db.select({ total: confirmedExpenseTotal }).from(expensePayments).where(and(
    eq(expensePayments.expenseId, expense.id),
    eq(expensePayments.companyId, actor.companyId),
    eq(expensePayments.status, "confirmed"),
    isNull(expensePayments.reversedAt),
  ));
  const totalMinor = toMinor(expense.total);
  const confirmedMinor = toMinor(sum?.total ?? "0");
  return {
    expenseId: expense.id,
    total: fromMinor(totalMinor),
    confirmedPayments: fromMinor(confirmedMinor),
    outstanding: fromMinor(calcExpenseOutstanding(totalMinor, confirmedMinor)),
    status: deriveExpenseStatus(totalMinor, confirmedMinor),
  };
}
