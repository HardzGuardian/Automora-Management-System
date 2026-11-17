import { describe, expect, it } from "vitest";
import { calcExpenseOutstanding, deriveExpenseStatus } from "./balance";

describe("expense balance calculations", () => {
  it("calculates unpaid value from confirmed payments", () => {
    expect(calcExpenseOutstanding(50_000, 20_000)).toBe(30_000);
    expect(calcExpenseOutstanding(50_000, 50_000)).toBe(0);
  });

  it("reflects a reversed payment when it is removed from the confirmed total", () => {
    expect(calcExpenseOutstanding(50_000, 35_000)).toBe(15_000);
    expect(calcExpenseOutstanding(50_000, 20_000)).toBe(30_000);
  });

  it("reopens an expense after reversal and reflects a corrected payment", () => {
    const total = 50_000;
    expect(calcExpenseOutstanding(total, 20_000 + 15_000)).toBe(15_000);
    expect(calcExpenseOutstanding(total, 20_000)).toBe(30_000);
    expect(calcExpenseOutstanding(total, 20_000 + 14_000)).toBe(16_000);
  });

  it("clamps overpayment to zero outstanding", () => {
    expect(calcExpenseOutstanding(50_000, 60_000)).toBe(0);
  });

  it.each([
    [50_000, 0, "unpaid"],
    [50_000, 20_000, "partially_paid"],
    [50_000, 50_000, "paid"],
    [50_000, 60_000, "paid"],
    [0, 0, "paid"],
  ] as const)("derives status from total %s and confirmed payments", (total, payments, expected) => {
    expect(deriveExpenseStatus(total, payments)).toBe(expected);
  });

  it.each([
    [-1, 0],
    [100, -1],
    [1.5, 0],
    [100, 1.5],
  ] as const)("rejects invalid minor-unit amounts", (total, payments) => {
    expect(() => calcExpenseOutstanding(total, payments)).toThrow();
  });
});
