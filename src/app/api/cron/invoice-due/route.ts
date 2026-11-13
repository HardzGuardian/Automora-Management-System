import { isCronAuthorized } from "@/lib/cron/auth";
import { runReminders } from "@/modules/notifications";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const result = await runReminders({ sections: ["invoices"] });
  if (result.failures.length > 0) console.error("invoice reminder failures", JSON.stringify(result.failures));
  return Response.json(result, { status: result.failures.length > 0 ? 207 : 200, headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
