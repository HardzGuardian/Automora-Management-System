import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listExpenseCategories } from "@/modules/finance";
import { createCategoryAction, setCategoryActiveAction } from "../category-actions";

export const metadata = { title: "Expense categories" };

export default async function ExpenseCategoriesPage() {
  const actor = await requireActor();
  if (!can(actor, "finance.categories.manage")) notFound();
  const categories = await listExpenseCategories(actor, true);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <BackLink href="/finance?tab=expenses">Expenses</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Expense categories</h1>
        <p className="mt-1 text-muted">Categories group expenses in lists and reports. A category in use is switched off instead of deleted, so old expenses keep their category.</p>
      </div>

      <section className={`${cardClass} flex flex-col gap-3`} aria-label="Add a category">
        <h2 className="m-0 text-base font-semibold">Add a category</h2>
        <form action={createCategoryAction} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
            Name
            <input name="name" required maxLength={80} className={inputClass} />
          </label>
          <label className="flex min-w-48 flex-[2] flex-col gap-1 text-xs text-muted">
            Description (optional)
            <input name="description" maxLength={200} className={inputClass} />
          </label>
          <button type="submit" className={buttonClass("primary")}>
            Add category
          </button>
        </form>
      </section>

      <section aria-label="Categories" className="rounded-lg border border-border bg-surface">
        {categories.length === 0 ? (
          <p className="m-0 px-5 py-8 text-sm text-muted">No categories yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.name}</span>
                  {c.description ? <span className="block text-xs text-muted">{c.description}</span> : null}
                </span>
                <StatusBadge status={c.active ? "Active" : "Inactive"} />
                <form action={setCategoryActiveAction}>
                  <input type="hidden" name="categoryId" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                  <button type="submit" className={buttonClass("secondary", "min-h-9! px-3!")}>
                    {c.active ? "Turn off" : "Turn on"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
