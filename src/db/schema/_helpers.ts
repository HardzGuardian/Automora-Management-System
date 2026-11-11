import { sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

export const tz = (name: string) => timestamp(name, { withTimezone: true });
export const createdAt = () => tz("created_at").defaultNow().notNull();
export const updatedAt = () =>
  tz("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const inList = (col: string, values: readonly string[]) =>
  sql.raw(`${col} IN (${values.map((v) => `'${v}'`).join(", ")})`);
