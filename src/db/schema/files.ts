import { bigint, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.id, t.companyId)],
);
