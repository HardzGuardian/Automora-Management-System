import "server-only";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expensePayments, invoices, paymentAllocations, payments } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { cashMovementReportSchema, type CashMovementReportInput, type FinanceReportRange } from "./schemas";
import { combineCashMovementRows, type CashMovementRow } from "./cash-movement-math";
export type { CashMovementRow } from "./cash-movement-math";

export type CashMovementReport = {
  rows: CashMovementRow[];
  total: number;
  range: FinanceReportRange;
  page: number;
  pageSize: number;
};


const receiptTotalByDate = sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric`;
const expensePaidByDate = sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric`;

export async function getCashMovementReport(actor: Actor, input: CashMovementReportInput): Promise<CashMovementReport> {
  requirePermission(actor, "finance.reports.read");
  const parsed = cashMovementReportSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Cash movement filters are invalid.", parsed.error.flatten());
  const receiptRows = await db.select({
    date: payments.paymentDate,
    currency: invoices.currency,
    amount: receiptTotalByDate,
  }).from(paymentAllocations)
    .innerJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, paymentAllocations.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
      gte(payments.paymentDate, parsed.data.fromDate),
      lte(payments.paymentDate, parsed.data.toDate),
    ))
    .innerJoin(invoices, and(
      eq(invoices.id, paymentAllocations.invoiceId),
      eq(invoices.companyId, paymentAllocations.companyId),
    )).where(eq(paymentAllocations.companyId, actor.companyId))
    .groupBy(payments.paymentDate, invoices.currency);
  const expenseRows = await db.select({
    date: expensePayments.paymentDate,
    currency: companies.currency,
    amount: expensePaidByDate,
  }).from(expensePayments)
    .innerJoin(companies, eq(companies.id, expensePayments.companyId))
    .where(and(
      eq(expensePayments.companyId, actor.companyId),
      eq(expensePayments.status, "confirmed"),
      isNull(expensePayments.reversedAt),
      gte(expensePayments.paymentDate, parsed.data.fromDate),
      lte(expensePayments.paymentDate, parsed.data.toDate),
    )).groupBy(expensePayments.paymentDate, companies.currency);
  const combined = combineCashMovementRows(receiptRows, expenseRows);
  const pageRows = combined.slice((parsed.data.page - 1) * parsed.data.pageSize, parsed.data.page * parsed.data.pageSize);
  return {
    rows: pageRows,
    total: combined.length,
    range: { fromDate: parsed.data.fromDate, toDate: parsed.data.toDate },
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  };
}
