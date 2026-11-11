import { boolean, foreignKey, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.id, t.companyId), unique().on(t.companyId, t.name)],
);

// Global catalogue (not tenant-owned), seeded from src/lib/permissions/catalog.ts
export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  groupName: text("group_name").notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull(),
    companyId: uuid("company_id").notNull(),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    foreignKey({ columns: [t.roleId, t.companyId], foreignColumns: [roles.id, roles.companyId] }),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    roleId: uuid("role_id").notNull(),
    companyId: uuid("company_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    foreignKey({ columns: [t.roleId, t.companyId], foreignColumns: [roles.id, roles.companyId] }),
  ],
);
