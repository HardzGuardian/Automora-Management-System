import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { ZodType } from "zod";
import { withTransaction } from "@/db";
import { expenseCategories, expensePayments, expenses, projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { beginIdempotentOperation, completeIdempotentOperation } from "@/lib/idempotency/with-idempotency";
import { audit } from "@/modules/audit";
import {
  createExpenseSchema,
  expenseDtoSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type ExpenseFields,
  type UpdateExpenseInput,
} from "./schemas";
import { nextExpenseCode } from "./numbering";

type ExpenseTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export type ExpenseDTO = {
  id: string;
  expenseCode: string;
  categoryId: string;
  projectId: string | null;
  payee: string;
  description: string;
  expenseDate: string;
  dueDate: string | null;
  total: string;
  status: "unpaid" | "partially_paid" | "paid";
};

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Expense input is invalid.", parsed.error.flatten());
  return parsed.data;
}

async function validateExpenseRelations(
  tx: ExpenseTransaction,
  companyId: string,
  fields: ExpenseFields,
  existingCategoryId?: string,
): Promise<void> {
  const [category] = await tx.select({ id: expenseCategories.id, active: expenseCategories.active }).from(expenseCategories).where(and(
    eq(expenseCategories.id, fields.categoryId),
    eq(expenseCategories.companyId, companyId),
  )).limit(1);
  if (!category || (!category.active && category.id !== existingCategoryId)) {
    throw new DomainError("CATEGORY_NOT_FOUND", "Active expense category was not found.");
  }

  if (fields.projectId) {
    const [project] = await tx.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, fields.projectId),
      eq(projects.companyId, companyId),
    )).limit(1);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Project was not found.");
  }
}

function toExpenseDTO(row: unknown): ExpenseDTO {
  const parsed = expenseDtoSchema.safeParse(row);
  if (!parsed.success) throw new DomainError("CONFLICT", "Expense data could not be returned.");
  return parsed.data;
}

export async function createExpense(actor: Actor, input: CreateExpenseInput): Promise<ExpenseDTO> {
  requirePermission(actor, "finance.expenses.create");
  const parsed = parseInput(createExpenseSchema, input);
  const total = fromMinor(toMinor(parsed.total));
  const requestHash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");

  return withTransaction(async (tx) => {
    const claim = await beginIdempotentOperation(tx, {
      companyId: actor.companyId,
      key: parsed.idempotencyKey,
      operation: "expense.create",
      requestHash,
    });
    if (claim.replay) return toExpenseDTO(claim.response);
    await validateExpenseRelations(tx, actor.companyId, parsed);
    const expenseCode = await nextExpenseCode(tx, actor.companyId);
    const [expense] = await tx.insert(expenses).values({
      companyId: actor.companyId,
      categoryId: parsed.categoryId,
      projectId: parsed.projectId ?? null,
      expenseCode,
      payee: parsed.payee,
      description: parsed.description,
      expenseDate: parsed.expenseDate,
      dueDate: parsed.dueDate ?? null,
      total,
      status: "unpaid",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }).returning({
      id: expenses.id,
      expenseCode: expenses.expenseCode,
      categoryId: expenses.categoryId,
      projectId: expenses.projectId,
      payee: expenses.payee,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      dueDate: expenses.dueDate,
      total: expenses.total,
      status: expenses.status,
    });
    if (!expense) throw new DomainError("CONFLICT", "Expense could not be created.");
    const dto = toExpenseDTO(expense);
    await completeIdempotentOperation(tx, claim.id, "expense", expense.id, dto);
    await audit.record(tx, {
      actor,
      entity: "expense",
      entityId: expense.id,
      action: "expense.created",
      after: { expenseCode, categoryId: expense.categoryId, projectId: expense.projectId, total, status: expense.status },
    });
    return dto;
  });
}

export async function updateExpense(actor: Actor, input: UpdateExpenseInput): Promise<ExpenseDTO> {
  requirePermission(actor, "finance.expenses.update");
  const parsed = parseInput(updateExpenseSchema, input);
  const total = fromMinor(toMinor(parsed.total));
  return withTransaction(async (tx) => {
    const [current] = await tx.select().from(expenses).where(and(
      eq(expenses.id, parsed.expenseId),
      eq(expenses.companyId, actor.companyId),
      isNull(expenses.archivedAt),
    )).limit(1).for("update");
    if (!current) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
    const [existingPayment] = await tx.select({ id: expensePayments.id }).from(expensePayments).where(and(
      eq(expensePayments.expenseId, current.id),
      eq(expensePayments.companyId, actor.companyId),
    )).limit(1);
    if (existingPayment) throw new DomainError("CONFLICT", "An expense cannot be edited after a payment has been recorded.");

    await validateExpenseRelations(tx, actor.companyId, parsed, current.categoryId);
    const [updated] = await tx.update(expenses).set({
      categoryId: parsed.categoryId,
      projectId: parsed.projectId ?? null,
      payee: parsed.payee,
      description: parsed.description,
      expenseDate: parsed.expenseDate,
      dueDate: parsed.dueDate ?? null,
      total,
      updatedAt: new Date(),
      updatedBy: actor.userId,
    }).where(and(
      eq(expenses.id, current.id),
      eq(expenses.companyId, actor.companyId),
      isNull(expenses.archivedAt),
    )).returning({
      id: expenses.id,
      expenseCode: expenses.expenseCode,
      categoryId: expenses.categoryId,
      projectId: expenses.projectId,
      payee: expenses.payee,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      dueDate: expenses.dueDate,
      total: expenses.total,
      status: expenses.status,
    });
    if (!updated) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
    const dto = toExpenseDTO(updated);
    await audit.record(tx, {
      actor,
      entity: "expense",
      entityId: current.id,
      action: "expense.updated",
      before: { categoryId: current.categoryId, projectId: current.projectId, total: current.total, status: current.status },
      after: { categoryId: updated.categoryId, projectId: updated.projectId, total: updated.total, status: updated.status },
    });
    return dto;
  });
}

/**
 * Archives an expense so it leaves the lists and reports. Allowed only while no payment is recorded
 * against it (a paid expense must be reversed first); the row and its history are kept.
 */
export async function archiveExpense(actor: Actor, expenseId: string, reason?: string): Promise<void> {
  requirePermission(actor, "finance.expenses.update");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expenseId)) throw new DomainError("VALIDATION", "Expense ID is invalid.");
  await withTransaction(async (tx) => {
    const [current] = await tx.select({ id: expenses.id, expenseCode: expenses.expenseCode }).from(expenses).where(and(
      eq(expenses.id, expenseId),
      eq(expenses.companyId, actor.companyId),
      isNull(expenses.archivedAt),
    )).limit(1).for("update");
    if (!current) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
    const [live] = await tx.select({ id: expensePayments.id }).from(expensePayments).where(and(
      eq(expensePayments.expenseId, current.id),
      eq(expensePayments.companyId, actor.companyId),
      ne(expensePayments.status, "reversed"),
    )).limit(1);
    if (live) throw new DomainError("CONFLICT", "This expense has a payment recorded. Reverse the payment first, then archive it.");
    const now = new Date();
    await tx.update(expenses).set({ archivedAt: now, updatedAt: now, updatedBy: actor.userId }).where(and(eq(expenses.id, current.id), eq(expenses.companyId, actor.companyId)));
    await audit.record(tx, { actor, entity: "expense", entityId: current.id, action: "expense.archived", after: { expenseCode: current.expenseCode, reason: reason?.trim().slice(0, 300) || null } });
  });
}
