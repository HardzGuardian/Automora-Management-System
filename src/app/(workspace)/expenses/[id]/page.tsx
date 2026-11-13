import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import {
  expenseAttachmentService,
  getExpenseDetail,
  listExpenseCategories,
  listExpensePayments,
} from "@/modules/finance";
import {
  BackLink,
  DetailHeader,
  DetailList,
  Figures,
  Section,
  TableShell,
  methodLabel,
  money,
  notSet,
  tdClass,
  tdNumClass,
  thClass,
  thNumClass,
} from "../../invoices/_components/finance-ui";
import { loadProjectOptions } from "../../invoices/_components/project-options";
import { ExpenseEditForm } from "./_components/expense-edit-form";
import { ReceiptUploadForm } from "./_components/receipt-upload";
import { ExpensePaymentActions, NewExpensePaymentForm } from "../_components/expense-payment-forms";
import { isUuid } from "@/lib/pagination";

export const metadata = { title: "Expense" };

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let expense: Awaited<ReturnType<typeof getExpenseDetail>>;
  try {
    expense = await getExpenseDetail(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.code === "EXPENSE_NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  const [payments, receipts] = await Promise.all([
    listExpensePayments(actor, id),
    expenseAttachmentService.listExpenseFiles(actor, id).catch(() => []),
  ]);
  const categories = actor.permissions.has("finance.expenses.update") && payments.length === 0
    ? await listExpenseCategories(actor, true)
    : [];
  const canEdit = categories.length > 0;
  const projects = canEdit || expense.projectId ? await loadProjectOptions(actor, expense.projectId) : [];
  const projectLabel = expense.projectId ? projects.find((p) => p.id === expense.projectId)?.label ?? "Linked project" : null;
  const canPay = actor.permissions.has("finance.expenses.pay");
  const canReverse = actor.permissions.has("finance.expenses.reverse");
  const hasActions = payments.some((p) => (p.status === "pending" && canPay) || (p.status === "confirmed" && canReverse));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/expenses">Expenses</BackLink>
      <DetailHeader
        title={expense.expenseCode}
        badge={<StatusBadge status={expense.status} />}
        facts={
          <>
            {expense.payee} · {expense.categoryName} · {expense.expenseDate}
          </>
        }
      />
      <Figures
        items={[
          { label: "Total", value: money(expense.currency, expense.total) },
          { label: "Paid", value: money(expense.currency, expense.confirmedPayments) },
          { label: "Outstanding", value: money(expense.currency, expense.outstanding), tone: expense.status === "paid" ? "success" : "default" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {canEdit && <ExpenseEditForm expense={expense} categories={categories} projects={projects} />}
          {canPay && expense.outstanding !== "0.00" && <NewExpensePaymentForm expenseId={expense.id} />}

          <Section title="Outgoing payments">
            {payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <TableShell caption="Outgoing payments for this expense" minWidth="34rem">
                <thead className="bg-primary-soft">
                  <tr>
                    <th scope="col" className={thClass}>Date</th>
                    <th scope="col" className={thClass}>Method</th>
                    <th scope="col" className={thClass}>Reference</th>
                    <th scope="col" className={thClass}>Status</th>
                    <th scope="col" className={thNumClass}>Amount</th>
                    {hasActions ? (
                      <th scope="col" className={thClass}>
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-border align-top">
                      <td className={tdClass}>{payment.paymentDate}</td>
                      <td className={tdClass}>{methodLabel(payment.method)}</td>
                      <td className={tdClass}>{payment.reference ?? notSet}</td>
                      <td className={tdClass}>
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className={tdNumClass}>{money(expense.currency, payment.amount)}</td>
                      {hasActions ? (
                        <td className={tdClass}>
                          <ExpensePaymentActions paymentId={payment.id} status={payment.status} canPay={canPay} canReverse={canReverse} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Section title={`Receipts (${receipts.length})`}>
            {receipts.length === 0 ? (
              <p className="text-sm text-muted">No receipts attached yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {receipts.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                    <a href={`/api/files/${r.id}`} className="font-medium text-primary underline">
                      {r.fileName}
                    </a>
                    <span className="text-xs text-muted">{Math.max(1, Math.round(r.size / 1024))} KB</span>
                  </li>
                ))}
              </ul>
            )}
            {actor.permissions.has("finance.expenses.update") ? <ReceiptUploadForm expenseId={expense.id} /> : null}
          </Section>
          <Section title="Details">
            <DetailList
              rows={[
                ["Payee/vendor", expense.payee],
                ["Category", expense.categoryName],
                ["Description", expense.description],
                ["Project", projectLabel ?? notSet],
                ["Expense date", expense.expenseDate],
                ["Due date", expense.dueDate ?? notSet],
              ]}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}
