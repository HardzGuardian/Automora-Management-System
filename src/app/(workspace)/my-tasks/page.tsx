import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { allowedTransitions, isOwnTransitionAllowed, listTasks } from "@/modules/tasks";
import { BoardDnd } from "../tasks/_components/board-dnd";
import { TaskFilters } from "../tasks/_components/task-filters";
import { TaskTable } from "../tasks/_components/task-table";

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
    <main className="flex flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">My tasks ({total})</h1>
        <nav className="flex gap-3 text-sm" aria-label="Layout">
          <Link href={{ query: { ...sp, layout: "list" } }} className={layout === "list" ? "font-semibold underline" : "underline"}>
            List
          </Link>
          <Link href={{ query: { ...sp, layout: "board" } }} className={layout === "board" ? "font-semibold underline" : "underline"}>
            Board
          </Link>
          <Link href={{ pathname: "/tasks/calendar", query: { view: "mine" } }} className="underline">
            Calendar
          </Link>
        </nav>
      </div>
      <TaskFilters q={sp.q} status={status} priority={priority} overdue={sp.overdue === "1"} extra={<input type="hidden" name="layout" value={layout} />} />
      {layout === "board" ? <BoardDnd tasks={boardTasks} /> : <TaskTable rows={rows} today={today} />}
    </main>
  );
}
