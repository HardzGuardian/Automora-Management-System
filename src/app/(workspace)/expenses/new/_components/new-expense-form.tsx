"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "../../actions";
import type { ExpenseCategoryDTO, FinanceActionResult } from "@/modules/finance";

export function NewExpenseForm({ categories }: { categories: ExpenseCategoryDTO[] }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(createExpenseAction, null);
  useEffect(() => { if (state?.ok) router.push(`/expenses/${state.data.id}`); }, [router, state]);
  return <form action={action}>
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <label>Category<select name="categoryId" required defaultValue="">
      <option value="" disabled>Select category</option>
      {categories.filter((category) => category.active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
    </select></label>
    <label>Payee/vendor<input name="payee" maxLength={200} required /></label>
    <label>Description<input name="description" maxLength={2000} required /></label>
    <label>Project ID (optional)<input name="projectId" /></label>
    <label>Expense date<input name="expenseDate" type="date" required /></label>
    <label>Due date<input name="dueDate" type="date" /></label>
    <label>Total<input name="total" type="number" min="0.01" step="0.01" required /></label>
    {state && !state.ok && <p role="alert">{state.error.message}</p>}
    <button type="submit" disabled={pending || categories.length === 0}>{pending ? "Saving…" : "Create expense"}</button>
  </form>;
}
