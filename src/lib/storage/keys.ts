import { randomUUID } from "node:crypto";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^${UUID}/${UUID}$`, "i");

/** Server-generated object key: "<companyId>/<random uuid>". Never contains a user-supplied name. */
export function newStorageKey(companyId: string): string {
  return `${companyId}/${randomUUID()}`;
}

export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
}
