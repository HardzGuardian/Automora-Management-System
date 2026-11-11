import { describe, expect, it } from "vitest";
import { calcInvoice, calcInvoiceLine, type InvoiceLineInput } from "./calc";

const line = (overrides: Partial<InvoiceLineInput> = {}): InvoiceLineInput => ({
  quantity: "1",
  unitPriceMinor: 10_000,
  discountMinor: 0,
  taxRate: "18",
  ...overrides,
});

describe("invoice calculations", () => {
  it("calculates quantity, fixed discount, exclusive tax, and line total", () => {
    expect(calcInvoiceLine(line({ quantity: "2", discountMinor: 500 }))).toMatchObject({
      subtotalMinor: 20_000,
      taxableMinor: 19_500,
      taxMinor: 3_510,
      totalMinor: 23_010,
    });
  });

  it("sums totals after rounding tax per line", () => {
    const result = calcInvoice([
      line({ unitPriceMinor: 1, taxRate: "50" }),
      line({ unitPriceMinor: 1, taxRate: "50" }),
    ]);

    expect(result).toMatchObject({
      subtotalMinor: 2,
      discountTotalMinor: 0,
      taxTotalMinor: 2,
      totalMinor: 4,
    });
    expect(result.lines.map(({ taxMinor }) => taxMinor)).toEqual([1, 1]);
  });

  it("supports zero tax and a full line discount", () => {
    expect(calcInvoiceLine(line({ discountMinor: 10_000, taxRate: "0" }))).toMatchObject({
      taxableMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    });
  });

  it("calculates an empty draft as zero totals", () => {
    expect(calcInvoice([])).toMatchObject({
      lines: [],
      subtotalMinor: 0,
      discountTotalMinor: 0,
      taxTotalMinor: 0,
      totalMinor: 0,
    });
  });

  it.each([
    { quantity: "0", unitPriceMinor: 100, discountMinor: 0, taxRate: "0" },
    { quantity: "-1", unitPriceMinor: 100, discountMinor: 0, taxRate: "0" },
    { quantity: "1", unitPriceMinor: 100, discountMinor: -1, taxRate: "0" },
    { quantity: "1", unitPriceMinor: 100, discountMinor: 101, taxRate: "0" },
    { quantity: "1", unitPriceMinor: 100, discountMinor: 0, taxRate: "-1" },
    { quantity: "1", unitPriceMinor: 100, discountMinor: 0, taxRate: "NaN" },
  ] as const)("rejects invalid invoice line input %#", (input) => {
    expect(() => calcInvoiceLine(input)).toThrow();
  });

  it("rejects overlong quantities and tax rates before large integer work", () => {
    const overlong = "1".repeat(100_000);
    expect(() => calcInvoiceLine(line({ quantity: overlong }))).toThrow(RangeError);
    expect(() => calcInvoiceLine(line({ taxRate: overlong }))).toThrow(RangeError);
  });

  it("rejects totals that exceed safe integer minor-unit precision", () => {
    const largeLine = line({ unitPriceMinor: Number.MAX_SAFE_INTEGER, taxRate: "0" });
    expect(() => calcInvoice([largeLine, largeLine])).toThrow(RangeError);
  });
});
