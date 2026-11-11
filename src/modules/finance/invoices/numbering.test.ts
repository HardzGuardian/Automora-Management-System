import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "./numbering-format";

describe("invoice numbering format", () => {
  it.each([
    [2026, 1, "INV-2026-000001"],
    [2026, 999_999, "INV-2026-999999"],
  ] as const)("formats %s sequence %s", (year, sequence, expected) => {
    expect(formatInvoiceNumber(year, sequence)).toBe(expected);
  });

  it.each([
    [999, 1],
    [10_000, 1],
    [2026, 0],
    [2026, 1_000_000],
    [2026.5, 1],
  ] as const)("rejects invalid year/sequence %s/%s", (year, sequence) => {
    expect(() => formatInvoiceNumber(year, sequence)).toThrow(RangeError);
  });
});
