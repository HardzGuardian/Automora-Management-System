"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateExpenseAction } from "../../actions";
import type { ExpenseCategoryDTO, FinanceActionResult } from "@/modules/finance";

export function ExpenseEditForm({ expense, categories }: {
  expense: {
    id: string; categoryId: string; projectId: string | null; payee: string; description: string;
    expenseDate: string; dueDate: string | null; total: string;
  };
  categories: ExpenseCategoryDTO[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(updateExpenseAction, null);
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
  return <section>
    <h2>Edit expense</h2>
    <form action={action}>
      <input type="hidden" name="expenseId" value={expense.id} />
      <label>Category<select name="categoryId" defaultValue={expense.categoryId} required>
        {categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active && category.id !== expense.categoryId}>{category.name}</option>)}
      </select></label>
      <label>Payee/vendor<input name="payee" maxLength={200} defaultValue={expense.payee} required /></label>
      <label>Description<input name="description" maxLength={2000} defaultValue={expense.description} required /></label>
      <label>Project ID (optional)<input name="projectId" defaultValue={expense.projectId ?? ""} /></label>
      <label>Expense date<input name="expenseDate" type="date" defaultValue={expense.expenseDate} required /></label>
      <label>Due date<input name="dueDate" type="date" defaultValue={expense.dueDate ?? ""} /></label>
      <label>Total<input name="total" type="number" min="0.01" step="0.01" defaultValue={expense.total} required /></label>
      {state && !state.ok && <p role="alert">{state.error.message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save expense"}</button>
    </form>
  </section>;
}
