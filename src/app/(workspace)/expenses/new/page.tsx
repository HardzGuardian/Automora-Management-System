import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { listExpenseCategories } from "@/modules/finance";
import { NewExpenseForm } from "./_components/new-expense-form";

export default async function NewExpensePage() {
  const actor = await getActor();
  const categories = await listExpenseCategories(actor);
  return <main>
    <p><Link href="/expenses">Expenses</Link></p>
    <h1>New expense</h1>
    {categories.filter((category) => category.active).length === 0
      ? <p>No active expense categories are available.</p>
      : <NewExpenseForm categories={categories} />}
  </main>;
}
