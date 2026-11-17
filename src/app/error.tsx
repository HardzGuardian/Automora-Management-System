"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/styles";

// Route-level error boundary. The message is intentionally generic: details stay in the server log.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted">Your data has not been lost. Try again, or go back to the dashboard.</p>
      {error.digest ? <p className="text-xs text-muted">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          Try again
        </button>
        <Link href="/dashboard" className={buttonClass("secondary")}>
          Dashboard
        </Link>
      </div>
    </main>
  );
}
