import { notFound } from "next/navigation";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ToastProvider } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/styles";
import { DemoForm } from "./demo-form";

// Design-system gallery. Development only: in production this route does not exist.
export const metadata = { title: "UI kit" };

const STATUSES = ["Pending", "In Progress", "In Review", "Completed", "On Hold", "Cancelled", "Suspended", "draft", "issued", "partially_paid", "paid", "overdue", "reversed"];

export default function UiKitPage() {
  // eslint-disable-next-line no-restricted-properties -- build mode check, not app configuration
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
        <PageHeader title="UI kit" description="Every shared component in one place. Dev only." />

        <section aria-label="Colours" className="flex flex-wrap gap-2">
          {[["primary", "bg-primary text-white"], ["success", "bg-success-soft text-success"], ["info", "bg-info-soft text-info"], ["warning", "bg-warning-soft text-warning"], ["danger", "bg-danger-soft text-danger"]].map(([n, c]) => (
            <span key={n} className={`rounded-md px-3 py-2 text-sm ${c}`}>
              {n}
            </span>
          ))}
        </section>

        <section aria-label="Buttons" className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <a href="#" className={buttonClass("secondary")}>
            Link button
          </a>
        </section>

        <section aria-label="Status badges" className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <StatusBadge status="Pending" overdue />
        </section>

        <section aria-label="KPI cards" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Open tasks" value={12} basis="point in time" />
          <KpiCard label="Completed" value={7} basis="period total" tone="success" />
          <KpiCard label="Overdue" value={3} basis="point in time" tone="danger" />
          <KpiCard label="Due soon" value={5} basis="point in time" tone="info" />
        </section>

        <BarChartCard title="Sample chart" caption="Colour never carries meaning alone: labels and a table are always available" data={[{ label: "Urgent", value: 2, color: "#b42318" }, { label: "High", value: 4, color: "#a15c00" }, { label: "Medium", value: 6, color: "#1d5fb8" }, { label: "Low", value: 1, color: "#5b6770" }]} />

        <section aria-label="States" className="grid gap-4 md:grid-cols-2">
          <EmptyState title="Nothing here yet" description="Empty states explain what to do next." action={{ href: "#", label: "Create the first one" }} />
          <ErrorState title="Could not load" message="Errors say what happened and offer a retry." />
          <div className="md:col-span-2">
            <TableSkeleton rows={3} cols={4} />
          </div>
        </section>

        <section aria-label="Form kit">
          <h2 className="mb-2 text-lg font-semibold">Form kit (React Hook Form + Zod)</h2>
          <DemoForm />
        </section>
      </main>
    </ToastProvider>
  );
}
