import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expensePayments, expenses, invoices, paymentAllocations, payments, projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { projectScope, requirePermission } from "@/lib/permissions";
import { fromMinor, toMinor } from "@/lib/money";

export type ProjectFinanceRow = {
  projectId: string;
  projectCode: string;
  projectName: string;
  status: string;
  currency: string;
  budget: string | null;
  invoiced: string;
  confirmedReceipts: string;
  confirmedExpensePayments: string;
  netCashMovement: string;
};

export type ProjectFinanceOverview = { rows: ProjectFinanceRow[]; total: number; page: number; pageSize: number };


/**
 * One row per project and currency, cash based (confirmed receipts less confirmed expense payments),
 * with the budget and the amount invoiced for comparison. Cash-based exactly like the project's own finance tab.
 */
export async function getProjectFinanceOverview(actor: Actor, input: { page?: number; pageSize?: number } = {}): Promise<ProjectFinanceOverview> {
  requirePermission(actor, "finance.invoices.read");
  requirePermission(actor, "finance.expenses.read");
  requirePermission(actor, "finance.reports.read");
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const where = and(projectScope(actor), isNull(projects.archivedAt));

  const [{ total }] = await db.select({ total: count() }).from(projects).where(where);
  const base = await db
    .select({ id: projects.id, code: projects.projectCode, name: projects.name, status: projects.status, budget: projects.budgetAmount, currency: projects.currency })
    .from(projects)
    .where(where)
    .orderBy(asc(projects.name), asc(projects.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  if (base.length === 0) return { rows: [], total, page, pageSize };
  const ids = base.map((p) => p.id);

  const [invoiced, received, paid, [company]] = await Promise.all([
    db
      .select({ projectId: invoices.projectId, currency: invoices.currency, amount: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)::numeric` })
      .from(invoices)
      .where(and(eq(invoices.companyId, actor.companyId), eq(invoices.status, "issued"), inArray(invoices.projectId, ids)))
      .groupBy(invoices.projectId, invoices.currency),
    db
      .select({ projectId: invoices.projectId, currency: invoices.currency, amount: sql<string>`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)::numeric` })
      .from(paymentAllocations)
      .innerJoin(payments, and(eq(payments.id, paymentAllocations.paymentId), eq(payments.companyId, paymentAllocations.companyId), eq(payments.status, "confirmed"), isNull(payments.reversedAt)))
      .innerJoin(invoices, and(eq(invoices.id, paymentAllocations.invoiceId), eq(invoices.companyId, paymentAllocations.companyId)))
      .where(and(eq(paymentAllocations.companyId, actor.companyId), inArray(invoices.projectId, ids)))
      .groupBy(invoices.projectId, invoices.currency),
    db
      .select({ projectId: expenses.projectId, amount: sql<string>`COALESCE(SUM(${expensePayments.amount}::numeric), 0)::numeric` })
      .from(expensePayments)
      .innerJoin(expenses, and(eq(expenses.id, expensePayments.expenseId), eq(expenses.companyId, expensePayments.companyId)))
      .where(and(eq(expensePayments.companyId, actor.companyId), eq(expensePayments.status, "confirmed"), isNull(expensePayments.reversedAt), inArray(expenses.projectId, ids)))
      .groupBy(expenses.projectId),
    db.select({ currency: companies.currency }).from(companies).where(eq(companies.id, actor.companyId)),
  ]);

  const rows: ProjectFinanceRow[] = [];
  for (const p of base) {
    // Expense payments are in the company currency; invoices and receipts carry their own.
    const currencies = new Set<string>([
      ...invoiced.filter((r) => r.projectId === p.id).map((r) => r.currency),
      ...received.filter((r) => r.projectId === p.id).map((r) => r.currency),
    ]);
    const outflow = paid.find((r) => r.projectId === p.id);
    if (outflow && Number(outflow.amount) > 0) currencies.add(company?.currency ?? p.currency);
    if (currencies.size === 0) currencies.add(p.currency);
    for (const currency of [...currencies].sort()) {
      const inv = invoiced.find((r) => r.projectId === p.id && r.currency === currency)?.amount ?? "0";
      const rec = received.find((r) => r.projectId === p.id && r.currency === currency)?.amount ?? "0";
      const out = currency === (company?.currency ?? p.currency) ? (outflow?.amount ?? "0") : "0";
      rows.push({
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        status: p.status,
        currency,
        budget: currency === p.currency ? p.budget : null,
        invoiced: fromMinor(toMinor(inv)),
        confirmedReceipts: fromMinor(toMinor(rec)),
        confirmedExpensePayments: fromMinor(toMinor(out)),
        netCashMovement: fromMinor(toMinor(rec) - toMinor(out)),
      });
    }
  }
  return { rows, total, page, pageSize };
}
