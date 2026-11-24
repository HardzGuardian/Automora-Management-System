import { redirect } from "next/navigation";

// Old links like /reports/task-register land on the standalone Reports page with that report selected.
export default async function ReportRedirect({ params, searchParams }: { params: Promise<{ report: string }>; searchParams: Promise<{ preset?: string }> }) {
  const { report } = await params;
  const { preset } = await searchParams;
  const qs = new URLSearchParams({ report });
  if (preset && ["today", "week", "month", "quarter"].includes(preset)) qs.set("period", preset);
  redirect(`/reports?${qs.toString()}`);
}
