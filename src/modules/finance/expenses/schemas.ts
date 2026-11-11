import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

const uuid = z.string().uuid();
const amount = z.string().max(128).regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => {
  const whole = value.split(".")[0]?.replace(/^0+/, "") || "0";
  return whole.length <= 12 && /[1-9]/.test(value);
}, "Amount must be positive and fit NUMERIC(14,2).");
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const expenseFieldsSchema = z.object({
  categoryId: uuid,
  projectId: uuid.nullable().optional(),
  payee: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  expenseDate: businessDate,
  dueDate: businessDate.nullable().optional(),
  total: amount,
});

export const createExpenseSchema = expenseFieldsSchema.extend({ idempotencyKey: uuid });
export const updateExpenseSchema = expenseFieldsSchema.extend({ expenseId: uuid });
export const expenseDtoSchema = z.object({
  id: uuid,
  expenseCode: z.string(),
  categoryId: uuid,
  projectId: uuid.nullable(),
  payee: z.string(),
  description: z.string(),
  expenseDate: businessDate,
  dueDate: businessDate.nullable(),
  total: amount,
  status: z.enum(["unpaid", "partially_paid", "paid"]),
});

export type ExpenseFields = z.infer<typeof expenseFieldsSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
