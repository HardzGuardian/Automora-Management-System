import { requireActorForApi } from "@/lib/auth/api-actor";
import { logger } from "@/lib/logger";
import { listTasks } from "@/modules/tasks";

// Typeahead for the Tasks search box: GET /api/tasks/suggest?q=...&view=mine|all
// Uses the same query and permission scope as the Tasks list, so nobody sees a task they could not open.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireActorForApi();
  if (!auth.ok) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const headers = { "Cache-Control": "private, no-store" };
  if (q.length === 0) return Response.json({ items: [] }, { headers });

  try {
    const view = url.searchParams.get("view") === "mine" ? "mine" : "all";
    const { rows, total } = await listTasks(auth.actor, { view, search: q, pageSize: 8, sort: "due" });
    return Response.json(
      { total, items: rows.map((t) => ({ id: t.id, taskCode: t.taskCode, title: t.title, status: t.status, dueDate: t.dueDate })) },
      { headers },
    );
  } catch (e) {
    logger.error("task suggest failed", { err: e });
    return new Response("Internal error", { status: 500 });
  }
}
