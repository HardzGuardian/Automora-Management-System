import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import type { PermissionKey } from "./catalog";
import { can } from "./can";
import { reportDenial } from "./denied";

export function requirePermission(actor: Actor, key: PermissionKey): void {
  if (!can(actor, key)) {
    reportDenial(actor, key);
    throw new DomainError("FORBIDDEN", "You do not have permission to do this");
  }
}
