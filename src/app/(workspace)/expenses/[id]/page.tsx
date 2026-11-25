import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { archiveExpenseAction } from "../category-actions";
import { auditChatterEntries } from "../../_components/audit-chatter";
import { Chatter } from "@/components/ui/chatter";
import { FieldGrid, FormView, SheetTitle, SmartButtons, StatusBar } from "@/components/ui/odoo";
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
  const canArchive = actor.permissions.has("finance.expenses.update") && payments.every((p) => p.status === "reversed");
  const canReverse = actor.permissions.has("finance.expenses.reverse");
  const hasActions = payments.some((p) => (p.status === "pending" && canPay) || (p.status === "confirmed" && canReverse));

  const historyEntries = await auditChatterEntries(actor, "expense", expense.id);
  const expenseStages = ["unpaid", "partially_paid", "paid"];
  const expenseAt = expenseStages.indexOf(expense.status);
  const EXPENSE_LABEL: Record<string, string> = { unpaid: "Unpaid", partially_paid: "Partially paid", paid: "Paid" };

  return (
    <FormView
      crumbs={[{ label: "Expenses", href: "/finance?tab=expenses" }, { label: expense.expenseCode }]}
      statusbar={
        <StatusBar
          label="Expense status"
          stages={expenseStages.map((k, i) => ({ key: k, label: EXPENSE_LABEL[k], state: i < expenseAt ? "done" : i === expenseAt ? "current" : "todo" }))}
        />
      }
      chatter={historyEntries ? <Chatter entries={historyEntries} timeZone={actor.timezone} title="History" empty="No changes recorded yet." /> : undefined}
    >
      <SheetTitle
        code="Expense"
        title={expense.expenseCode}
        badges={<span className="text-base text-muted">{expense.payee}</span>}
        smart={
          <SmartButtons
            items={[
              { icon: "partial", value: money(expense.currency, expense.total), label: "Total" },
              { icon: "completed", value: money(expense.currency, expense.confirmedPayments), label: "Paid" },
              { icon: "pending", value: money(expense.currency, expense.outstanding), label: "Outstanding" },
            ]}
          />
        }
      />
      <FieldGrid
        items={[
          { label: "Payee/vendor", value: expense.payee },
          { label: "Category", value: expense.categoryName },
          { label: "Expense date", value: expense.expenseDate },
          { label: "Due date", value: expense.dueDate ?? notSet },
          { label: "Project", value: projectLabel ?? notSet },
          { label: "Description", value: expense.description },
        ]}
      />
      <div className="mt-2 flex flex-col gap-4">
          {canEdit && <ExpenseEditForm expense={expense} categories={categories} projects={projects} />}
          {canPay && expense.outstanding !== "0.00" && <NewExpensePaymentForm expenseId={expense.id} />}
          {canArchive && (
            <Section title="Archive">
              <p className="m-0 text-sm text-muted">Archiving removes this expense from lists and reports. Its history is kept. Only an expense with no payments can be archived.</p>
              <ConfirmForm
                action={archiveExpenseAction}
                label="Archive expense"
                title={`Archive ${expense.expenseCode}?`}
                description="It leaves the expense list and reports. The record and its history stay on file."
                confirmLabel="Archive expense"
                formClassName="flex flex-col gap-2"
              >
                <input type="hidden" name="expenseId" value={expense.id} />
                <label className="sr-only" htmlFor="archive-reason">Reason</label>
                <input id="archive-reason" name="reason" maxLength={300} placeholder="Reason (optional)" className="min-h-10 rounded-md border border-field bg-surface px-3 text-sm" />
              </ConfirmForm>
            </Section>
          )}

          <Section title="Outgoing payments">
            {payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <TableShell caption="Outgoing payments for this expense" minWidth="34rem">
                <thead className="text-muted">
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
                          {payment.awaitingSecondPerson ? (
                            <span className="text-xs text-muted">Waiting for another person to confirm</span>
                          ) : (
                            <ExpensePaymentActions paymentId={payment.id} status={payment.status} canPay={canPay} canReverse={canReverse} />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Section>
          <Section title={`Attached receipt files (${receipts.length})`}>
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
      </div>
    </FormView>
  );
}
