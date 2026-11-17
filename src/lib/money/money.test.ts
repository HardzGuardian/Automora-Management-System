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

  it("rejects runtime numbers and non-string inputs instead of coercing them", () => {
    for (const value of [0.1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(() => Reflect.apply(toMinor, undefined, [value])).toThrow();
    }
    expect(() => Reflect.apply(mul, undefined, [0.5, 100])).toThrow();
  });

  it("rejects overlong decimal inputs before doing large integer work", () => {
    const overlong = "1".repeat(100_000);
    expect(() => toMinor(overlong)).toThrow(RangeError);
    expect(() => mul(overlong, 100)).toThrow(RangeError);
  });

  it("accepts the safe-integer boundary and rejects overflow", () => {
    expect(toMinor("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => toMinor("90071992547409.92")).toThrow(RangeError);
    expect(() => add(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
    expect(() => fromMinor(Number.NaN)).toThrow(RangeError);
  });

  it("formats currency for display", () => {
    expect(formatMoney(12345, "INR")).toContain("123.45");
  });
});
