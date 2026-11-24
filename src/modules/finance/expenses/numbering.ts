import "server-only";
import { loadNumberingConfig, nextSequence } from "@/lib/codes";
import type { withTransaction } from "@/db";
import { formatExpenseCode } from "./numbering-format";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export { formatExpenseCode } from "./numbering-format";

export async function nextExpenseCode(tx: FinanceTransaction, companyId: string): Promise<string> {
  const sequence = await nextSequence(tx, companyId, "EXP");
  return formatExpenseCode(sequence, await loadNumberingConfig(tx, companyId, "EXP"));
}
