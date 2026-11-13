import { BarChartCard } from "@/components/charts/bar-chart-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DeadlineList } from "@/components/dashboard/deadline-list";
import { FinanceSnapshotCard } from "@/components/dashboard/finance-snapshot";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RangeFilter } from "@/components/dashboard/range-filter";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { getDashboard, RANGE_PRESETS, type RangePreset } from "@/modules/reports";

export const metadata = { title: "Dashboard" };

const STATUS_COLOR: Record<string, string> = { Pending: "#a15c00", "In Progress": "#1d5fb8", "In Review": "#5b8fd6", Completed: "#167c50" };
const PRIORITY_COLOR: Record<string, string> = { Urgent: "#b42318", High: "#a15c00", Medium: "#1d5fb8", Low: "#5b6770" };

const TITLE = { company: "Company dashboard", operational: "Operations dashboard", personal: "My dashboard" } as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(sp.preset ?? "") ? (sp.preset as RangePreset) : "month";

  let dash;
  let error: string | undefined;
  try {
    dash = await getDashboard(actor, { preset, from: sp.from, to: sp.to });
  } catch (e) {
    if (e instanceof DomainError && e.code === "VALIDATION") {
      error = e.message;
      dash = await getDashboard(actor, { preset: "month" });
    } else if (e instanceof DomainError && e.code === "FORBIDDEN") {
      return <ErrorState title="No dashboard available" message="Your role does not include a dashboard. Ask an administrator for access." />;
    } else throw e;
  }
  const c = dash.counts;
  const f = dash.finance;
  const period = `${dash.range.from} – ${dash.range.to}`;

  const tasksHref = dash.audience === "personal" ? "/my-tasks" : "/tasks";
  const overdueHref = dash.audience === "personal" ? "/my-tasks?overdue=1" : "/tasks?overdue=1";
  const outstanding = f ? f.pointInTime.outstandingReceivables.map((o) => `${o.currency} ${o.amount}`).join(" · ") || "0.00" : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={TITLE[dash.audience]}
        description={period}
        actions={<RangeFilter preset={dash.range.preset} from={dash.range.from} to={dash.range.to} error={error} />}
      />

      <section aria-label="Key figures" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Open tasks" value={c.openTasks} href={tasksHref} />
          <KpiCard label="Overdue tasks" value={c.overdueTasks} tone={c.overdueTasks > 0 ? "danger" : "neutral"} href={overdueHref} />
          <KpiCard label="Due in next 7 days" value={c.dueNext7Days} tone="info" />
          {outstanding !== null ? (
            <KpiCard label="Outstanding invoices" value={outstanding} href="/invoices" />
          ) : (
            <KpiCard label="Completed tasks" value={c.completedTasks} basis="period total" tone="success" />
          )}
        </div>
        <details className="group">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm text-primary underline underline-offset-2">
            More figures
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {c.activeEmployees !== null ? <KpiCard label="Active employees" value={c.activeEmployees} href="/employees" /> : null}
            {c.activeClients !== null ? <KpiCard label="Active clients" value={c.activeClients} href="/clients" /> : null}
            <KpiCard label="Active projects" value={c.activeProjects} href="/projects" />
            {outstanding !== null ? <KpiCard label="Completed tasks" value={c.completedTasks} basis="period total" tone="success" /> : null}
          </div>
        </details>
        <p className="text-xs text-muted">Figures are as of today, except those marked “period total”, which cover {period}.</p>
      </section>

      <section aria-label="Needs attention" className="grid gap-4 lg:grid-cols-2">
        <DeadlineList title="Overdue" items={dash.overdue} overdue empty="Nothing is overdue." viewAllHref={overdueHref} />
        <DeadlineList title="Due in the next 7 days" items={dash.upcoming} empty="No deadlines in the next 7 days." viewAllHref={tasksHref} />
      </section>

      {f ? (
        <FinanceSnapshotCard
          invoices={f.periodTotals.invoicesByIssueDate}
          receipts={f.periodTotals.confirmedReceiptsByPaymentDate}
          expenses={f.periodTotals.expensesByExpenseDate}
          outstanding={f.pointInTime.outstandingReceivables}
        />
      ) : null}

      <section aria-label="Breakdown" className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Tasks by status"
          caption="All non-archived tasks you can see"
          data={dash.taskStatus.map((s) => ({ label: s.status, value: s.count, color: STATUS_COLOR[s.status] }))}
        />
        <BarChartCard
          title="Open tasks by priority"
          caption="Completed tasks excluded"
          data={dash.taskPriority.map((p) => ({ label: p.priority, value: p.count, color: PRIORITY_COLOR[p.priority] }))}
        />
      </section>

      {dash.workload ? (
        <BarChartCard
          title="Open tasks per employee"
          caption="Red bar = has overdue tasks, green = none"
          horizontal
          valueLabel="Open tasks"
          data={dash.workload.map((w) => ({ label: w.name, value: w.open, color: w.overdue > 0 ? "#b42318" : "#167c50" }))}
          emptyText="No open assignments."
        />
      ) : null}

      <ActivityFeed items={dash.activity} />
    </div>
  );
}
