import "server-only";
import { nextCode } from "@/lib/codes";
import type { withTransaction } from "@/db";
import { formatExpenseCode } from "./numbering-format";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export { formatExpenseCode } from "./numbering-format";

export async function nextExpenseCode(tx: FinanceTransaction, companyId: string): Promise<string> {
  return formatExpenseCode(await nextCode(tx, companyId, "expense"));
}
