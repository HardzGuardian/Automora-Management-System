import Link from "next/link";
import { buttonClass } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">We can’t find that page</h1>
      <p className="text-sm text-muted">It may have been moved, or you may not have access to it.</p>
      <Link href="/dashboard" className={buttonClass("primary")}>
        Go to the dashboard
      </Link>
    </main>
  );
}
