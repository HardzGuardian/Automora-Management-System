import "server-only";
import { DomainError } from "@/lib/errors";
import { getActor, type Actor } from "./actor";

/** For Route Handlers: an Actor or a plain "not authenticated" result (no redirects). */
export async function requireActorForApi(): Promise<{ ok: true; actor: Actor } | { ok: false }> {
  try {
    return { ok: true, actor: await getActor() };
  } catch (e) {
    if (e instanceof DomainError && (e.code === "UNAUTHENTICATED" || e.code === "FORBIDDEN")) return { ok: false };
    throw e;
  }
}
