import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { listExpenses } from "@/modules/finance";

export default async function ExpensesPage() {
  const actor = await getActor();
  const result = await listExpenses(actor, { page: 1, pageSize: 50 });
  return <main>
    <h1>Expenses</h1>
    {actor.permissions.has("finance.expenses.create") && <p><Link href="/expenses/new">Create expense</Link></p>}
    {result.rows.length === 0 ? <p>No expenses recorded.</p> : <table>
      <thead><tr><th>Code</th><th>Payee</th><th>Category</th><th>Date</th><th>Status</th><th>Total</th><th>Outstanding</th></tr></thead>
      <tbody>{result.rows.map((expense) => <tr key={expense.id}>
        <td><Link href={`/expenses/${expense.id}`}>{expense.expenseCode}</Link></td>
        <td>{expense.payee}</td><td>{expense.categoryName}</td><td>{expense.expenseDate}</td>
        <td>{expense.status.replaceAll("_", " ")}</td><td>{expense.currency} {expense.total}</td>
        <td>{expense.currency} {expense.outstanding}</td>
      </tr>)}</tbody>
    </table>}
  </main>;
}
