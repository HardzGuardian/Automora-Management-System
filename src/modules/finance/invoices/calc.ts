import { add, mul } from "../../../lib/money";

export type InvoiceLineInput = {
  quantity: string;
  unitPriceMinor: number;
  discountMinor: number;
  /** Tax rate as a percentage, for example "18" for 18%. */
  taxRate: string;
};

export type CalculatedInvoiceLine = InvoiceLineInput & {
  subtotalMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type CalculatedInvoice = {
  lines: CalculatedInvoiceLine[];
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
};

function taxRateAsRatio(taxRate: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(taxRate);
  if (!match) throw new TypeError("Tax rate must be a non-negative decimal percentage.");

  const fraction = match[2] ?? "";
  const digits = `${match[1]}${fraction}`;
  const decimalPlaces = fraction.length + 2;
  const padded = digits.padStart(decimalPlaces + 1, "0");
  const splitAt = padded.length - decimalPlaces;
  return `${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

export function calcInvoiceLine(input: InvoiceLineInput): CalculatedInvoiceLine {
  const { quantity, unitPriceMinor, discountMinor, taxRate } = input;
  const subtotalMinor = mul(quantity, unitPriceMinor);
  if (subtotalMinor <= 0) throw new RangeError("Invoice line quantity and amount must be positive.");
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor > subtotalMinor) {
    throw new RangeError("Line discount must be a non-negative amount no greater than the line subtotal.");
  }

  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = mul(taxRateAsRatio(taxRate), taxableMinor);
  const totalMinor = add(taxableMinor, taxMinor);

  return { ...input, subtotalMinor, taxableMinor, taxMinor, totalMinor };
}

/** Calculate invoice totals by summing line values after per-line rounding. */
export function calcInvoice(lines: readonly InvoiceLineInput[]): CalculatedInvoice {
  const calculatedLines = lines.map(calcInvoiceLine);
  const totals = calculatedLines.reduce(
    (result, line) => ({
      subtotalMinor: add(result.subtotalMinor, line.subtotalMinor),
      discountTotalMinor: add(result.discountTotalMinor, line.discountMinor),
      taxTotalMinor: add(result.taxTotalMinor, line.taxMinor),
      totalMinor: add(result.totalMinor, line.totalMinor),
    }),
    { subtotalMinor: 0, discountTotalMinor: 0, taxTotalMinor: 0, totalMinor: 0 },
  );

  return { lines: calculatedLines, ...totals };
}
