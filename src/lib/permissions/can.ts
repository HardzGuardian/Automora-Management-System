import type { Actor } from "@/lib/auth/actor";
import type { PermissionKey } from "./catalog";

export function can(actor: Actor, key: PermissionKey): boolean {
  return actor.permissions.has(key);
}
