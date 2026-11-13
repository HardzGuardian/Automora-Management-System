import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listTasks } from "@/modules/tasks";
import { bulkAction } from "./actions";
import { TaskFilters } from "./_components/task-filters";
import { TaskTable } from "./_components/task-table";

const PAGE_SIZE = 25;
const STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; priority?: string; overdue?: string; bulk?: string; bulkError?: string }>;
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
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">All tasks ({total})</h1>
        <div className="flex items-center gap-3">
          <Link href={{ pathname: "/tasks/calendar", query: { view: "all" } }} className="text-sm underline">
            Calendar
          </Link>
          {can(actor, "tasks.create") ? (
            <Link href="/tasks/new" className="rounded bg-primary px-3 py-2 text-white">
              New task
            </Link>
          ) : null}
        </div>
      </div>
      <TaskFilters q={sp.q} status={status} priority={priority} overdue={sp.overdue === "1"} />
      {sp.bulk ? (
        <p role="status" className="text-sm text-success">
          Bulk update: {sp.bulk.split("-")[0]} done, {sp.bulk.split("-")[1]} not applied.
        </p>
      ) : null}
      {sp.bulkError ? (
        <p role="alert" className="text-sm text-danger">
          {sp.bulkError}
        </p>
      ) : null}
      {can(actor, "tasks.bulk") ? (
        <form id="bulk-form" action={bulkAction} className="flex flex-wrap items-center gap-2 text-sm">
          <select name="op" className="rounded border border-border px-3 py-2" aria-label="Bulk action">
            <option value="status:In Progress">Move to In Progress</option>
            <option value="status:In Review">Move to In Review</option>
            <option value="status:Completed">Move to Completed</option>
            <option value="status:Pending">Move to Pending</option>
            {can(actor, "tasks.archive") ? <option value="archive">Archive</option> : null}
          </select>
          <button type="submit" className="rounded border border-border px-3 py-2">
            Apply to selected
          </button>
        </form>
      ) : null}
      <TaskTable rows={rows} today={todayInTz(actor.timezone)} selectFormId={can(actor, "tasks.bulk") ? "bulk-form" : undefined} />
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
