import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Cron endpoints accept only `Authorization: Bearer <CRON_SECRET>`. An unset secret disables them. */
export function isCronAuthorized(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
