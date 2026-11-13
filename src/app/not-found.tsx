import Link from "next/link";
import { buttonClass } from "@/components/ui/styles";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-3 p-6">
      <p className="text-sm font-medium text-muted">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We can’t find that page</h1>
      <p className="text-sm text-muted">It may have been moved, or you may not have access to it.</p>
      <div>
        <Link href="/dashboard" className={buttonClass("primary")}>
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
