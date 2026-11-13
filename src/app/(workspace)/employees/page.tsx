import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";

export const metadata = { title: "Employees" };

const PAGE_SIZE = 20;
const STATUSES = ["Active", "Inactive", "Suspended"] as const;
const SORTS = ["name", "code", "joined"] as const;

const COLUMNS: DataColumn[] = [
  { key: "employeeCode", header: "Code", sortable: true, sortKey: "code" },
  { key: "fullName", header: "Name", kind: "link", href: "/employees/{id}", sortable: true, sortKey: "name" },
  { key: "designation", header: "Designation" },
  { key: "department", header: "Department" },
  { key: "employmentStatus", header: "Status", kind: "status" },
  { key: "joiningDate", header: "Joined", sortable: true, sortKey: "joined", defaultHidden: true },
  { key: "workEmail", header: "Email", defaultHidden: true },
];

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string; sort?: string; dir?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "employees.read")) return <p>You do not have access to the employee directory.</p>;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const sort = SORTS.find((s) => s === sp.sort);
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const { rows, total } = await listEmployees(actor, { page, pageSize: PAGE_SIZE, search: sp.q, status, sort, dir });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Employees"
        actions={can(actor, "employees.create") ? <Link href="/employees/new" className={buttonClass("primary")}>New employee</Link> : null}
      />
      <form className="flex flex-wrap gap-2" role="search" aria-label="Filter employees">
        <input name="q" defaultValue={sp.q} aria-label="Search" placeholder="Search name, email or code" className={`${inputClass} max-w-xs`} />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={`${inputClass} max-w-40`}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
      </form>
      <DataTable
        caption="Employees"
        columns={COLUMNS}
        rows={rows.map((e) => ({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, designation: e.designation, department: e.department, employmentStatus: e.employmentStatus, joiningDate: e.joiningDate, workEmail: e.workEmail }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/employees"
        params={{ q: sp.q, status, sort, dir: sort ? dir : undefined }}
        emptyTitle="No employees match"
        emptyDescription="Try a different search or filter."
        emptyAction={can(actor, "employees.create") ? { href: "/employees/new", label: "Add an employee" } : undefined}
      />
    </div>
  );
}
