import "server-only";
import { and, asc, count, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expenseCategories, expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { calcExpenseOutstanding } from "../expenses/balance";
import { expenseListSchema } from "../expenses/schemas";
import { financeReportRangeSchema, type FinanceReportRange } from "./schemas";

export type ExpenseRegisterRow = {
  expenseId: string;
  expenseCode: string;
  categoryName: string;
  projectId: string | null;
  payee: string;
  description: string;
  expenseDate: string;
  dueDate: string | null;
  currency: string;
  total: string;
  confirmedPayments: string;
  outstanding: string;
  status: "unpaid" | "partially_paid" | "paid";
};

export type ExpenseRegisterReport = { rows: ExpenseRegisterRow[]; total: number; range: FinanceReportRange; page: number; pageSize: number };

const confirmedTotal = sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric`;

export async function getExpenseRegisterReport(
  actor: Actor,
  input: FinanceReportRange & { page?: number; pageSize?: number },
): Promise<ExpenseRegisterReport> {
  requirePermission(actor, "finance.reports.read");
  const parsedRange = financeReportRangeSchema.safeParse(input);
  const parsedPage = expenseListSchema.safeParse({ page: input.page, pageSize: input.pageSize });
  if (!parsedRange.success || !parsedPage.success) {
    throw new DomainError("VALIDATION", "Expense register filters are invalid.");
  }
  const paymentTotals = db.select({
    expenseId: expensePayments.expenseId,
    companyId: expensePayments.companyId,
    total: confirmedTotal.as("paid_total"),
  }).from(expensePayments).where(and(
    eq(expensePayments.companyId, actor.companyId),
    eq(expensePayments.status, "confirmed"),
    isNull(expensePayments.reversedAt),
  )).groupBy(expensePayments.expenseId, expensePayments.companyId).as("expense_register_payments");
  const base = db.select({
    expenseId: expenses.id,
    expenseCode: expenses.expenseCode,
    categoryName: expenseCategories.name,
    projectId: expenses.projectId,
    payee: expenses.payee,
    description: expenses.description,
    expenseDate: expenses.expenseDate,
    dueDate: expenses.dueDate,
    currency: companies.currency,
    total: expenses.total,
    confirmedPayments: sql<string>`COALESCE(${paymentTotals.total}, 0)::numeric`.as("confirmedPayments"),
    outstanding: sql<string>`GREATEST(${expenses.total}::numeric - COALESCE(${paymentTotals.total}, 0)::numeric, 0)::numeric`.as("outstanding"),
  }).from(expenses)
    .innerJoin(companies, eq(companies.id, expenses.companyId))
    .innerJoin(expenseCategories, and(
      eq(expenseCategories.id, expenses.categoryId),
      eq(expenseCategories.companyId, expenses.companyId),
    ))
    .leftJoin(paymentTotals, and(
      eq(paymentTotals.expenseId, expenses.id),
      eq(paymentTotals.companyId, expenses.companyId),
    )).where(and(
      eq(expenses.companyId, actor.companyId),
      gte(expenses.expenseDate, parsedRange.data.fromDate),
      lte(expenses.expenseDate, parsedRange.data.toDate),
      isNull(expenses.archivedAt),
    )).as("expense_register");
  const [countRow] = await db.select({ value: count() }).from(base);
  const rows = await db.select({
    expenseId: base.expenseId,
    expenseCode: base.expenseCode,
    categoryName: base.categoryName,
    projectId: base.projectId,
    payee: base.payee,
    description: base.description,
    expenseDate: base.expenseDate,
    dueDate: base.dueDate,
    currency: base.currency,
    total: base.total,
    confirmedPayments: base.confirmedPayments,
    outstanding: base.outstanding,
  }).from(base).orderBy(asc(base.expenseDate), asc(base.expenseCode))
    .limit(parsedPage.data.pageSize)
    .offset((parsedPage.data.page - 1) * parsedPage.data.pageSize);
  return {
    rows: rows.map((row) => {
      const totalMinor = toMinor(row.total);
      const paidMinor = toMinor(row.confirmedPayments);
      const outstandingMinor = calcExpenseOutstanding(totalMinor, paidMinor);
      return {
        ...row,
        total: fromMinor(totalMinor),
        confirmedPayments: fromMinor(paidMinor),
        outstanding: fromMinor(outstandingMinor),
        status: outstandingMinor === 0 ? "paid" : paidMinor > 0 ? "partially_paid" : "unpaid",
      };
    }),
    total: countRow?.value ?? 0,
    range: parsedRange.data,
    page: parsedPage.data.page,
    pageSize: parsedPage.data.pageSize,
  };
}
