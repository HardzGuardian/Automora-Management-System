import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, expenseCategories, expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { calcExpenseOutstanding, deriveExpenseStatus } from "./balance";
import { expenseListSchema, type ExpenseListInput, type ExpenseListQueryInput } from "./schemas";

export type ExpenseBalanceDTO = {
  expenseId: string;
  total: string;
  confirmedPayments: string;
  outstanding: string;
  status: "unpaid" | "partially_paid" | "paid";
};

export type ExpenseListRow = {
  id: string;
  expenseCode: string;
  categoryId: string;
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

export type ExpenseListDTO = { rows: ExpenseListRow[]; total: number; page: number; pageSize: number };

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

function parseListInput(input: ExpenseListQueryInput): ExpenseListInput {
  const parsed = expenseListSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Expense filters are invalid.", parsed.error.flatten());
  return parsed.data;
}

export async function listExpenses(actor: Actor, input: ExpenseListQueryInput = {}): Promise<ExpenseListDTO> {
  requirePermission(actor, "finance.expenses.read");
  const filters = parseListInput(input);
  const expenseTotals = db.select({
    expenseId: expensePayments.expenseId,
    companyId: expensePayments.companyId,
    total: confirmedExpenseTotal,
  }).from(expensePayments).where(and(
    eq(expensePayments.companyId, actor.companyId),
    eq(expensePayments.status, "confirmed"),
    isNull(expensePayments.reversedAt),
  )).groupBy(expensePayments.expenseId, expensePayments.companyId).as("confirmed_expense_payments");
  const conditions = [eq(expenses.companyId, actor.companyId), isNull(expenses.archivedAt)];
  if (filters.categoryId) conditions.push(eq(expenses.categoryId, filters.categoryId));
  if (filters.projectId) conditions.push(eq(expenses.projectId, filters.projectId));
  const base = db.select({
    id: expenses.id,
    expenseCode: expenses.expenseCode,
    categoryId: expenses.categoryId,
    categoryName: expenseCategories.name,
    projectId: expenses.projectId,
    payee: expenses.payee,
    description: expenses.description,
    expenseDate: expenses.expenseDate,
    dueDate: expenses.dueDate,
    currency: companies.currency,
    total: expenses.total,
    confirmedPayments: sql<string>`COALESCE(${expenseTotals.total}, 0)::numeric`,
    outstanding: sql<string>`GREATEST(${expenses.total}::numeric - COALESCE(${expenseTotals.total}, 0)::numeric, 0)::numeric`,
    status: sql<ExpenseListRow["status"]>`CASE
      WHEN GREATEST(${expenses.total}::numeric - COALESCE(${expenseTotals.total}, 0)::numeric, 0) <= 0 THEN 'paid'
      WHEN COALESCE(${expenseTotals.total}, 0)::numeric > 0 THEN 'partially_paid'
      ELSE 'unpaid'
    END`.as("status"),
  }).from(expenses)
    .innerJoin(companies, eq(companies.id, expenses.companyId))
    .innerJoin(expenseCategories, and(
      eq(expenseCategories.id, expenses.categoryId),
      eq(expenseCategories.companyId, expenses.companyId),
    ))
    .leftJoin(expenseTotals, and(
      eq(expenseTotals.expenseId, expenses.id),
      eq(expenseTotals.companyId, expenses.companyId),
    ))
    .where(and(...conditions)).as("expense_balance_view");
  const statusCondition = filters.status ? eq(base.status, filters.status) : undefined;
  const [countRow] = await db.select({ value: count() }).from(base).where(statusCondition);
  const rows = await db.select().from(base).where(statusCondition)
    .orderBy(desc(base.expenseDate), desc(base.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return {
    rows: rows.map((row) => ({
      ...row,
      total: fromMinor(toMinor(row.total)),
      confirmedPayments: fromMinor(toMinor(row.confirmedPayments)),
      outstanding: fromMinor(toMinor(row.outstanding)),
    })),
    total: countRow?.value ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getExpenseDetail(actor: Actor, expenseId: string) {
  const balance = await getExpenseBalance(actor, expenseId);
  const [expense] = await db.select({
    id: expenses.id,
    expenseCode: expenses.expenseCode,
    categoryId: expenses.categoryId,
    categoryName: expenseCategories.name,
    projectId: expenses.projectId,
    payee: expenses.payee,
    description: expenses.description,
    expenseDate: expenses.expenseDate,
    dueDate: expenses.dueDate,
    currency: companies.currency,
    total: expenses.total,
  }).from(expenses)
    .innerJoin(companies, eq(companies.id, expenses.companyId))
    .innerJoin(expenseCategories, and(
      eq(expenseCategories.id, expenses.categoryId),
      eq(expenseCategories.companyId, expenses.companyId),
    )).where(and(
      eq(expenses.id, expenseId),
      eq(expenses.companyId, actor.companyId),
      isNull(expenses.archivedAt),
    )).limit(1);
  if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
  return {
    ...expense,
    total: fromMinor(toMinor(expense.total)),
    ...balance,
  };
}
