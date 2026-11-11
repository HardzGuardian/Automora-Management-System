import { sub } from "../../../lib/money";

export type InvoiceLifecycleState = "draft" | "issued" | "cancelled";
export type DerivedInvoiceStatus =
  | InvoiceLifecycleState
  | "partially_paid"
  | "paid"
  | "overdue";

export type InvoiceStatusInput = {
  state: InvoiceLifecycleState;
  totalMinor: number;
  confirmedReceiptsMinor: number;
  dueDate: string;
  today: string;
};

/** Only issued invoices can accept receipt activity. */
export function isReceivableInvoiceState(state: InvoiceLifecycleState): boolean {
  return state === "issued";
}

function assertNonNegativeMinor(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of minor units.`);
  }
}

function assertBusinessDate(value: string, name: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`${name} must be a valid YYYY-MM-DD date.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];
  if (maximumDay === undefined || month < 1 || month > 12 || day < 1 || day > maximumDay) {
    throw new TypeError(`${name} must be a valid YYYY-MM-DD date.`);
  }
}

/** Calculate balance using confirmed, non-reversed receipts only. */
export function calcOutstanding(totalMinor: number, confirmedReceiptsMinor: number): number {
  assertNonNegativeMinor(totalMinor, "Invoice total");
  assertNonNegativeMinor(confirmedReceiptsMinor, "Confirmed receipts");
  return Math.max(sub(totalMinor, confirmedReceiptsMinor), 0);
}

/** Derive the display status; overdue is based on business dates and positive balance. */
export function deriveInvoiceStatus(input: InvoiceStatusInput): DerivedInvoiceStatus {
  const { state, totalMinor, confirmedReceiptsMinor, dueDate, today } = input;
  if (state !== "draft" && state !== "issued" && state !== "cancelled") {
    throw new TypeError("Invoice state must be draft, issued, or cancelled.");
  }

  const outstandingMinor = calcOutstanding(totalMinor, confirmedReceiptsMinor);
  if (state === "draft" || state === "cancelled") return state;
  assertBusinessDate(dueDate, "Due date");
  assertBusinessDate(today, "Today");

  if (outstandingMinor === 0) return "paid";
  if (dueDate < today) return "overdue";
  if (confirmedReceiptsMinor > 0) return "partially_paid";
  return "issued";
}
