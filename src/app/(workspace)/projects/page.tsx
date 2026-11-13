import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getProgressForProjects, listProjects } from "@/modules/projects";
import { parsePage } from "@/lib/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Projects" };

const PAGE_SIZE = 20;
const STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled", "Archived"] as const;
const COLUMNS: DataColumn[] = [
  { key: "projectCode", header: "Code" },
  { key: "name", header: "Name", kind: "link", href: "/projects/{id}" },
  { key: "type", header: "Type" },
  { key: "status", header: "Status", kind: "status" },
  { key: "dueDate", header: "Due" },
  { key: "progress", header: "Progress", kind: "number" },
  { key: "budget", header: "Budget", kind: "number", defaultHidden: true },
];

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const status = STATUSES.find((s) => s === sp.status);
  const { rows, total } = await listProjects(actor, { page, pageSize: PAGE_SIZE, search: sp.q, status, includeArchived: status === "Archived" });
  const progress = await getProgressForProjects(actor, rows.map((r) => r.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Projects" actions={can(actor, "projects.create") ? <Link href="/projects/new" className={buttonClass("primary")}>New project</Link> : null} />
      <FilterBar label="Filter projects">
        <input name="q" defaultValue={sp.q} aria-label="Search" placeholder="Search projects" className={`${inputClass} max-w-xs`} />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={`${inputClass} max-w-40`}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </FilterBar>
      <DataTable
        caption="Projects"
        columns={COLUMNS}
        rows={rows.map((p) => ({
          id: p.id,
          projectCode: p.projectCode,
          name: p.name,
          type: p.type,
          status: p.status,
          dueDate: p.dueDate,
          progress: `${progress.get(p.id)?.percent ?? 0}%`,
          budget: p.budgetAmount ? `${p.currency} ${p.budgetAmount}` : null,
        }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/projects"
        params={{ q: sp.q, status }}
        emptyTitle="No projects match"
        emptyDescription="Projects you can see will be listed here."
        emptyAction={can(actor, "projects.create") ? { href: "/projects/new", label: "Create a project" } : undefined}
      />
    </div>
  );
}
