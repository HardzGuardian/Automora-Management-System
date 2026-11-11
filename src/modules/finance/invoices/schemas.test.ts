import { describe, expect, it } from "vitest";
import { createInvoiceDraftSchema, invoiceLineInputSchema, invoiceListSchema } from "./schemas";

const validLine = {
  description: "Consulting",
  quantity: "1.2500",
  unitPrice: "1250.50",
  discount: "0.50",
  taxRate: "18.0000",
};

describe("invoice input schemas", () => {
  it("accepts values that fit the finance column precisions", () => {
    expect(invoiceLineInputSchema.safeParse(validLine).success).toBe(true);
  });

  it.each([
    { ...validLine, quantity: "10000000000.0000" },
    { ...validLine, quantity: "1.00001" },
    { ...validLine, unitPrice: "1000000000000.00" },
    { ...validLine, unitPrice: "1.005" },
    { ...validLine, taxRate: "1000.0000" },
    { ...validLine, taxRate: "18.00001" },
    { ...validLine, discount: "1.005" },
  ])("rejects values that would be rounded or overflow their DB numeric column", (input) => {
    expect(invoiceLineInputSchema.safeParse(input).success).toBe(false);
  });

  it("limits draft invoices to 100 lines and rejects invalid calendar dates", () => {
    const input = {
      clientId: "4f86e663-629b-4b3b-b1a4-a239ce7f85a0",
      idempotencyKey: "84b5b664-6cc1-4690-9c53-c1b222b4ceec",
      dueDate: "2026-02-29",
      items: Array.from({ length: 101 }, () => validLine),
    };
    expect(createInvoiceDraftSchema.safeParse(input).success).toBe(false);
    expect(createInvoiceDraftSchema.safeParse({ ...input, dueDate: "2028-02-29", items: [validLine] }).success).toBe(true);
  });

  it("bounds list pagination and validates filter date order", () => {
    expect(invoiceListSchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
    expect(invoiceListSchema.safeParse({ page: Number.MAX_SAFE_INTEGER, pageSize: 100 }).success).toBe(false);
    expect(invoiceListSchema.safeParse({ fromDate: "2026-03-01", toDate: "2026-02-01" }).success).toBe(false);
  });
});
