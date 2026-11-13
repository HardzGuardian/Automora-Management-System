import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { availableReports } from "@/modules/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const actor = await requireActor();
  const reports = availableReports(actor);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Reports & analytics" description="Pick a report, set the filters, then view or export it. Exports use exactly the same filters and visibility." />
      {reports.length === 0 ? (
        <EmptyState title="No reports available" description="Your role does not include any reports. Ask an administrator if you need access." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {reports.map((r) => (
            <li key={r.key} className="rounded-md border border-border bg-surface p-4 shadow-sm">
              <h2 className="m-0 text-base font-semibold">
                <Link href={`/reports/${r.key}`} className="underline">
                  {r.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-muted">{r.description}</p>
            </li>
          ))}
        </ul>
      )}
      {can(actor, "finance.reports.read") ? (
        <p className="text-sm text-muted">
          Receivables, cash movement and the expense register are on the{" "}
          <Link href="/finance-reports" className="font-medium text-foreground underline">
            Finance reports
          </Link>{" "}
          page.
        </p>
      ) : null}
    </div>
  );
}
