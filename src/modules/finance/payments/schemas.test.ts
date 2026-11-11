import { describe, expect, it } from "vitest";
import { confirmReceiptSchema, createReceiptSchema, reverseReceiptSchema } from "./schemas";

const validReceipt = {
  invoiceId: "4f86e663-629b-4b3b-b1a4-a239ce7f85a0",
  amount: "100.00",
  paymentDate: "2026-11-11",
  method: "bank_transfer",
  reference: "UTR12345",
  idempotencyKey: "84b5b664-6cc1-4690-9c53-c1b222b4ceec",
};

describe("receipt input schema", () => {
  it("validates and defaults receipt state to pending", () => {
    const result = createReceiptSchema.safeParse(validReceipt);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("pending");
  });

  it.each([
    { ...validReceipt, amount: "0" },
    { ...validReceipt, amount: "-1" },
    { ...validReceipt, amount: "1.005" },
    { ...validReceipt, amount: "1000000000000.00" },
    { ...validReceipt, paymentDate: "2026-02-30" },
    { ...validReceipt, method: "upi", reference: " " },
  ])("rejects invalid receipt input", (input) => {
    expect(createReceiptSchema.safeParse(input).success).toBe(false);
  });

  it("allows a cash receipt without a reference", () => {
    expect(createReceiptSchema.safeParse({ ...validReceipt, method: "cash", reference: undefined }).success).toBe(true);
  });
});

describe("receipt confirmation schema", () => {
  it("accepts a payment UUID", () => {
    expect(confirmReceiptSchema.safeParse({ paymentId: validReceipt.invoiceId }).success).toBe(true);
  });

  it("rejects malformed payment IDs", () => {
    expect(confirmReceiptSchema.safeParse({ paymentId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("receipt reversal schema", () => {
  it("requires a non-empty reason and a payment UUID", () => {
    expect(reverseReceiptSchema.safeParse({ paymentId: validReceipt.invoiceId, reason: "Duplicate entry" }).success).toBe(true);
    expect(reverseReceiptSchema.safeParse({ paymentId: validReceipt.invoiceId, reason: "  " }).success).toBe(false);
    expect(reverseReceiptSchema.safeParse({ paymentId: "bad-id", reason: "Duplicate entry" }).success).toBe(false);
  });
});
