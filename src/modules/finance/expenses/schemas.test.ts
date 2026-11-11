import { describe, expect, it } from "vitest";
import { createExpenseSchema, expenseAttachmentSchema, updateExpenseSchema } from "./schemas";

const validExpense = {
  categoryId: "4f86e663-629b-4b3b-b1a4-a239ce7f85a0",
  projectId: null,
  payee: "Office supplier",
  description: "Printer paper",
  expenseDate: "2026-11-11",
  dueDate: null,
  total: "12.50",
  idempotencyKey: "84b5b664-6cc1-4690-9c53-c1b222b4ceec",
};

describe("expense input schemas", () => {
  it("accepts valid new expense data", () => {
    expect(createExpenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it.each([
    { ...validExpense, total: "0.00" },
    { ...validExpense, total: "-2.00" },
    { ...validExpense, total: "2.005" },
    { ...validExpense, expenseDate: "2026-02-30" },
    { ...validExpense, payee: " " },
  ])("rejects invalid expense data", (input) => {
    expect(createExpenseSchema.safeParse(input).success).toBe(false);
  });

  it("requires the expense ID on updates and drops the idempotency key", () => {
    const { idempotencyKey: _key, ...fields } = validExpense;
    expect(updateExpenseSchema.safeParse({ ...fields, expenseId: validExpense.categoryId }).success).toBe(true);
  });

  it("allows documented attachment types within the size limit", () => {
    expect(expenseAttachmentSchema.safeParse({ fileName: "receipt.pdf", contentType: "application/pdf", size: 1024 }).success).toBe(true);
    expect(expenseAttachmentSchema.safeParse({ fileName: "receipt.exe", contentType: "application/pdf", size: 1024 }).success).toBe(false);
    expect(expenseAttachmentSchema.safeParse({ fileName: "../receipt.pdf", contentType: "application/pdf", size: 1024 }).success).toBe(false);
    expect(expenseAttachmentSchema.safeParse({ fileName: "receipt.pdf", contentType: "application/pdf", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});
