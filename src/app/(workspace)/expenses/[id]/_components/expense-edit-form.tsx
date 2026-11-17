"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { updateExpenseAction } from "../../actions";
import { FormError, Section } from "../../../invoices/_components/finance-ui";
import { ProjectSelect, type ProjectChoice } from "../../../invoices/_components/project-select";
import type { ExpenseCategoryDTO, FinanceActionResult } from "@/modules/finance";

export function ExpenseEditForm({ expense, categories, projects }: {
  expense: {
    id: string; categoryId: string; projectId: string | null; payee: string; description: string;
    expenseDate: string; dueDate: string | null; total: string;
  };
  categories: ExpenseCategoryDTO[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(updateExpenseAction, null);
  useEffect(() => { if (state?.ok) router.refresh(); }, [router, state]);
  return (
    <Section title="Edit expense" description="Details can be edited until the first payment is recorded.">
      <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input type="hidden" name="expenseId" value={expense.id} />
        <Field id="edit-categoryId" label="Category" required>
          <select id="edit-categoryId" name="categoryId" defaultValue={expense.categoryId} required className={inputClass}>
            {categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active && category.id !== expense.categoryId}>{category.name}</option>)}
          </select>
        </Field>
        <Field id="edit-payee" label="Payee/vendor" required>
          <input id="edit-payee" name="payee" maxLength={200} defaultValue={expense.payee} required className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="edit-description" label="Description" required>
            <input id="edit-description" name="description" maxLength={2000} defaultValue={expense.description} required className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <ProjectSelect id="edit-projectId" projects={projects} defaultValue={expense.projectId} />
        </div>
        <Field id="edit-expenseDate" label="Expense date" required>
          <input id="edit-expenseDate" name="expenseDate" type="date" defaultValue={expense.expenseDate} required className={inputClass} />
        </Field>
        <Field id="edit-dueDate" label="Due date">
          <input id="edit-dueDate" name="dueDate" type="date" defaultValue={expense.dueDate ?? ""} className={inputClass} />
        </Field>
        <Field id="edit-total" label="Total" required>
          <input id="edit-total" name="total" type="number" min="0.01" step="0.01" defaultValue={expense.total} required className={inputClass} />
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <FormError message={state && !state.ok ? state.error.message : null} />
          <div>
            <button type="submit" disabled={pending} className={buttonClass("secondary")}>
              {pending ? "Saving…" : "Save expense"}
            </button>
          </div>
        </div>
      </form>
    </Section>
  );
}
