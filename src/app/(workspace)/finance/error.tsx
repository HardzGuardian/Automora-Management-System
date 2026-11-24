"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

// A finance page failing must not take the rest of the app down; the money screens get their own message.
export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col gap-3">
      <ErrorState title="Finance could not be loaded" message="Nothing was changed. Try again in a moment." />
      <div>
        <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover">
          Try again
        </button>
      </div>
      {error.digest ? <p className="text-xs text-muted">Reference: {error.digest}</p> : null}
    </div>
  );
}
