import { describe, expect, it } from "vitest";
import { calculateProjectCashNet } from "./cash-movement";

describe("project cash based financial summary", () => {
  it("nets confirmed cash movements without combining currencies", () => {
    expect(calculateProjectCashNet(
      [{ currency: "USD", amount: "500.00" }, { currency: "EUR", amount: "20.00" }],
      [{ currency: "USD", amount: "125.50" }],
    )).toEqual([
      { currency: "EUR", confirmedReceipts: "20.00", confirmedExpensePayments: "0.00", netCashMovement: "20.00" },
      { currency: "USD", confirmedReceipts: "500.00", confirmedExpensePayments: "125.50", netCashMovement: "374.50" },
    ]);
  });

  it("keeps a negative net movement when outflow exceeds receipts", () => {
    expect(calculateProjectCashNet([], [{ currency: "USD", amount: "50.00" }])).toEqual([
      { currency: "USD", confirmedReceipts: "0.00", confirmedExpensePayments: "50.00", netCashMovement: "-50.00" },
    ]);
  });
});
