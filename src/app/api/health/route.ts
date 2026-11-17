import { checkDatabase } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for the load balancer and uptime monitor. Public, returns no data. */
export async function GET(): Promise<Response> {
  const ok = await checkDatabase();
  return Response.json({ status: ok ? "ok" : "unavailable" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
