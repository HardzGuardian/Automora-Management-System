import { describe, expect, it } from "vitest";
import { calcAvailablePaymentAmount } from "./reservations";

describe("available amount after pending payment reservations", () => {
  it("subtracts confirmed and pending amounts from the invoice total", () => {
    expect(calcAvailablePaymentAmount(10_000, 2_000, 5_000)).toBe(3_000);
  });

  it("returns no available amount when existing reservations cover or exceed the total", () => {
    expect(calcAvailablePaymentAmount(10_000, 4_000, 6_000)).toBe(0);
    expect(calcAvailablePaymentAmount(10_000, 4_000, 7_000)).toBe(0);
  });
});
