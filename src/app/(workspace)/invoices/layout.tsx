import type { ReactNode } from "react";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";

// A clean "no access" screen for people without this part of finance, instead of an error page.
export default async function InvoicesLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  if (!can(actor, "finance.invoices.read")) {
    return <p className="rounded-lg border border-border bg-surface p-5 text-muted">You do not have access to invoices.</p>;
  }
  return children;
}
