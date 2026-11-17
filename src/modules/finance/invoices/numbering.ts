import "server-only";
import { nextSequence } from "@/lib/codes";
import type { withTransaction } from "@/db";
import { formatInvoiceNumber } from "./numbering-format";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export { formatInvoiceNumber } from "./numbering-format";

/** Call inside the issue transaction so sequence allocation commits atomically with issue. */
export async function nextInvoiceNumber(
  tx: FinanceTransaction,
  companyId: string,
  issueDate: string,
): Promise<string> {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(issueDate);
  const yearText = match?.[1];
  if (!yearText) throw new TypeError("Invoice issue date must be YYYY-MM-DD.");
  const sequence = await nextSequence(tx, companyId, "INV");
  return formatInvoiceNumber(Number(yearText), sequence);
}
