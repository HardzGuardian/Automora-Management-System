import { sub } from "../../../lib/money";

export type ExpensePaymentStatus = "unpaid" | "partially_paid" | "paid";

function assertNonNegativeMinor(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of minor units.`);
  }
}

/** Calculate the unpaid amount from confirmed, non-reversed expense payments. */
export function calcExpenseOutstanding(totalMinor: number, confirmedPaymentsMinor: number): number {
  assertNonNegativeMinor(totalMinor, "Expense total");
  assertNonNegativeMinor(confirmedPaymentsMinor, "Confirmed expense payments");
  return Math.max(sub(totalMinor, confirmedPaymentsMinor), 0);
}

/** Derive expense payment status from its total and confirmed outgoing payments. */
export function deriveExpenseStatus(
  totalMinor: number,
  confirmedPaymentsMinor: number,
): ExpensePaymentStatus {
  const outstandingMinor = calcExpenseOutstanding(totalMinor, confirmedPaymentsMinor);
  if (outstandingMinor === 0) return "paid";
  if (confirmedPaymentsMinor > 0) return "partially_paid";
  return "unpaid";
}
