import { redirect } from "next/navigation";

// "My tasks" is a filter on the Tasks page now; old links and bookmarks land there.
export default async function MyTasksRedirect({ searchParams }: { searchParams: Promise<{ overdue?: string }> }) {
  const sp = await searchParams;
  redirect(sp.overdue === "1" ? "/tasks?show=overdue" : "/tasks?show=mine");
}
