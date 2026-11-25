import { ControlPanel } from "@/components/ui/odoo";
import { requireActor } from "@/lib/auth/require-actor";
import { ReportsPanel, type ReportsSearch } from "../finance/reports-panel";

export const metadata = { title: "Reports" };

/** Standalone Reports page: task, workload, project and client reports with filters, paging and export. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearch> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <ControlPanel
        crumbs={[{ label: "Reports" }]}
        description={<>Work, people, projects and clients. Filter a report, read it here, or export it.</>}
      />
      <ReportsPanel actor={actor} sp={sp} basePath="/reports" fixed={{}} />
    </div>
  );
}
