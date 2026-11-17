import { describe, expect, it } from "vitest";
import { confirmExpensePaymentSchema, recordExpensePaymentSchema, reverseExpensePaymentSchema } from "./schemas";

const payment = {
  expenseId: "4f86e663-629b-4b3b-b1a4-a239ce7f85a0",
  amount: "25.50",
  paymentDate: "2026-11-11",
  method: "bank_transfer",
  reference: "TX-123",
  idempotencyKey: "84b5b664-6cc1-4690-9c53-c1b222b4ceec",
};

describe("expense payment inputs", () => {
  it("defaults to pending", () => {
    const result = recordExpensePaymentSchema.safeParse(payment);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("pending");
  });

  it.each([
    { ...payment, amount: "0" },
    { ...payment, amount: "-1" },
    { ...payment, amount: "1.005" },
    { ...payment, paymentDate: "2026-02-30" },
  ])("rejects invalid payment data", (input) => {
    expect(recordExpensePaymentSchema.safeParse(input).success).toBe(false);
  });

  it("allows cash payments without a reference", () => {
    expect(recordExpensePaymentSchema.safeParse({ ...payment, method: "cash", reference: undefined }).success).toBe(true);
  });

  it("requires a UUID for confirmation and a reason for reversal", () => {
    expect(confirmExpensePaymentSchema.safeParse({ paymentId: payment.expenseId }).success).toBe(true);
    expect(reverseExpensePaymentSchema.safeParse({ paymentId: payment.expenseId, reason: "Duplicate" }).success).toBe(true);
    expect(reverseExpensePaymentSchema.safeParse({ paymentId: payment.expenseId, reason: " " }).success).toBe(false);
  });
});
