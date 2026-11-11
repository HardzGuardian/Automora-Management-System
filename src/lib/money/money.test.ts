import { describe, expect, it } from "vitest";
import { add, fromMinor, mul, roundHalfUp, sub, toMinor } from "./money";
import { formatMoney } from "./format";

describe("money helpers", () => {
  it.each([
    ["0", 0],
    ["0.1", 10],
    ["0.20", 20],
    ["123456789012.34", 12345678901234],
    ["1.005", 101],
    ["1.004", 100],
  ] as const)("converts %s to minor units", (amount, expected) => {
    expect(toMinor(amount)).toBe(expected);
  });

  it("adds decimal inputs exactly through minor units", () => {
    expect(add(toMinor("0.1"), toMinor("0.2"))).toBe(30);
    expect(fromMinor(30)).toBe("0.30");
  });

  it.each([
    ["1.5", 100, 150],
    ["0.005", 100, 1],
    ["2", 125, 250],
  ] as const)("multiplies quantity %s by a minor-unit rate", (quantity, rate, expected) => {
    expect(mul(quantity, rate)).toBe(expected);
  });

  it("rounds half-up and supports signed arithmetic results", () => {
    expect(roundHalfUp("2.345")).toBe("2.35");
    expect(sub(10, 25)).toBe(-15);
    expect(fromMinor(-15)).toBe("-0.15");
  });

  it.each(["-1", "NaN", "Infinity", "1e3", " 1.00"] as const)(
    "rejects invalid amount %s",
    (amount) => expect(() => toMinor(amount)).toThrow(),
  );

  it("formats currency for display", () => {
    expect(formatMoney(12345, "INR")).toContain("123.45");
  });
});
