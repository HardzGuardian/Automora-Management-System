import { describe, expect, it } from "vitest";
import { combineCashMovementRows } from "./cash-movement-math";

describe("cash movement reconciliation", () => {
  it("combines raw confirmed receipt and payment rows by date and currency", () => {
    expect(combineCashMovementRows(
      [
        { date: "2026-01-01", currency: "USD", amount: "10.00" },
        { date: "2026-01-01", currency: "USD", amount: "5.00" },
        { date: "2026-01-02", currency: "USD", amount: "2.00" },
      ],
      [
        { date: "2026-01-01", currency: "USD", amount: "4.00" },
        { date: "2026-01-03", currency: "USD", amount: "3.00" },
      ],
    )).toEqual([
      { date: "2026-01-01", currency: "USD", confirmedReceipts: "15.00", confirmedExpensePayments: "4.00", netCashMovement: "11.00" },
      { date: "2026-01-02", currency: "USD", confirmedReceipts: "2.00", confirmedExpensePayments: "0.00", netCashMovement: "2.00" },
      { date: "2026-01-03", currency: "USD", confirmedReceipts: "0.00", confirmedExpensePayments: "3.00", netCashMovement: "-3.00" },
    ]);
  });
});
