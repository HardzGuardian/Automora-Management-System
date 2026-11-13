import Link from "next/link";
import { notFound } from "next/navigation";
import { RangeFilter } from "@/components/dashboard/range-filter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import {
  getCashMovementReport,
  getExpenseRegisterReport,
  getFinanceReportSummary,
  getReceivablesReport,
} from "@/modules/finance";
import { resolveRange, RANGE_PRESETS, type RangePreset } from "@/modules/reports";

export const metadata = { title: "Finance reports" };

type Money = { currency: string; amount: string };
const moneyList = (rows: Money[]) => (rows.length === 0 ? "—" : rows.map((r) => `${r.currency} ${r.amount}`).join(" · "));

export default async function FinanceReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string; tab?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "finance.reports.read")) notFound();
  const sp = await searchParams;
  const preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(sp.preset ?? "") ? (sp.preset as RangePreset) : "month";
  const tab = ["receivables", "cash-movement", "expense-register"].includes(sp.tab ?? "") ? (sp.tab as string) : "receivables";

  let range;
  let rangeError: string | undefined;
  try {
    range = resolveRange(preset, actor.timezone, new Date(), { from: sp.from, to: sp.to });
  } catch (e) {
    rangeError = e instanceof Error ? e.message : "Invalid range";
    range = resolveRange("month", actor.timezone);
  }
  const input = { fromDate: range.from, toDate: range.to };

  let summary;
  let table: { head: string[]; rows: (string | number | null)[][]; total: number } | null = null;
  let failure: string | undefined;
  try {
    summary = await getFinanceReportSummary(actor, input);
    if (tab === "receivables") {
      const r = await getReceivablesReport(actor, { ...input, page: 1, pageSize: 100 });
      table = {
        head: ["Invoice", "Client", "Issued", "Due", "Total", "Received", "Outstanding", "Status"],
        total: r.total,
        rows: r.rows.map((x) => [x.invoiceNumber, x.clientName, x.issueDate, x.dueDate, `${x.currency} ${x.total}`, `${x.currency} ${x.confirmedReceipts}`, `${x.currency} ${x.outstanding}`, x.status.replace(/_/g, " ")]),
      };
    } else if (tab === "cash-movement") {
      const r = await getCashMovementReport(actor, { ...input, page: 1, pageSize: 100 });
      table = {
        head: ["Date", "Currency", "Received", "Paid out", "Net"],
        total: r.total,
        rows: r.rows.map((x) => [x.date, x.currency, x.confirmedReceipts, x.confirmedExpensePayments, x.netCashMovement]),
      };
    } else {
      const r = await getExpenseRegisterReport(actor, { ...input, page: 1, pageSize: 100 });
      table = {
        head: ["Code", "Category", "Payee", "Expense date", "Total", "Paid", "Outstanding", "Status"],
        total: r.total,
        rows: r.rows.map((x) => [x.expenseCode, x.categoryName, x.payee, x.expenseDate, `${x.currency} ${x.total}`, `${x.currency} ${x.confirmedPayments}`, `${x.currency} ${x.outstanding}`, x.status.replace(/_/g, " ")]),
      };
    }
  } catch (e) {
    if (e instanceof DomainError) failure = e.message;
    else throw e;
  }

  const q = (extra: Record<string, string>) => new URLSearchParams({ preset: range.preset, from: range.from, to: range.to, ...extra }).toString();
  const canExport = can(actor, "finance.reports.export");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Finance reports" description={`Period ${range.from} – ${range.to}. Currencies are never added together.`} />
      <RangeFilter preset={range.preset} from={range.from} to={range.to} error={rangeError} />

      {summary ? (
        <section aria-label="Summary" className="grid gap-4 rounded-md border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted">Invoiced</p>
            <p className="text-xs text-muted">period total · by issue date</p>
            <p className="font-semibold">{moneyList(summary.period.invoiceTotalsByCurrency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted">Received</p>
            <p className="text-xs text-muted">period total · by payment date</p>
            <p className="font-semibold">{moneyList(summary.period.confirmedReceiptsByCurrency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted">Expenses</p>
            <p className="text-xs text-muted">period total · by expense date</p>
            <p className="font-semibold">{moneyList(summary.period.expenseTotalsByCurrency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted">Outstanding receivables</p>
            <p className="text-xs text-muted">point in time · all issued invoices</p>
            <p className="font-semibold">{moneyList(summary.pointInTime.outstandingReceivablesByCurrency)}</p>
          </div>
        </section>
      ) : null}

      <nav aria-label="Report tabs" className="flex flex-wrap gap-2 text-sm">
        {[
          ["receivables", "Receivables"],
          ["cash-movement", "Cash movement"],
          ["expense-register", "Expense register"],
        ].map(([k, label]) => (
          <Link key={k} href={`?${q({ tab: k })}`} aria-current={tab === k ? "page" : undefined} className={buttonClass(tab === k ? "primary" : "secondary")}>
            {label}
          </Link>
        ))}
        {canExport ? (
          <span className="ml-auto flex gap-2">
            <a href={`/api/exports/finance-${tab}?${new URLSearchParams({ fromDate: range.from, toDate: range.to, format: "csv" })}`} className={buttonClass("secondary")}>
              Export CSV
            </a>
            <a href={`/api/exports/finance-${tab}?${new URLSearchParams({ fromDate: range.from, toDate: range.to, format: "xlsx" })}`} className={buttonClass("secondary")}>
              Export XLSX
            </a>
          </span>
        ) : null}
      </nav>

      {failure ? (
        <ErrorState title="This report could not be loaded" message={failure} />
      ) : !table || table.rows.length === 0 ? (
        <EmptyState title="No rows in this period" description="Choose a wider period." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">{tab} report, {table.total} rows</caption>
            <thead className="bg-primary-soft">
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-2">
                      {cell ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
