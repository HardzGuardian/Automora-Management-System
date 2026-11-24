"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { flashed } from "@/lib/flash";
import { archiveExpense, createExpenseCategory, setExpenseCategoryActive } from "@/modules/finance";
import { redirect } from "next/navigation";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function createCategoryAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  await flashed(() => createExpenseCategory(actor, { name: str(fd.get("name")), description: str(fd.get("description")) || undefined }), "Category added.");
  revalidatePath("/expenses/categories");
}

export async function setCategoryActiveAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  await flashed(() => setExpenseCategoryActive(actor, z.string().uuid().parse(fd.get("categoryId")), str(fd.get("active")) === "true"));
  revalidatePath("/expenses/categories");
}

/** Archive an unpaid expense: it leaves lists and reports; its history stays. */
export async function archiveExpenseAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("expenseId"));
  const r = await flashed(() => archiveExpense(actor, id, str(fd.get("reason"))), "Expense archived.");
  revalidatePath("/finance");
  revalidatePath(`/expenses/${id}`);
  redirect(r.ok ? "/finance?tab=expenses" : `/expenses/${id}`);
}
