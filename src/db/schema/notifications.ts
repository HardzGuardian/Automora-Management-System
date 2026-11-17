import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: tz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ],
);

// One row per (event_key, user): re-running a job or retrying a request never duplicates a notification.
export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    eventKey: text("event_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.eventKey, t.userId)],
);
