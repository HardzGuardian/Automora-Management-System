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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={TITLE[dash.audience]} description={`Period: ${period} · Today is ${dash.range.today}`} />
      <RangeFilter preset={dash.range.preset} from={dash.range.from} to={dash.range.to} error={error} />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {c.activeEmployees !== null ? <KpiCard label="Active employees" value={c.activeEmployees} basis="point in time" href="/employees" /> : null}
        {c.activeClients !== null ? <KpiCard label="Active clients" value={c.activeClients} basis="point in time" href="/clients" /> : null}
        <KpiCard label="Active projects" value={c.activeProjects} basis="point in time" href="/projects" />
        <KpiCard label="Open tasks" value={c.openTasks} basis="point in time" href={dash.audience === "personal" ? "/my-tasks" : "/tasks"} />
        <KpiCard label="Completed tasks" value={c.completedTasks} basis="period total" tone="success" hint={period} />
        <KpiCard label="Overdue tasks" value={c.overdueTasks} basis="point in time" tone={c.overdueTasks > 0 ? "danger" : "neutral"} href={dash.audience === "personal" ? "/my-tasks?overdue=1" : "/tasks?overdue=1"} />
        <KpiCard label="Due in next 7 days" value={c.dueNext7Days} basis="point in time" tone="info" />
        {f ? <KpiCard label="Outstanding invoices" value={f.pointInTime.outstandingReceivables.map((o) => `${o.currency} ${o.amount}`).join(" · ") || "0.00"} basis="point in time" href="/invoices" /> : null}
      </section>

      <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Tasks by status"
          caption="Point in time · all non-archived tasks you can see"
          data={dash.taskStatus.map((s) => ({ label: s.status, value: s.count, color: STATUS_COLOR[s.status] }))}
        />
        <BarChartCard
          title="Open tasks by priority"
          caption="Point in time · completed tasks excluded"
          data={dash.taskPriority.map((p) => ({ label: p.priority, value: p.count, color: PRIORITY_COLOR[p.priority] }))}
        />
      </section>

      <section aria-label="Deadlines" className="grid gap-4 lg:grid-cols-2">
        <DeadlineList title="Upcoming deadlines (next 7 days)" items={dash.upcoming} empty="No deadlines in the next 7 days." viewAllHref="/tasks" />
        <DeadlineList title="Overdue tasks" items={dash.overdue} overdue empty="Nothing is overdue." viewAllHref={dash.audience === "personal" ? "/my-tasks?overdue=1" : "/tasks?overdue=1"} />
      </section>

      {dash.workload ? (
        <BarChartCard
          title="Open tasks per employee"
          caption="Point in time · active employees with open work"
          horizontal
          valueLabel="Open tasks"
          data={dash.workload.map((w) => ({ label: w.name, value: w.open, color: w.overdue > 0 ? "#b42318" : "#167c50" }))}
          emptyText="No open assignments."
        />
      ) : null}

      {f ? (
        <FinanceSnapshotCard
          invoices={f.periodTotals.invoicesByIssueDate}
          receipts={f.periodTotals.confirmedReceiptsByPaymentDate}
          expenses={f.periodTotals.expensesByExpenseDate}
          outstanding={f.pointInTime.outstandingReceivables}
        />
      ) : null}

      <ActivityFeed items={dash.activity} />
    </div>
  );
}
