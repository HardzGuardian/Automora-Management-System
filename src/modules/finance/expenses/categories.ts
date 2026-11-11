import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z, type ZodType } from "zod";
import { db, withTransaction } from "@/db";
import { expenseCategories } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { audit } from "@/modules/audit";
import { createExpenseCategorySchema } from "./schemas";

const categoryIdSchema = z.string().uuid();
const activeSchema = z.boolean();

export type ExpenseCategoryDTO = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Expense category input is invalid.", parsed.error.flatten());
  return parsed.data;
}

export async function listExpenseCategories(actor: Actor, includeInactive = false): Promise<ExpenseCategoryDTO[]> {
  requirePermission(actor, "finance.categories.manage");
  const rows = await db.select({
    id: expenseCategories.id,
    name: expenseCategories.name,
    description: expenseCategories.description,
    active: expenseCategories.active,
  }).from(expenseCategories).where(and(
    eq(expenseCategories.companyId, actor.companyId),
    ...(includeInactive ? [] : [eq(expenseCategories.active, true)]),
  )).orderBy(asc(expenseCategories.name), asc(expenseCategories.id));
  return rows;
}

export async function createExpenseCategory(
  actor: Actor,
  input: unknown,
): Promise<ExpenseCategoryDTO> {
  requirePermission(actor, "finance.categories.manage");
  const parsed = parseInput(createExpenseCategorySchema, input);
  return withTransaction(async (tx) => {
    const [category] = await tx.insert(expenseCategories).values({
      companyId: actor.companyId,
      name: parsed.name,
      description: parsed.description ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }).onConflictDoNothing({ target: [expenseCategories.companyId, expenseCategories.name] })
      .returning({
        id: expenseCategories.id,
        name: expenseCategories.name,
        description: expenseCategories.description,
        active: expenseCategories.active,
      });
    if (!category) throw new DomainError("CONFLICT", "An expense category with that name already exists.");
    await audit.record(tx, {
      actor,
      entity: "expense_category",
      entityId: category.id,
      action: "expense_category.created",
      after: { name: category.name, description: category.description, active: category.active },
    });
    return category;
  });
}

export async function setExpenseCategoryActive(
  actor: Actor,
  categoryId: string,
  active: boolean,
): Promise<ExpenseCategoryDTO> {
  requirePermission(actor, "finance.categories.manage");
  const id = parseInput(categoryIdSchema, categoryId);
  const isActive = parseInput(activeSchema, active);
  return withTransaction(async (tx) => {
    const [current] = await tx.select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      description: expenseCategories.description,
      active: expenseCategories.active,
    }).from(expenseCategories).where(and(
      eq(expenseCategories.id, id),
      eq(expenseCategories.companyId, actor.companyId),
    )).limit(1).for("update");
    if (!current) throw new DomainError("CATEGORY_NOT_FOUND", "Expense category was not found.");
    if (current.active === isActive) return current;

    const [updated] = await tx.update(expenseCategories).set({
      active: isActive,
      updatedAt: new Date(),
      updatedBy: actor.userId,
    }).where(and(
      eq(expenseCategories.id, id),
      eq(expenseCategories.companyId, actor.companyId),
    )).returning({
      id: expenseCategories.id,
      name: expenseCategories.name,
      description: expenseCategories.description,
      active: expenseCategories.active,
    });
    if (!updated) throw new DomainError("CATEGORY_NOT_FOUND", "Expense category was not found.");
    await audit.record(tx, {
      actor,
      entity: "expense_category",
      entityId: updated.id,
      action: isActive ? "expense_category.activated" : "expense_category.deactivated",
      before: { active: current.active },
      after: { active: updated.active },
    });
    return updated;
  });
}
