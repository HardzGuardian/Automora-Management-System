import { redirect } from "next/navigation";

// Reports are a section of the Finance tab now. Old links and bookmarks land on the same report.
export default async function ReportsRedirect({ searchParams }: { searchParams: Promise<{ report?: string; period?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ tab: "reports" });
  if (sp.report) qs.set("report", sp.report);
  if (sp.period) qs.set("period", sp.period);
  redirect(`/finance?${qs.toString()}`);
}
