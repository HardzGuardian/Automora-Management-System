"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

// Error boundary inside the shell: the sidebar and header stay usable when one page fails.
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState title="This page could not be loaded" message={error.digest ? `Please try again. Reference: ${error.digest}` : "Please try again."} onRetry={reset} />;
}
