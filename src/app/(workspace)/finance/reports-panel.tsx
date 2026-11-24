import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { Pager } from "@/components/ui/pager";
import { buttonClass, inputClass } from "@/components/ui/styles";
import type { Actor } from "@/lib/auth/actor";
import { cn } from "@/lib/cn";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { availableReports, runReport, type ReportFilters } from "@/modules/reports";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
] as const;
const SUBTITLE: Record<string, string> = {
  "task-register": "Every task with its project, owner and status. A point-in-time list.",
  "employee-workload": "Open work per person right now, plus what they completed in the period.",
  "project-status": "Progress is completed tasks divided by all tasks, rounded down. Cash is confirmed receipts less confirmed expense payments.",
  "client-summary": "Projects, open work and invoice totals for each client.",
};
const FORMATS = [
  { key: "csv", label: "Export as CSV" },
  { key: "xlsx", label: "Export as XLSX" },
  { key: "pdf", label: "Export as PDF" },
] as const;
const STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
const PAGE_SIZE = 25;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type ReportsSearch = {
  report?: string;
  period?: string;
  from?: string;
  to?: string;
  status?: string;
  priority?: string;
  clientId?: string;
  projectId?: string;
  assigneeId?: string;
  page?: string;
};

/**
 * The reports screen: pick a report and a period, filter it, page through it, export it.
 * `basePath` is where the links point ("/reports", or "/finance" with `fixed` = { tab: "reports" }).
 */
