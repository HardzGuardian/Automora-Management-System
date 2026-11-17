import "server-only";
import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { getActor, type Actor } from "./actor";

/** For pages and actions: returns the Actor or sends the visitor to /login. */
export async function requireActor(): Promise<Actor> {
  try {
    return await getActor();
  } catch (e) {
    if (e instanceof DomainError && (e.code === "UNAUTHENTICATED" || e.code === "FORBIDDEN")) {
      redirect("/login");
    }
    throw e;
  }
}
