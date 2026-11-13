import Link from "next/link";
import { notFound } from "next/navigation";
import { RangeFilter } from "@/components/dashboard/range-filter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { REPORT_KEYS, RANGE_PRESETS, runReport, type ReportFilters, type ReportKey } from "@/modules/reports";

const PAGE_SIZE = 25;
const STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

type SP = { preset?: string; from?: string; to?: string; status?: string; priority?: string; page?: string };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ report: string }>; searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const { report } = await params;
  if (!(REPORT_KEYS as string[]).includes(report)) notFound();
  const key = report as ReportKey;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const priority = PRIORITIES.find((p) => p === sp.priority);
  const preset = (RANGE_PRESETS as readonly string[]).includes(sp.preset ?? "") ? (sp.preset as ReportFilters["preset"]) : undefined;

  const filters: ReportFilters = {
    preset,
    from: sp.from || undefined,
    to: sp.to || undefined,
    status: status ? [status] : undefined,
    priority: priority ? [priority] : undefined,
  };

  let result: Awaited<ReturnType<typeof runReport>> | undefined;
  let failure: string | undefined;
  try {
    result = await runReport(actor, key, { ...filters, page, pageSize: PAGE_SIZE });
  } catch (e) {
    if (e instanceof DomainError && (e.code === "FORBIDDEN" || e.code === "NOT_FOUND")) notFound();
    if (e instanceof DomainError && e.code === "VALIDATION") failure = e.message;
    else throw e;
  }

  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries({ preset: sp.preset, from: sp.from, to: sp.to, status: sp.status, priority: sp.priority })) if (v) exportQuery.set(k, v);
  const exportHref = (format: string) => `/api/exports/${key}?${new URLSearchParams({ ...Object.fromEntries(exportQuery), format }).toString()}`;
  const canExport = can(actor, "reports.export");
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const isTaskReport = key === "task-register";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={result?.title ?? "Report"}
        description={result?.subtitle || undefined}
        actions={
          canExport && result ? (
            <>
              <a href={exportHref("csv")} className={buttonClass("secondary")}>
                Export CSV
              </a>
              <a href={exportHref("xlsx")} className={buttonClass("secondary")}>
                Export XLSX
              </a>
              <a href={exportHref("pdf")} className={buttonClass("secondary")}>
                Export PDF
              </a>
            </>
          ) : null
        }
      />

      {key === "employee-workload" ? (
        <RangeFilter preset={sp.preset ?? "month"} from={sp.from} to={sp.to} error={failure} />
      ) : isTaskReport ? (
        <form className="flex flex-wrap items-end gap-2" aria-label="Filters">
          <label className="flex flex-col text-xs text-muted">
            Status
            <select name="status" defaultValue={status ?? ""} className={inputClass}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted">
            Priority
            <select name="priority" defaultValue={priority ?? ""} className={inputClass}>
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted">
            Due from
            <input type="date" name="from" defaultValue={sp.from} className={inputClass} />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Due to
            <input type="date" name="to" defaultValue={sp.to} className={inputClass} />
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            Apply
          </button>
          {failure ? (
            <p role="alert" className="w-full text-sm text-danger">
              {failure}
            </p>
          ) : null}
        </form>
      ) : null}

      {!result ? (
        <ErrorState title="This report could not be run" message={failure} />
      ) : result.rows.length === 0 ? (
        <EmptyState title="No rows match" description="Try a wider period or fewer filters." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              {result.title}, {result.total} rows
            </caption>
            <thead className="sticky top-0 bg-primary-soft">
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} scope="col" className={`px-3 py-2 ${c.type === "number" ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {result.columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.type === "number" ? "text-right tabular-nums" : ""}`}>
                      {r[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Pagination">
          <span>
            {result.total} row{result.total === 1 ? "" : "s"}
          </span>
          {page > 1 ? (
            <Link href={{ query: { ...sp, page: page - 1 } }} className="underline">
              Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={{ query: { ...sp, page: page + 1 } }} className="underline">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
