const INVOICE_NUMBER_SEQUENCE_MAX = 999_999;

export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("Invoice year must be a four-digit year.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > INVOICE_NUMBER_SEQUENCE_MAX) {
    throw new RangeError("Invoice sequence must be between 1 and 999999.");
  }
  return `INV-${year}-${sequence.toString().padStart(6, "0")}`;
}
