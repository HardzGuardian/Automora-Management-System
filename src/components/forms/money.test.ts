import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./money";

describe("parseMoneyInput", () => {
  it.each([
    ["1234.5", "1234.50"],
    ["1,234.50", "1234.50"],
    [" 10 ", "10.00"],
    ["0.07", "0.07"],
    ["999999999999.99", "999999999999.99"],
  ])("accepts %j", (input, out) => expect(parseMoneyInput(input)).toBe(out));

  it.each(["", "abc", "-5", "1.234", "1e3", "12.", ".5", "1,2,3.4x", "1000000000000"])("rejects %j", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});
