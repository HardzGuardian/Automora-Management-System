import { check, foreignKey, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, inList, tz, updatedAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const CLIENT_STATUSES = ["Active", "Inactive"] as const;

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    clientCode: text("client_code").notNull(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    serviceType: text("service_type"),
    status: text("status").notNull().default("Active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    unique().on(t.id, t.companyId),
    unique().on(t.companyId, t.clientCode),
    check("clients_status_chk", inList("status", CLIENT_STATUSES)),
    index("clients_company_status_idx").on(t.companyId, t.status),
  ],
);

export const clientNotes = pgTable(
  "client_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    clientId: uuid("client_id").notNull(),
    note: text("note").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.clientId, t.companyId],
      foreignColumns: [clients.id, clients.companyId],
    }),
    index("client_notes_client_idx").on(t.clientId),
  ],
);
