const INVOICE_NUMBER_SEQUENCE_MAX = 999_999;

export function formatInvoiceNumber(year: number, sequence: number, cfg: { prefix: string; padding: number } = { prefix: "INV", padding: 6 }): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("Invoice year must be a four-digit year.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > INVOICE_NUMBER_SEQUENCE_MAX) {
    throw new RangeError("Invoice sequence must be between 1 and 999999.");
  }
  return `${cfg.prefix}-${year}-${sequence.toString().padStart(cfg.padding, "0")}`;
}
