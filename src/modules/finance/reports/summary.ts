import "server-only";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expensePayments, expenses, invoices, paymentAllocations, payments } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { calculateProjectCashNet } from "./cash-movement-math";
import { financeReportRangeSchema, type FinanceReportRange } from "./schemas";

export type FinanceCurrencyTotal = { currency: string; amount: string; count?: number };
export type FinanceReportSummary = {
  range: FinanceReportRange;
  period: {
    invoiceTotalsByCurrency: FinanceCurrencyTotal[];
    confirmedReceiptsByCurrency: FinanceCurrencyTotal[];
    expenseTotalsByCurrency: FinanceCurrencyTotal[];
    cashMovementByCurrency: Array<{
      currency: string;
      confirmedReceipts: string;
      confirmedExpensePayments: string;
      netCashMovement: string;
    }>;
  };
  pointInTime: {
    outstandingReceivablesByCurrency: FinanceCurrencyTotal[];
  };
};

const invoiceAmount = sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)::numeric`;
const receiptAmount = sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric`;
const confirmedAllocatedAmount = sql<string>`COALESCE(SUM(CASE WHEN ${payments.id} IS NOT NULL THEN ${paymentAllocations.amount}::numeric ELSE 0 END), 0)::numeric`;
const expenseAmount = sql<string>`COALESCE(SUM(${expenses.total}::numeric), 0)::numeric`;
const outflowAmount = sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric`;

function currencyTotals(rows: readonly { currency: string; amount: string; count?: number }[]): FinanceCurrencyTotal[] {
  return rows.map((row) => ({ ...row, amount: fromMinor(toMinor(row.amount)) }));
}

export async function getFinanceReportSummary(actor: Actor, input: FinanceReportRange): Promise<FinanceReportSummary> {
  requirePermission(actor, "finance.reports.read");
  const parsed = financeReportRangeSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Report date range is invalid.", parsed.error.flatten());
  const { fromDate, toDate } = parsed.data;

  const invoicesInPeriod = await db.select({
    currency: invoices.currency,
    amount: invoiceAmount,
    count: sql<number>`COUNT(*)::int`,
  }).from(invoices).where(and(
    eq(invoices.companyId, actor.companyId),
    eq(invoices.status, "issued"),
    gte(invoices.issueDate, fromDate),
    lte(invoices.issueDate, toDate),
  )).groupBy(invoices.currency);

  const receiptsInPeriod = await db.select({ currency: invoices.currency, amount: receiptAmount })
    .from(paymentAllocations)
    .innerJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, paymentAllocations.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
      gte(payments.paymentDate, fromDate),
      lte(payments.paymentDate, toDate),
    )).innerJoin(invoices, and(
      eq(invoices.id, paymentAllocations.invoiceId),
      eq(invoices.companyId, paymentAllocations.companyId),
    )).where(eq(paymentAllocations.companyId, actor.companyId)).groupBy(invoices.currency);

  const invoiceBalances = db.select({
    currency: invoices.currency,
    outstanding: sql<string>`GREATEST(${invoices.total}::numeric - ${confirmedAllocatedAmount}, 0)::numeric`.as("outstanding"),
  })
    .from(invoices)
    .leftJoin(paymentAllocations, and(
      eq(paymentAllocations.invoiceId, invoices.id),
      eq(paymentAllocations.companyId, invoices.companyId),
    )).leftJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, invoices.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
    )).where(and(
      eq(invoices.companyId, actor.companyId),
      eq(invoices.status, "issued"),
    )).groupBy(invoices.id, invoices.currency, invoices.total).as("issued_invoice_balances");
  const outstandingByCurrency = await db.select({
    currency: invoiceBalances.currency,
    amount: sql<string>`COALESCE(SUM(${invoiceBalances.outstanding}::numeric), 0)::numeric`,
  }).from(invoiceBalances).groupBy(invoiceBalances.currency);

  const expensesInPeriod = await db.select({
    currency: companies.currency,
    amount: expenseAmount,
    count: sql<number>`COUNT(*)::int`,
  }).from(expenses).innerJoin(companies, eq(companies.id, expenses.companyId)).where(and(
    eq(expenses.companyId, actor.companyId),
    gte(expenses.expenseDate, fromDate),
    lte(expenses.expenseDate, toDate),
    isNull(expenses.archivedAt),
  )).groupBy(companies.currency);

  const outflowsInPeriod = await db.select({ currency: companies.currency, amount: outflowAmount })
    .from(expensePayments).innerJoin(companies, eq(companies.id, expensePayments.companyId)).where(and(
      eq(expensePayments.companyId, actor.companyId),
      eq(expensePayments.status, "confirmed"),
      isNull(expensePayments.reversedAt),
      gte(expensePayments.paymentDate, fromDate),
      lte(expensePayments.paymentDate, toDate),
    )).groupBy(companies.currency);

  return {
    range: parsed.data,
    period: {
      invoiceTotalsByCurrency: currencyTotals(invoicesInPeriod),
      confirmedReceiptsByCurrency: currencyTotals(receiptsInPeriod),
      expenseTotalsByCurrency: currencyTotals(expensesInPeriod),
      cashMovementByCurrency: calculateProjectCashNet(receiptsInPeriod, outflowsInPeriod),
    },
    pointInTime: { outstandingReceivablesByCurrency: currencyTotals(outstandingByCurrency) },
  };
}
