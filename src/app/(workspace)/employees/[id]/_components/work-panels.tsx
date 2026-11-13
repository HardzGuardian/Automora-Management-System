import Link from "next/link";
import { activityVerb } from "@/components/dashboard/activity-feed";
import { DueDate } from "@/components/ui/due-date";
import { formatDateTime } from "@/components/ui/format";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { linkClass } from "@/components/ui/styles";
import type { EmployeeActivityRow, EmployeeProjectRow } from "@/modules/employees";

export function ProjectsPanel({ rows }: { rows: EmployeeProjectRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No projects" description="This person is not a member of any project you can see." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[30rem] rounded-none border-0 text-left text-sm">
        <caption className="sr-only">Projects</caption>
        <thead className="bg-primary-soft">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Project</th>
            <th scope="col" className="px-3 py-2 font-semibold">Role</th>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 font-semibold">Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Link href={`/projects/${p.id}`} className={linkClass}>
                  {p.name}
                </Link>
                <span className="block text-xs text-muted">{p.projectCode}</span>
              </td>
              <td className="px-3 py-2 capitalize">{p.membershipRole}</td>
              <td className="px-3 py-2">
                <StatusBadge status={p.archived ? "Archived" : p.status} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <DueDate value={p.dueDate} overdue={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityPanel({ rows, timezone }: { rows: EmployeeActivityRow[]; timezone: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No activity yet" description="Nothing on tasks you can see, or this person has no account yet." />;
  }
  return (
    <ul className="flex flex-col divide-y divide-border text-sm">
      {rows.map((a) => (
        <li key={a.id} className="py-2">
          {activityVerb(a.action)}{" "}
          <Link href={`/tasks/${a.taskId}`} className={linkClass}>
            {a.taskCode} {a.taskTitle}
          </Link>
          <span className="block text-xs text-muted">{formatDateTime(a.createdAt, timezone)}</span>
        </li>
      ))}
    </ul>
  );
}
