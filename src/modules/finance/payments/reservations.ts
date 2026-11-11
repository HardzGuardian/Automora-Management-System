import { add } from "../../../lib/money";
import { calcOutstanding } from "../invoices/balance";

/** Pending payments reserve room so they cannot become impossible to confirm. */
export function calcAvailablePaymentAmount(
  totalMinor: number,
  confirmedMinor: number,
  pendingMinor: number,
): number {
  return calcOutstanding(totalMinor, add(confirmedMinor, pendingMinor));
}
