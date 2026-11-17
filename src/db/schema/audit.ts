import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    actorId: text("actor_id").references(() => user.id),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_logs_entity_idx").on(t.companyId, t.entity, t.entityId),
    index("activity_logs_created_idx").on(t.companyId, t.createdAt),
  ],
);
