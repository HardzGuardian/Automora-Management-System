import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseAttachments, expenses } from "@/db/schema";
import { can } from "@/lib/permissions";
import type { FileAccessChecker } from "@/modules/files";

/** File access rule for expense receipts: finance.expenses.read and the file is attached to an expense in the actor's company. */
export const canAccessExpenseAttachment: FileAccessChecker = async (actor, file) => {
  if (!can(actor, "finance.expenses.read")) return false;
  if (file.companyId !== actor.companyId) return false;
  const [link] = await db
    .select({ id: expenseAttachments.id })
    .from(expenseAttachments)
    .innerJoin(
      expenses,
      and(eq(expenses.id, expenseAttachments.expenseId), eq(expenses.companyId, expenseAttachments.companyId)),
    )
    .where(and(eq(expenseAttachments.fileId, file.id), eq(expenseAttachments.companyId, actor.companyId)))
    .limit(1);
  return Boolean(link);
};
