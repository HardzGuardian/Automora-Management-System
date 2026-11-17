import { check, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, inList } from "./_helpers";

export const SECURITY_EVENT_TYPES = ["login_failed", "login_blocked", "permission_denied", "job_failed"] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/**
 * Things an administrator should notice (blueprint 10.3): failed and blocked sign-ins, denied
 * permissions and failed scheduled jobs. Append-only. company_id and actor_id are plain values
 * (no foreign keys): an attempt against an unknown email has no company, and this log must keep
 * accepting rows whatever else happens. Never put passwords, tokens or stack traces in `detail`.
 */
export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id"),
    type: text("type").notNull(),
    actorId: text("actor_id"),
    /** What the event was about: the email tried, the permission key, the job name. */
    subject: text("subject"),
    ip: text("ip"),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [
    check("security_events_type_chk", inList("type", SECURITY_EVENT_TYPES)),
    index("security_events_created_idx").on(t.createdAt),
    index("security_events_company_idx").on(t.companyId, t.createdAt),
    index("security_events_type_idx").on(t.type, t.createdAt),
  ],
);