export async function ReportsPanel({ actor, sp, basePath = "/finance", fixed = { tab: "reports" } }: { actor: Actor; sp: ReportsSearch; basePath?: string; fixed?: Record<string, string> }) {
  const reports = availableReports(actor);
  if (reports.length === 0) return <p className="rounded-lg border border-border bg-surface p-5 text-muted">You do not have access to any report.</p>;
  const current = reports.find((r) => r.key === sp.report) ?? reports[0];
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[2];
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : undefined;
  const priority = (PRIORITIES as readonly string[]).includes(sp.priority ?? "") ? (sp.priority as (typeof PRIORITIES)[number]) : undefined;
  const from = sp.from && ISO.test(sp.from) ? sp.from : undefined;
  const to = sp.to && ISO.test(sp.to) ? sp.to : undefined;
  const isTasks = current.key === "task-register";
  const filters: ReportFilters = {
    preset: from && to ? "custom" : period.key,
    from: from && to ? from : isTasks ? from : undefined,
    to: from && to ? to : isTasks ? to : undefined,
    status: isTasks && status ? [status] : undefined,
    priority: isTasks && priority ? [priority] : undefined,
    clientId: sp.clientId || undefined,
    projectId: isTasks ? sp.projectId || undefined : undefined,
    assigneeId: isTasks ? sp.assigneeId || undefined : undefined,
  };

  const [clientOptions, projectOptions, personOptions] = await Promise.all([
    can(actor, "clients.read") ? listClients(actor, { page: 1, pageSize: 100 }).then((r) => r.rows.map((c) => ({ id: c.id, name: c.name }))).catch(() => []) : Promise.resolve([]),
    isTasks ? listProjects(actor, { page: 1, pageSize: 100 }).then((r) => r.rows.map((p) => ({ id: p.id, name: p.name }))).catch(() => []) : Promise.resolve([]),
    isTasks && can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }).then((r) => r.rows.map((e) => ({ id: e.id, name: e.fullName }))).catch(() => []) : Promise.resolve([]),
  ]);

  let result: Awaited<ReturnType<typeof runReport>> | null = null;
  let failure: string | null = null;
  try {
    result = await runReport(actor, current.key, { ...filters, page, pageSize: PAGE_SIZE });
  } catch (e) {
    if (e instanceof DomainError && (e.code === "VALIDATION" || e.code === "FORBIDDEN")) failure = e.message;
    else throw e;
  }

  const base = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams(fixed);
    const all: Record<string, string | undefined> = {
      report: current.key,
      period: period.key,
      from,
      to,
      status: isTasks ? status : undefined,
      priority: isTasks ? priority : undefined,
      clientId: sp.clientId,
      projectId: isTasks ? sp.projectId : undefined,
      assigneeId: isTasks ? sp.assigneeId : undefined,
      ...extra,
    };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  const canExport = can(actor, "reports.export") && result !== null;
  const exportParams = new URLSearchParams({
    preset: filters.preset ?? period.key,
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.status?.length ? { status: filters.status.join(",") } : {}),
    ...(filters.priority?.length ? { priority: filters.priority.join(",") } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
  });
  const exportHref = (format: string) => `/api/exports/${current.key}?${new URLSearchParams({ format, ...Object.fromEntries(exportParams) }).toString()}`;
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const filtered = Boolean(from || to || status || priority || sp.clientId || sp.projectId || sp.assigneeId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills label="Choose a report" pills={reports.map((r) => ({ label: r.title, href: base({ report: r.key, page: undefined, status: undefined, priority: undefined, projectId: undefined, assigneeId: undefined }), active: r.key === current.key }))} />
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

      <form method="get" action={basePath} aria-label="Report filters" className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(fixed).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="report" value={current.key} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Period
          <select name="period" defaultValue={period.key} className={inputClass}>
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {isTasks ? "Due from" : "From (custom range)"}
          <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {isTasks ? "Due to" : "To (custom range)"}
          <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
        </label>
        {isTasks ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Status
              <select name="status" defaultValue={status ?? ""} className={inputClass}>
                <option value="">Any</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Priority
              <select name="priority" defaultValue={priority ?? ""} className={inputClass}>
                <option value="">Any</option>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {clientOptions.length > 0 && (isTasks || current.key === "project-status") ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Client
            <select name="clientId" defaultValue={sp.clientId ?? ""} className={inputClass}>
              <option value="">Any client</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isTasks && projectOptions.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Project
            <select name="projectId" defaultValue={sp.projectId ?? ""} className={inputClass}>
              <option value="">Any project</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isTasks && personOptions.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Assignee
            <select name="assigneeId" defaultValue={sp.assigneeId ?? ""} className={inputClass}>
              <option value="">Anyone</option>
              {personOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonClass("primary")}>
            Apply filters
          </button>
          {filtered ? (
            <Link href={`${basePath}?${new URLSearchParams({ ...fixed, report: current.key, period: period.key }).toString()}`} className={buttonClass("secondary")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-label={current.title} tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 py-[18px]">
          <h2 className="m-0 text-base font-semibold text-foreground">{current.title}</h2>
          <p className="mb-0 mt-0.5 text-xs text-muted">
            {SUBTITLE[current.key] ?? current.description} {from && to ? `Range: ${from} to ${to}.` : `Period: ${period.label.toLowerCase()}.`}
          </p>
        </div>
        {failure ? (
          <p role="alert" className="px-5 py-6 text-danger">{failure}</p>
        ) : !result || result.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No rows match. Try a wider period or fewer filters.</p>
        ) : (
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
        )}
      </section>
      {result && result.total > 0 ? (
        <p className="m-0 text-xs text-muted">
          Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + result.rows.length} of {result.total} rows.{canExport ? " Exports include every row (PDF: first 2,000)." : ""}
        </p>
      ) : null}
      <Pager page={page} pages={pages} prevHref={page > 1 ? base({ page: String(page - 1) }) : undefined} nextHref={page < pages ? base({ page: String(page + 1) }) : undefined} />

      {can(actor, "finance.reports.read") ? (
        <p className="m-0 text-sm text-muted">
          Receivables, cash movement, the expense register and project finance are in{" "}
          <Link href="/finance-reports" className="font-medium text-primary-ink underline">
            Finance reports
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
