import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Pager } from "@/components/ui/pager";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listTasks } from "@/modules/tasks";
import { bulkAction } from "./actions";
import { TaskFilters } from "./_components/task-filters";
import { TaskTable } from "./_components/task-table";
import { parsePage } from "@/lib/pagination";

export const metadata = { title: "All tasks" };

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
  const page = parsePage(sp.page);
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
  const canBulk = can(actor, "tasks.bulk");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="All tasks"
        description={`${total} ${total === 1 ? "task" : "tasks"} you can see across the company.`}
        actions={
          <>
            <Link href={{ pathname: "/tasks/calendar", query: { view: "all" } }} className={buttonClass("secondary")}>
              Calendar
            </Link>
            {can(actor, "tasks.create") ? (
              <Link href="/tasks/new" className={buttonClass("primary")}>
                New task
              </Link>
            ) : null}
          </>
        }
      />
      <TaskFilters q={sp.q} status={status} priority={priority} overdue={sp.overdue === "1"} clearHref="/tasks" />
      {sp.bulk ? (
        <Alert tone="success">
          Bulk update: {sp.bulk.split("-")[0]} done, {sp.bulk.split("-")[1]} not applied.
        </Alert>
      ) : null}
      {sp.bulkError ? <Alert tone="error">{sp.bulkError}</Alert> : null}
      {canBulk ? (
        <form id="bulk-form" action={bulkAction} className="flex flex-wrap items-center gap-2 text-sm">
          <select name="op" className={`${inputClass} sm:w-56`} aria-label="Bulk action">
            <option value="status:In Progress">Move to In Progress</option>
            <option value="status:In Review">Move to In Review</option>
            <option value="status:Completed">Move to Completed</option>
            <option value="status:Pending">Move to Pending</option>
            {can(actor, "tasks.archive") ? <option value="archive">Archive</option> : null}
          </select>
          <button type="submit" className={buttonClass("secondary")}>
            Apply to selected
          </button>
          <span className="text-muted">Tick tasks in the table first.</span>
        </form>
      ) : null}
      <TaskTable rows={rows} today={todayInTz(actor.timezone)} selectFormId={canBulk ? "bulk-form" : undefined} />
      <Pager
        page={page}
        pages={pages}
        prevHref={page > 1 ? { query: { ...sp, page: page - 1 } } : undefined}
        nextHref={page < pages ? { query: { ...sp, page: page + 1 } } : undefined}
      />
    </div>
  );
}
