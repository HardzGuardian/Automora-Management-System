import { redirect } from "next/navigation";

// Reports are one page now, with a pill per report. Old links and bookmarks land on the same report.
export default async function ReportRedirect({ params, searchParams }: { params: Promise<{ report: string }>; searchParams: Promise<{ preset?: string }> }) {
  const { report } = await params;
  const { preset } = await searchParams;
  const qs = new URLSearchParams({ report });
  if (preset && ["today", "week", "month", "quarter"].includes(preset)) qs.set("period", preset);
  redirect(`/reports?${qs.toString()}`);
}
