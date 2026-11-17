import type { Actor } from "@/lib/auth/actor";

/**
 * Lets the monitoring module hear about denied permission checks without lib depending on a module
 * (the same pattern as the notifier). Registered once at server start; unit tests leave it unset.
 *
 * Held on globalThis because Next.js bundles instrumentation.ts separately from the pages: a plain
 * module variable set there would not be the one the permission check reads.
 */
type DenialReporter = (actor: Actor, permission: string) => void;
const holder = globalThis as unknown as { __automoraDenialReporter?: DenialReporter };

export function registerDenialReporter(r: DenialReporter | undefined): void {
  holder.__automoraDenialReporter = r;
}

/** Never throws: reporting must not change the outcome of a permission check. */
export function reportDenial(actor: Actor, permission: string): void {
  try {
    holder.__automoraDenialReporter?.(actor, permission);
  } catch {
    // monitoring problems must not affect authorisation
  }
}
