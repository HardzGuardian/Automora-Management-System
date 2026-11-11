import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listTasks } from "@/modules/tasks";
import { TaskFilters } from "./_components/task-filters";
import { TaskTable } from "./_components/task-table";

const PAGE_SIZE = 25;
const STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; priority?: string; overdue?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const priority = PRIORITIES.find((p) => p === sp.priority);
  const { rows, total } = await listTasks(actor, {
    view: "all",
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    status: status ? [status] : undefined,
    priority: priority ? [priority] : undefined,
    overdue: sp.overdue === "1" || undefined,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">All tasks ({total})</h1>
        {can(actor, "tasks.create") ? (
          <Link href="/tasks/new" className="rounded bg-black px-3 py-2 text-white">
            New task
          </Link>
        ) : null}
      </div>
      <TaskFilters q={sp.q} status={status} priority={priority} overdue={sp.overdue === "1"} />
      <TaskTable rows={rows} today={todayInTz(actor.timezone)} />
      <nav className="flex items-center gap-3 text-sm">
        {page > 1 ? (
          <Link href={{ query: { ...sp, page: page - 1 } }} className="underline">
            Previous
          </Link>
        ) : null}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={{ query: { ...sp, page: page + 1 } }} className="underline">
            Next
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
