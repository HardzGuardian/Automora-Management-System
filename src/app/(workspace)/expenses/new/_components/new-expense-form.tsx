"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { MoreOptions } from "@/components/forms/more-options";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { createExpenseAction } from "../../actions";
import { FormError } from "../../../invoices/_components/finance-ui";
import { ProjectSelect, type ProjectChoice } from "../../../invoices/_components/project-select";
import type { ExpenseCategoryDTO, FinanceActionResult } from "@/modules/finance";

export function NewExpenseForm({ categories, projects }: { categories: ExpenseCategoryDTO[]; projects: ProjectChoice[] }) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FinanceActionResult<{ id: string }> | null, FormData>(createExpenseAction, null);
  useEffect(() => { if (state?.ok) router.push(`/expenses/${state.data.id}`); }, [router, state]);
  return (
    <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="sm:col-span-2">
        <FormError message={state && !state.ok ? state.error.message : null} />
      </div>
      <Field id="categoryId" label="Category" required>
        <select id="categoryId" name="categoryId" required defaultValue="" className={inputClass}>
          <option value="" disabled>Select category</option>
          {categories.filter((category) => category.active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
      </Field>
      <Field id="payee" label="Payee/vendor" required>
        <input id="payee" name="payee" maxLength={200} required className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="description" label="Description" required>
          <input id="description" name="description" maxLength={2000} required className={inputClass} />
        </Field>
      </div>
      <Field id="expenseDate" label="Expense date" required>
        <input id="expenseDate" name="expenseDate" type="date" required className={inputClass} />
      </Field>
      <Field id="total" label="Total" required hint="Full amount owed, in the company currency.">
        <input id="total" name="total" type="number" min="0.01" step="0.01" required aria-describedby="total-hint" className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <MoreOptions>
          <ProjectSelect id="projectId" projects={projects} />
          <Field id="dueDate" label="Due date" hint="When the payee expects to be paid.">
            <input id="dueDate" name="dueDate" type="date" aria-describedby="dueDate-hint" className={inputClass} />
          </Field>
        </MoreOptions>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <UnsavedChangesGuard />
        <button type="submit" disabled={pending || categories.length === 0} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Create expense"}
        </button>
        <Link href="/expenses" className={buttonClass("ghost")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
