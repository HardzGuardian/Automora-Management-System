import { describe, expect, it } from "vitest";
import { calcOutstanding, deriveInvoiceStatus } from "./balance";

describe("invoice balance calculations", () => {
  it("matches the receipt and reversal example", () => {
    expect(calcOutstanding(50_000, 20_000)).toBe(30_000);
    expect(calcOutstanding(50_000, 35_000)).toBe(15_000);
    // Reversing the 15,000 receipt removes it from the confirmed total.
    expect(calcOutstanding(50_000, 20_000)).toBe(30_000);
  });

  it("never returns a negative balance", () => {
    expect(calcOutstanding(50_000, 60_000)).toBe(0);
    expect(calcOutstanding(0, 0)).toBe(0);
  });

  it.each([
    [{ state: "draft", totalMinor: 10_000, confirmedReceiptsMinor: 0, dueDate: "2026-01-01", today: "2026-02-01" }, "draft"],
    [{ state: "cancelled", totalMinor: 10_000, confirmedReceiptsMinor: 0, dueDate: "2026-01-01", today: "2026-02-01" }, "cancelled"],
    [{ state: "issued", totalMinor: 10_000, confirmedReceiptsMinor: 0, dueDate: "2026-02-01", today: "2026-02-01" }, "issued"],
    [{ state: "issued", totalMinor: 10_000, confirmedReceiptsMinor: 2_000, dueDate: "2026-02-01", today: "2026-02-01" }, "partially_paid"],
    [{ state: "issued", totalMinor: 10_000, confirmedReceiptsMinor: 10_000, dueDate: "2026-01-01", today: "2026-02-01" }, "paid"],
    [{ state: "issued", totalMinor: 10_000, confirmedReceiptsMinor: 0, dueDate: "2026-01-31", today: "2026-02-01" }, "overdue"],
    [{ state: "issued", totalMinor: 10_000, confirmedReceiptsMinor: 2_000, dueDate: "2026-01-31", today: "2026-02-01" }, "overdue"],
  ] as const)("derives invoice status as %s", (input, expected) => {
    expect(deriveInvoiceStatus(input)).toBe(expected);
  });

  it.each([
    [-1, 0],
    [100, -1],
    [1.5, 0],
  ] as const)("rejects invalid minor-unit amounts", (total, receipts) => {
    expect(() => calcOutstanding(total, receipts)).toThrow();
  });

  it("rejects invalid business dates for issued invoices", () => {
    expect(() => deriveInvoiceStatus({
      state: "issued",
      totalMinor: 100,
      confirmedReceiptsMinor: 0,
      dueDate: "2026-02-30",
      today: "2026-03-01",
    })).toThrow();
  });
});
