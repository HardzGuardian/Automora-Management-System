import { describe, expect, it } from "vitest";
import { formatExpenseCode } from "./numbering-format";

describe("expense code format", () => {
  it("pads the numeric company sequence", () => {
    expect(formatExpenseCode(1)).toBe("EXP-000001");
    expect(formatExpenseCode(999_999)).toBe("EXP-999999");
  });

  it.each([0, -1, 1.5, 1_000_000])("rejects invalid sequence %s", (sequence) => {
    expect(() => formatExpenseCode(sequence)).toThrow(RangeError);
  });
});
