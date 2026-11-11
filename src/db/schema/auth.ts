import { boolean, foreignKey, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, tz, updatedAt } from "./_helpers";
import { companies } from "./company";
import { employees } from "./employees";
import { roles } from "./rbac";

// Better Auth tables (generated with its CLI, then adapted: tz-aware timestamps, company_id).
// A suspended user is `banned = true`.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastLoginAt: tz("last_login_at"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: tz("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: tz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tz("access_token_expires_at"),
    refreshTokenExpiresAt: tz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tz("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    email: text("email").notNull(),
    employeeId: uuid("employee_id"),
    roleId: uuid("role_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: tz("expires_at").notNull(),
    usedAt: tz("used_at"),
    revokedAt: tz("revoked_at"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.employeeId, t.companyId],
      foreignColumns: [employees.id, employees.companyId],
    }),
    foreignKey({
      columns: [t.roleId, t.companyId],
      foreignColumns: [roles.id, roles.companyId],
    }),
    index("invitations_email_idx").on(t.companyId, t.email),
  ],
);
