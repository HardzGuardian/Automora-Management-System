import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { availableReports, runReport, type ReportFilters } from "@/modules/reports";

export const metadata = { title: "Reports" };

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
] as const;
const SUBTITLE: Record<string, string> = {
  "task-register": "Every task with its project, owner and status. A point-in-time list.",
  "employee-workload": "Open work per person right now, plus what they completed in the period.",
  "project-status": "Progress is completed tasks divided by all tasks, rounded down.",
  "client-summary": "Projects and open work for each client.",
};
const FORMATS = [
  { key: "csv", label: "Export as CSV" },
  { key: "xlsx", label: "Export as XLSX" },
  { key: "pdf", label: "Export as PDF" },
] as const;

type SP = { report?: string; period?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const reports = availableReports(actor);

  if (reports.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="rounded-lg border border-border bg-surface p-5 text-muted">Your role does not include any reports. Ask an administrator if you need access.</p>
      </div>
    );
  }

  const current = reports.find((r) => r.key === sp.report) ?? reports[0];
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[2];
  const filters: ReportFilters = { preset: period.key };

  let result: Awaited<ReturnType<typeof runReport>> | null = null;
  let failure: string | null = null;
  try {
    result = await runReport(actor, current.key, { ...filters, page: 1, pageSize: 100 });
  } catch (e) {
    if (e instanceof DomainError && (e.code === "VALIDATION" || e.code === "FORBIDDEN")) failure = e.message;
    else throw e;
  }

  const canExport = can(actor, "reports.export") && result !== null;
  const exportHref = (format: string) => `/api/exports/${current.key}?${new URLSearchParams({ format, preset: period.key }).toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-muted">Pick a report, choose a period, then export it.</p>
        </div>
        {canExport ? (
          <details className="relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover">
              <Icon name="download" size={18} />
              Export
              <Icon name="chevronDown" size={14} strokeWidth={2.4} />
            </summary>
            <ul role="menu" aria-label="Export format" className="absolute right-0 top-[50px] z-20 m-0 min-w-[180px] list-none rounded-lg border border-border bg-surface p-1.5 shadow-lg">
              {FORMATS.map((f) => (
                <li key={f.key} role="none">
                  <a href={exportHref(f.key)} role="menuitem" className="flex min-h-10 items-center rounded-md px-2.5 text-[13px] font-medium text-foreground hover:bg-primary-soft">
                    {f.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Choose a report"
          pills={reports.map((r) => ({ label: r.title, href: `/reports?report=${r.key}&period=${period.key}`, active: r.key === current.key }))}
        />
        <form className="flex items-center gap-2">
          <input type="hidden" name="report" value={current.key} />
          <label htmlFor="range" className="text-muted">Period</label>
          <select id="range" name="period" defaultValue={period.key} className="h-10 rounded-lg border border-field bg-surface px-2.5 text-foreground">
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-lg border border-field bg-surface px-4 font-medium hover:bg-primary-soft">Apply</button>
        </form>
      </div>

      <section aria-label={current.title} className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 py-[18px]">
          <h2 className="m-0 text-base font-semibold text-foreground">{current.title}</h2>
          <p className="mb-0 mt-0.5 text-xs text-muted">
            {SUBTITLE[current.key] ?? current.description} Period: {period.label.toLowerCase()}.
          </p>
        </div>
        {failure ? (
          <p role="alert" className="px-5 py-6 text-danger">{failure}</p>
        ) : !result || result.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No rows match. Try a wider period.</p>
        ) : (
          <>
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <caption className="sr-only">{result.title}, {result.total} rows</caption>
              <thead>
                <tr className="text-xs text-muted">
                  {result.columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("px-5 py-3.5 font-medium", c.type === "number" ? "text-right" : "text-left")}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {result.columns.map((c, ci) => (
                      <td key={c.key} className={cn("px-5 py-3.5", c.type === "number" && "text-right tabular-nums", ci === 0 ? "font-semibold text-foreground" : "text-body")}>
                        {r[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.total > result.rows.length ? (
              <p className="border-t border-border px-5 py-3 text-xs text-muted">
                Showing {result.rows.length} of {result.total} rows. Export to get every row.
              </p>
            ) : null}
          </>
        )}
      </section>

      {can(actor, "finance.reports.read") ? (
        <p className="m-0 text-sm text-muted">
          Receivables, cash movement and the expense register are in{" "}
          <Link href="/finance-reports" className="font-medium text-primary-ink underline">
            Finance reports
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
