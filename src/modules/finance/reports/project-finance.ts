import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expensePayments, expenses, invoices, paymentAllocations, payments, projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { calculateProjectCashNet, type ProjectFinanceCurrencySummary } from "./cash-movement-math";

export type { ProjectFinanceCurrencySummary } from "./cash-movement";

export type ProjectFinanceSummary = {
  projectId: string;
  basis: "cash_based";
  currencies: ProjectFinanceCurrencySummary[];
};

const receiptAmount = sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric`;
const expensePaymentAmount = sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric`;

/** Project cash view: confirmed receipts less confirmed expense payments, grouped by currency. */
export async function getProjectFinanceSummary(actor: Actor, projectId: string): Promise<ProjectFinanceSummary> {
  requirePermission(actor, "finance.invoices.read");
  requirePermission(actor, "finance.expenses.read");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new DomainError("VALIDATION", "Project ID is invalid.");
  }
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId),
    eq(projects.companyId, actor.companyId),
  )).limit(1);
  if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Project was not found.");

  const receipts = await db.select({ currency: invoices.currency, amount: receiptAmount })
    .from(paymentAllocations)
    .innerJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, paymentAllocations.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
    ))
    .innerJoin(invoices, and(
      eq(invoices.id, paymentAllocations.invoiceId),
      eq(invoices.companyId, paymentAllocations.companyId),
    )).where(and(
      eq(paymentAllocations.companyId, actor.companyId),
      eq(invoices.projectId, project.id),
    )).groupBy(invoices.currency);

  const expensePaid = await db.select({ currency: companies.currency, amount: expensePaymentAmount })
    .from(expensePayments)
    .innerJoin(expenses, and(
      eq(expenses.id, expensePayments.expenseId),
      eq(expenses.companyId, expensePayments.companyId),
    ))
    .innerJoin(companies, eq(companies.id, expenses.companyId))
    .innerJoin(projects, and(
      eq(projects.id, expenses.projectId),
      eq(projects.companyId, expenses.companyId),
    )).where(and(
      eq(expensePayments.companyId, actor.companyId),
      eq(expenses.projectId, project.id),
      eq(expensePayments.status, "confirmed"),
      isNull(expensePayments.reversedAt),
    )).groupBy(companies.currency);

  return {
    projectId: project.id,
    basis: "cash_based",
    currencies: calculateProjectCashNet(receipts, expensePaid),
  };
}
