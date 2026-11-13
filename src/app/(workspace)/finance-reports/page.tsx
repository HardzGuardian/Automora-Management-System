import Link from "next/link";
import { notFound } from "next/navigation";
import { RangeFilter } from "@/components/dashboard/range-filter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
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
import { TableShell, tdClass, tdNumClass, thClass, thNumClass } from "../invoices/_components/finance-ui";

export const metadata = { title: "Finance reports" };

type Money = { currency: string; amount: string };
const NUMERIC_HEADS = new Set(["Total", "Received", "Outstanding", "Paid out", "Net", "Paid"]);
const TAB_LABEL: Record<string, string> = { receivables: "Receivables", "cash-movement": "Cash movement", "expense-register": "Expense register" };

/** One line per currency: currencies are never added together. */
function MoneyLines({ rows }: { rows: Money[] }) {
  if (rows.length === 0) return <span className="text-muted">—</span>;
  return (
    <>
      {rows.map((r) => (
        <span key={r.currency} className="block">
          {r.currency} {r.amount}
        </span>
      ))}
    </>
  );
}

function Stat({ label, basis, rows }: { label: string; basis: string; rows: Money[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="m-0 text-lg font-semibold tabular-nums">
        <MoneyLines rows={rows} />
      </dd>
      <dd className="m-0 text-xs text-muted">{basis}</dd>
    </div>
  );
}

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
  const exportQuery = (format: string) => `/api/exports/finance-${tab}?${new URLSearchParams({ fromDate: range.from, toDate: range.to, format })}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Finance reports"
        description={`Period ${range.from} – ${range.to}. Currencies are never added together.`}
        actions={
          canExport ? (
            <>
              <a href={exportQuery("csv")} className={buttonClass("secondary")}>
                Export CSV
              </a>
              <a href={exportQuery("xlsx")} className={buttonClass("secondary")}>
                Export XLSX
              </a>
            </>
          ) : null
        }
      />
      <RangeFilter preset={range.preset} from={range.from} to={range.to} error={rangeError} />

      {summary ? (
        <section aria-label="Summary" className="rounded-md border border-border bg-surface p-4 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Invoiced" basis="Period total, by issue date" rows={summary.period.invoiceTotalsByCurrency} />
            <Stat label="Received" basis="Period total, by payment date" rows={summary.period.confirmedReceiptsByCurrency} />
            <Stat label="Expenses" basis="Period total, by expense date" rows={summary.period.expenseTotalsByCurrency} />
            <Stat label="Outstanding receivables" basis="As of now, all issued invoices" rows={summary.pointInTime.outstandingReceivablesByCurrency} />
          </dl>
        </section>
      ) : null}

      <nav aria-label="Report tabs" className="flex flex-wrap gap-1 border-b border-border">
        {Object.entries(TAB_LABEL).map(([k, label]) => (
          <Link
            key={k}
            href={`?${q({ tab: k })}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm",
              tab === k ? "border-primary font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {failure ? (
        <ErrorState title="This report could not be loaded" message={failure} />
      ) : !table || table.rows.length === 0 ? (
        <EmptyState title="No rows in this period" description="Choose a wider period." />
      ) : (
        <TableShell caption={`${TAB_LABEL[tab]} report, ${table.total} rows`} minWidth="44rem">
          <thead className="bg-primary-soft">
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col" className={NUMERIC_HEADS.has(h) ? thNumClass : thClass}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-background">
                {r.map((cell, j) => (
                  <td key={j} className={NUMERIC_HEADS.has(table.head[j] ?? "") ? tdNumClass : tdClass}>
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      {table && table.total > table.rows.length ? (
        <p className="text-xs text-muted">
          Showing the first {table.rows.length} of {table.total} rows.{canExport ? " Export to get every row." : ""}
        </p>
      ) : null}
    </div>
  );
}
