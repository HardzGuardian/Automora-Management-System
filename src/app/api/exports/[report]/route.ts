import { requireActorForApi } from "@/lib/auth/api-actor";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { REPORT_KEYS, exportFinanceReportResponse, exportReport, type ReportFilters, type ReportKey } from "@/modules/reports";

const FINANCE_REPORTS = ["receivables", "expense-register", "cash-movement", "summary"] as const;

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : undefined);

function statusFor(e: DomainError): number {
  if (e.code === "FORBIDDEN") return 403;
  if (e.code === "VALIDATION") return 400;
  if (e.code.endsWith("NOT_FOUND")) return 404;
  return 409;
}

// GET /api/exports/<report>?format=csv|xlsx|pdf&…same filters as the on-screen report
// Finance: /api/exports/finance-<receivables|expense-register|cash-movement|summary>?format=csv|xlsx&fromDate=…&toDate=…
export async function GET(request: Request, ctx: { params: Promise<{ report: string }> }): Promise<Response> {
  const auth = await requireActorForApi();
  if (!auth.ok) return new Response("Unauthorized", { status: 401 });
  const { report } = await ctx.params;
  const q = new URL(request.url).searchParams;
  const format = q.get("format") ?? "csv";

  try {
    if (report.startsWith("finance-")) {
      const name = report.slice("finance-".length);
      if (!(FINANCE_REPORTS as readonly string[]).includes(name)) return new Response("Not found", { status: 404 });
      return await exportFinanceReportResponse(auth.actor, {
        report: name as (typeof FINANCE_REPORTS)[number],
        format: format === "xlsx" ? "xlsx" : "csv",
        fromDate: q.get("fromDate") ?? "",
        toDate: q.get("toDate") ?? "",
      });
    }
    if (!(REPORT_KEYS as string[]).includes(report)) return new Response("Not found", { status: 404 });
    const filters: ReportFilters = {
      preset: (q.get("preset") as ReportFilters["preset"]) ?? undefined,
      from: q.get("from") ?? undefined,
      to: q.get("to") ?? undefined,
      status: list(q.get("status")) as ReportFilters["status"],
      priority: list(q.get("priority")) as ReportFilters["priority"],
      clientId: q.get("clientId") ?? undefined,
      projectId: q.get("projectId") ?? undefined,
      assigneeId: q.get("assigneeId") ?? undefined,
    };
    return await exportReport(auth.actor, report as ReportKey, format, filters);
  } catch (e) {
    if (e instanceof DomainError) {
      return Response.json({ error: { code: e.code, message: e.message } }, { status: statusFor(e) });
    }
    if (e instanceof Error && e.name === "ZodError") return Response.json({ error: { code: "VALIDATION", message: "Invalid filters" } }, { status: 400 });
    logger.error("export failed", { report, format, err: e });
    return Response.json({ error: { code: "INTERNAL", message: "Export failed" } }, { status: 500 });
  }
}
