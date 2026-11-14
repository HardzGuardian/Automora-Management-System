import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getFinanceSnapshot, listExpenses, listInvoices, listReceipts, type FinanceSnapshot } from "@/modules/finance";
import { projectsOverview } from "@/modules/projects";
import { money } from "../invoices/_components/finance-ui";

export const metadata = { title: "Finance" };

const TABS = ["invoices", "payments", "expenses"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { invoices: "Invoices", payments: "Payments", expenses: "Expenses" };
const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", upi: "UPI", cash: "Cash", card: "Card", other: "Other" };

/** "INR 1,200.00" per currency; several currencies are listed, never added together. */
function amounts(list: { currency: string; amount: string }[]): string {
  const nonZero = list.filter((a) => Number(a.amount) !== 0);
  if (nonZero.length === 0) return list[0] ? money(list[0].currency, "0.00") : "0.00";
  return nonZero.map((a) => money(a.currency, a.amount)).join(" · ");
}

function monthRange(today: string) {
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { fromDate: `${y}-${mm}-01`, toDate: `${y}-${mm}-${String(last).padStart(2, "0")}`, name: new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }) };
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={cn("p-4 font-medium", right ? "text-right" : "text-left")}>{children}</th>;
}
const Td = ({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) => (
  <td className={cn("p-4", right && "text-right tabular-nums", strong ? "font-semibold text-foreground" : "text-body")}>{children}</td>
);

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const allowed: Record<Tab, boolean> = {
    invoices: can(actor, "finance.invoices.read"),
    payments: can(actor, "finance.payments.read"),
    expenses: can(actor, "finance.expenses.read"),
  };
  const tabs = TABS.filter((t) => allowed[t]);
  const tab: Tab = tabs.find((t) => t === sp.tab) ?? tabs[0] ?? "invoices";

  const today = todayInTz(actor.timezone);
  const month = monthRange(today);
  const projectName = new Map((await projectsOverview(actor).catch(() => [])).map((p) => [p.id, p.name]));

  let snapshot: FinanceSnapshot | null = null;
  if (can(actor, "finance.reports.read")) {
    snapshot = await getFinanceSnapshot(actor, { fromDate: month.fromDate, toDate: month.toDate }).catch(() => null);
  }
  const overdue = allowed.invoices ? await listInvoices(actor, { status: "overdue", pageSize: 100 }) : null;
  const overdueByCurrency = new Map<string, number>();
  for (const r of overdue?.rows ?? []) overdueByCurrency.set(r.currency, (overdueByCurrency.get(r.currency) ?? 0) + Number(r.outstanding));
  const overdueAmounts = [...overdueByCurrency].map(([currency, n]) => ({ currency, amount: n.toFixed(2) }));

  const [invoices, receipts, expenses] = await Promise.all([
    allowed.invoices ? listInvoices(actor, { pageSize: 50 }) : null,
    allowed.payments ? listReceipts(actor, { pageSize: 50 }) : null,
    allowed.expenses ? listExpenses(actor, { pageSize: 50 }) : null,
  ]);

  const stats = [
    { label: "Outstanding", value: snapshot ? amounts(snapshot.pointInTime.outstandingReceivables) : "—", hint: "Issued and overdue invoices", tone: "" },
    {
      label: "Overdue",
      value: overdue ? amounts(overdueAmounts) : "—",
      hint: overdue ? `${overdue.total} ${overdue.total === 1 ? "invoice" : "invoices"} past ${overdue.total === 1 ? "its" : "their"} due date` : "",
      tone: overdue && overdue.total > 0 ? "text-danger" : "",
    },
    {
      label: `Received in ${month.name}`,
      value: snapshot ? amounts(snapshot.periodTotals.confirmedReceiptsByPaymentDate) : "—",
      hint: "Confirmed payments",
      tone: "text-primary-ink",
    },
    { label: `Expenses in ${month.name}`, value: snapshot ? amounts(snapshot.periodTotals.expensesByExpenseDate) : "—", hint: "By expense date", tone: "" },
  ];

  const primary =
    tab === "invoices" && can(actor, "finance.invoices.create")
      ? { href: "/invoices/new", label: "Create invoice" }
      : tab === "payments" && can(actor, "finance.payments.record")
        ? { href: "/invoices?status=issued", label: "Record payment" }
        : tab === "expenses" && can(actor, "finance.expenses.create")
          ? { href: "/expenses/new", label: "Add expense" }
          : null;
  const counts: Record<Tab, number> = { invoices: invoices?.total ?? 0, payments: receipts?.total ?? 0, expenses: expenses?.total ?? 0 };

  if (tabs.length === 0) {
    return <p className="rounded-lg border border-border bg-surface p-5 text-muted">You do not have access to finance.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Finance</h1>
          <p className="mt-1 text-muted">Invoices, payments and expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(actor, "finance.reports.read") ? (
            <Link href="/finance-reports" className={buttonClass("secondary")}>Finance reports</Link>
          ) : null}
          {primary ? (
            <Link href={primary.href} className={buttonClass("primary", "gap-2")}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              {primary.label}
            </Link>
          ) : null}
        </div>
      </div>

      <section aria-label="Finance summary" className="grid grid-cols-2 rounded-lg border border-border bg-surface lg:grid-cols-4">
        {stats.map((k, i) => (
          <div key={k.label} className={cn("px-5 py-4", i > 0 && "lg:border-l lg:border-border", i % 2 === 1 && "border-l border-border")}>
            <div className="text-xs text-muted">{k.label}</div>
            <div className={cn("mt-1 text-[22px] font-semibold tracking-tight text-foreground", k.tone)}>{k.value}</div>
            <div className="mt-0.5 text-xs text-muted">{k.hint}</div>
          </div>
        ))}
      </section>

      <FilterPills label="Finance sections" pills={tabs.map((t) => ({ label: TAB_LABEL[t], href: `/finance?tab=${t}`, count: counts[t], active: t === tab }))} />

      <section aria-label={TAB_LABEL[tab]} tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-surface">
        {tab === "invoices" && invoices ? (
          invoices.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-muted">No invoices yet.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <Th>Invoice</Th><Th>Client</Th><Th>Project</Th><Th>Due</Th><Th right>Amount</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <Td strong>
                      <Link href={`/invoices/${r.id}`} className="hover:text-primary-ink">{r.invoiceNumber ?? "Draft"}</Link>
                    </Td>
                    <Td>{r.clientName}</Td>
                    <Td>{r.projectId ? (projectName.get(r.projectId) ?? "—") : "—"}</Td>
                    <Td>{r.dueDate ?? "—"}</Td>
                    <Td right>{money(r.currency, r.total)}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {tab === "payments" && receipts ? (
          receipts.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-muted">No payments recorded yet. Open an issued invoice to record one.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <Th>Payment</Th><Th>Invoice</Th><Th>Received</Th><Th>Method</Th><Th right>Amount</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {receipts.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <Td strong>
                      <Link href={`/payments/${r.id}`} className="hover:text-primary-ink">{r.reference ?? "Receipt"}</Link>
                    </Td>
                    <Td>{r.invoiceNumber ?? "—"}</Td>
                    <Td>{r.paymentDate}</Td>
                    <Td>{METHOD[r.method] ?? r.method}</Td>
                    <Td right>{money(r.currency, r.amount)}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {tab === "expenses" && expenses ? (
          expenses.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-muted">No expenses yet.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <Th>Expense</Th><Th>Description</Th><Th>Project</Th><Th>Date</Th><Th right>Amount</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {expenses.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <Td strong>
                      <Link href={`/expenses/${r.id}`} className="hover:text-primary-ink">{r.expenseCode}</Link>
                    </Td>
                    <Td>{r.description}</Td>
                    <Td>{r.projectId ? (projectName.get(r.projectId) ?? "—") : "Internal"}</Td>
                    <Td>{r.expenseDate}</Td>
                    <Td right>{money(r.currency, r.total)}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </section>
    </div>
  );
}
