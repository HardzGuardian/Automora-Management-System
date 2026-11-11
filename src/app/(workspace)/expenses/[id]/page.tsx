import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import {
  getExpenseDetail,
  listExpenseCategories,
  listExpensePayments,
} from "@/modules/finance";
import { ExpenseEditForm } from "./_components/expense-edit-form";
import { ExpensePaymentActions, NewExpensePaymentForm } from "../_components/expense-payment-forms";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  let expense: Awaited<ReturnType<typeof getExpenseDetail>>;
  try {
    expense = await getExpenseDetail(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.code === "EXPENSE_NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  const payments = await listExpensePayments(actor, id);
  const categories = actor.permissions.has("finance.expenses.update") && payments.length === 0
    ? await listExpenseCategories(actor, true)
    : [];

  return <main>
    <p><Link href="/expenses">Expenses</Link></p>
    <h1>{expense.expenseCode}</h1>
    <dl>
      <dt>Status</dt><dd>{expense.status.replaceAll("_", " ")}</dd>
      <dt>Payee/vendor</dt><dd>{expense.payee}</dd>
      <dt>Description</dt><dd>{expense.description}</dd>
      <dt>Category</dt><dd>{expense.categoryName}</dd>
      <dt>Expense date</dt><dd>{expense.expenseDate}</dd>
      <dt>Due date</dt><dd>{expense.dueDate ?? "—"}</dd>
      <dt>Total</dt><dd>{expense.currency} {expense.total}</dd>
      <dt>Confirmed payments</dt><dd>{expense.currency} {expense.confirmedPayments}</dd>
      <dt>Outstanding</dt><dd>{expense.currency} {expense.outstanding}</dd>
    </dl>
    {categories.length > 0 && <ExpenseEditForm expense={expense} categories={categories} />}
    {actor.permissions.has("finance.expenses.pay") && expense.outstanding !== "0.00" && <NewExpensePaymentForm expenseId={expense.id} />}
    <h2>Outgoing payments</h2>
    {payments.length === 0 ? <p>No payments recorded.</p> : <ul>{payments.map((payment) => <li key={payment.id}>
      {payment.paymentDate} · {payment.status} · {expense.currency} {payment.amount} · {payment.method.replaceAll("_", " ")}
      <ExpensePaymentActions
        paymentId={payment.id}
        status={payment.status}
        canPay={actor.permissions.has("finance.expenses.pay")}
        canReverse={actor.permissions.has("finance.expenses.reverse")}
      />
    </li>)}</ul>}
  </main>;
}
