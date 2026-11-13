import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { allowedTransitions, isOwnTransitionAllowed, listTasks } from "@/modules/tasks";
import { BoardDnd } from "../tasks/_components/board-dnd";
import { TaskFilters } from "../tasks/_components/task-filters";
import { TaskTable } from "../tasks/_components/task-table";

export const metadata = { title: "My tasks" };

const STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; layout?: string; status?: string; priority?: string; overdue?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const layout = sp.layout === "board" ? "board" : "list";
  const status = STATUSES.find((s) => s === sp.status);
  const priority = PRIORITIES.find((p) => p === sp.priority);
  const { rows, total } = await listTasks(actor, {
    view: "mine",
    pageSize: 100,
    sort: "due",
    search: sp.q,
    status: status ? [status] : undefined,
    priority: priority ? [priority] : undefined,
    overdue: sp.overdue === "1" || undefined,
  });
  const today = todayInTz(actor.timezone);
  const canManage = can(actor, "tasks.update");
  const boardTasks = rows.map((t) => ({
    id: t.id,
    taskCode: t.taskCode,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    overdue: t.dueDate !== null && t.dueDate < today && t.status !== "Completed",
    allowed: allowedTransitions(t.status).filter(
      (to) => canManage || (can(actor, "tasks.status.update.own") && isOwnTransitionAllowed(t.status, to)),
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My tasks"
        description={`${total} ${total === 1 ? "task" : "tasks"} assigned to you, soonest due first.`}
        actions={
          <>
            <Link href={{ pathname: "/tasks/calendar", query: { view: "mine" } }} className={buttonClass("secondary")}>
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
      <SegmentedNav
        label="Layout"
        items={[
          { label: "List", href: { query: { ...sp, layout: "list" } }, active: layout === "list" },
          { label: "Board", href: { query: { ...sp, layout: "board" } }, active: layout === "board" },
        ]}
      />
      <TaskFilters
        q={sp.q}
        status={status}
        priority={priority}
        overdue={sp.overdue === "1"}
        extra={<input type="hidden" name="layout" value={layout} />}
        clearHref={layout === "board" ? "/my-tasks?layout=board" : "/my-tasks"}
      />
      {layout === "board" ? (
        <BoardDnd tasks={boardTasks} />
      ) : (
        <TaskTable rows={rows} today={today} emptyTitle="No tasks assigned to you" emptyDescription="Tasks assigned to you will appear here, or try clearing the filters." />
      )}
    </div>
  );
}
