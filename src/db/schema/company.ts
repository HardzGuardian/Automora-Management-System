import { integer, jsonb, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_helpers";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  currency: text("currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const companySettings = pgTable(
  "company_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    settingKey: text("setting_key").notNull(),
    settingValueJson: jsonb("setting_value_json").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.companyId, t.settingKey)],
);

export const CODE_KINDS = ["TSK", "PRJ", "CLI", "EMP", "INV", "EXP"] as const;
export type CodeKind = (typeof CODE_KINDS)[number];

export const codeSequences = pgTable(
  "code_sequences",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    kind: text("kind").notNull(),
    nextValue: integer("next_value").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.kind] })],
);
