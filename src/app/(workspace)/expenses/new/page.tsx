import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getActor } from "@/lib/auth/actor";
import { listExpenseCategories } from "@/modules/finance";
import { BackLink } from "../../invoices/_components/finance-ui";
import { loadProjectOptions } from "../../invoices/_components/project-options";
import { NewExpenseForm } from "./_components/new-expense-form";

export const metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const actor = await getActor();
  const categories = await listExpenseCategories(actor);
  const hasActive = categories.some((category) => category.active);
  const projects = hasActive ? await loadProjectOptions(actor) : [];
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/expenses">Expenses</BackLink>
      <PageHeader title="New expense" description="Record what you owe. Payments are added on the expense once it is created." />
      {!hasActive ? (
        <EmptyState title="No active expense categories" description="An administrator needs to add an expense category before expenses can be recorded." />
      ) : (
        <NewExpenseForm categories={categories} projects={projects} />
      )}
    </div>
  );
}
