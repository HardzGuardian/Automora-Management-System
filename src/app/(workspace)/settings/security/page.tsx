import { notFound } from "next/navigation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatDateTime } from "@/components/ui/format";
import { Pager } from "@/components/ui/pager";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { PERMISSION_LABELS } from "@/lib/permissions/labels";
import { parsePage } from "@/lib/pagination";
import { getSecuritySummary, isSecurityEventType, listSecurityEvents, type SecurityEventRow } from "@/modules/monitoring";

export const metadata = { title: "Security" };

const PAGE_SIZE = 25;

const TYPE_LABEL = {
  login_failed: "Failed sign-in",
  login_blocked: "Sign-in blocked",
  permission_denied: "Permission denied",
  job_failed: "Scheduled job failed",
} as const;

const REASON: Record<string, string> = {
  invalid: "wrong email or password",
  suspended: "account is suspended",
  too_many_attempts: "too many attempts, temporarily blocked",
};

/** One plain sentence per event. Permission keys are shown in the same plain wording as the roles screen. */
function describe(e: SecurityEventRow): string {
  const detail = e.detail ?? {};
  switch (e.type) {
    case "login_failed":
    case "login_blocked": {
      const why = REASON[String(detail.reason)] ?? "";
      return `${e.subject ?? "unknown email"}${why ? ` — ${why}` : ""}`;
    }
    case "permission_denied": {
      const label = e.subject && e.subject in PERMISSION_LABELS ? PERMISSION_LABELS[e.subject as keyof typeof PERMISSION_LABELS] : e.subject;
      return `${e.actorName ?? "Someone"} tried: ${label ?? "an action"}`;
    }
    case "job_failed":
      return `${e.subject ?? "job"} — ${String(detail.message ?? "failed")}`;
  }
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "audit.read")) notFound();
  const sp = await searchParams;
  const type = isSecurityEventType(sp.type) ? sp.type : undefined;
  const page = parsePage(sp.page);
  const [summary, list] = await Promise.all([getSecuritySummary(actor), listSecurityEvents(actor, { type, page, pageSize: PAGE_SIZE })]);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const href = (p: number) => ({ query: { ...(type ? { type } : {}), ...(p > 1 ? { page: p } : {}) } });

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted">
        Failed sign-ins, denied actions and failed scheduled jobs, recorded automatically. The log cannot be edited or erased. Repeated denials by the same person
        are shown once a minute.
      </p>

      <section aria-label="Last 24 hours" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Failed sign-ins" value={summary.login_failed} tone={summary.login_failed > 0 ? "danger" : "neutral"} />
          <KpiCard label="Sign-ins blocked" value={summary.login_blocked} tone={summary.login_blocked > 0 ? "danger" : "neutral"} />
          <KpiCard label="Permission denied" value={summary.permission_denied} />
          <KpiCard label="Jobs failed" value={summary.job_failed} tone={summary.job_failed > 0 ? "danger" : "neutral"} />
        </div>
        <p className="text-xs text-muted">Counts cover the last 24 hours.</p>
      </section>

      <FilterBar label="Filter events">
        <select name="type" aria-label="Event type" defaultValue={type ?? ""} className={`${inputClass} sm:w-64`}>
          <option value="">All events</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FilterBar>

      {list.rows.length === 0 ? (
        <EmptyState title="Nothing to report" description={type ? "No events of this kind." : "No failed sign-ins, denied actions or failed jobs have been recorded."} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[34rem] rounded-none border-0 text-left text-sm">
            <caption className="sr-only">Security events, newest first</caption>
            <thead className="bg-primary-soft">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">When</th>
                <th scope="col" className="px-3 py-2 font-semibold">Event</th>
                <th scope="col" className="px-3 py-2 font-semibold">What happened</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(e.createdAt, actor.timezone)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={TYPE_LABEL[e.type]} />
                  </td>
                  <td className="px-3 py-2">
                    {describe(e)}
                    {e.ip ? <span className="block text-xs text-muted">from {e.ip}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} pages={pages} prevHref={page > 1 ? href(page - 1) : undefined} nextHref={page < pages ? href(page + 1) : undefined} />
    </div>
  );
}
