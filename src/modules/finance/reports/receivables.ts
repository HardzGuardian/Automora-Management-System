import "server-only";
import { and, asc, count, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoices, paymentAllocations, payments } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { todayInTz } from "@/lib/dates";
import { fromMinor, toMinor } from "@/lib/money";
import { receivablesReportSchema, type FinanceReportRange, type ReceivablesReportInput } from "./schemas";

export type ReceivableRow = {
  invoiceId: string;
  invoiceNumber: string | null;
  clientId: string;
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  total: string;
  confirmedReceipts: string;
  outstanding: string;
  status: "issued" | "partially_paid" | "paid" | "overdue";
};

export type ReceivablesReport = { rows: ReceivableRow[]; total: number; range: FinanceReportRange; page: number; pageSize: number };

const paidTotal = sql<string>`COALESCE(SUM(CASE WHEN ${payments.id} IS NOT NULL THEN ${paymentAllocations.amount}::numeric ELSE 0 END), 0)::numeric`;
const balance = sql<string>`GREATEST(${invoices.total}::numeric - ${paidTotal}, 0)::numeric`;

export async function getReceivablesReport(actor: Actor, input: ReceivablesReportInput): Promise<ReceivablesReport> {
  requirePermission(actor, "finance.reports.read");
  const parsed = receivablesReportSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Report date range is invalid.", parsed.error.flatten());
  const today = todayInTz(actor.timezone);
  const base = db.select({
    invoiceId: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    clientId: invoices.clientId,
    clientName: clients.name,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    currency: invoices.currency,
    total: invoices.total,
    confirmedReceipts: paidTotal.as("confirmedReceipts"),
    outstanding: balance.as("outstanding"),
  }).from(invoices)
    .innerJoin(clients, and(eq(clients.id, invoices.clientId), eq(clients.companyId, invoices.companyId)))
    .leftJoin(paymentAllocations, and(
      eq(paymentAllocations.invoiceId, invoices.id),
      eq(paymentAllocations.companyId, invoices.companyId),
    ))
    .leftJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, invoices.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
    )).where(and(
      eq(invoices.companyId, actor.companyId),
      eq(invoices.status, "issued"),
      gte(invoices.issueDate, parsed.data.fromDate),
      lte(invoices.issueDate, parsed.data.toDate),
    )).groupBy(
      invoices.id, invoices.companyId, invoices.invoiceNumber, invoices.clientId, clients.name,
      invoices.issueDate, invoices.dueDate, invoices.currency, invoices.total,
    ).as("receivables_report");
  const [countRow] = await db.select({ value: count() }).from(base);
  const rows = await db.select({
    invoiceId: base.invoiceId,
    invoiceNumber: base.invoiceNumber,
    clientId: base.clientId,
    clientName: base.clientName,
    issueDate: base.issueDate,
    dueDate: base.dueDate,
    currency: base.currency,
    total: base.total,
    confirmedReceipts: base.confirmedReceipts,
    outstanding: base.outstanding,
    status: sql<ReceivableRow["status"]>`CASE
      WHEN ${base.outstanding} <= 0 THEN 'paid'
      WHEN ${base.dueDate} < ${today} THEN 'overdue'
      WHEN ${base.confirmedReceipts} > 0 THEN 'partially_paid'
      ELSE 'issued'
    END`.as("status"),
  }).from(base).orderBy(asc(base.dueDate), asc(base.invoiceNumber))
    .limit(parsed.data.pageSize)
    .offset((parsed.data.page - 1) * parsed.data.pageSize);
  return {
    rows: rows.map((row) => ({
      ...row,
      total: fromMinor(toMinor(row.total)),
      confirmedReceipts: fromMinor(toMinor(row.confirmedReceipts)),
      outstanding: fromMinor(toMinor(row.outstanding)),
    })),
    total: countRow?.value ?? 0,
    range: { fromDate: parsed.data.fromDate, toDate: parsed.data.toDate },
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  };
}
