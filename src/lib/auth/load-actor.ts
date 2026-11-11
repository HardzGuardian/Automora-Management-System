import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  employees,
  permissions,
  rolePermissions,
  roles,
  user,
  userRoles,
} from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { PermissionKey } from "@/lib/permissions/catalog";
import type { Actor } from "./actor";

/** Builds an Actor from the database. Rejects unknown and suspended users. */
export async function loadActor(userId: string): Promise<Actor> {
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw new DomainError("UNAUTHENTICATED", "Not signed in");

  const banActive = u.banned === true && (!u.banExpires || u.banExpires > new Date());
  if (banActive) throw new DomainError("FORBIDDEN", "This account is suspended");

  const [company] = await db
    .select({ timezone: companies.timezone })
    .from(companies)
    .where(eq(companies.id, u.companyId))
    .limit(1);
  if (!company) throw new DomainError("UNAUTHENTICATED", "Not signed in");

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.userId, u.id), eq(employees.companyId, u.companyId)))
    .limit(1);

  const rows = await db
    .select({ role: roles.name, key: permissions.key })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.companyId, userRoles.companyId)))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, u.id), eq(roles.companyId, u.companyId)));

  return {
    userId: u.id,
    companyId: u.companyId,
    employeeId: employee?.id ?? null,
    roles: [...new Set(rows.map((r) => r.role))],
    permissions: new Set(rows.flatMap((r) => (r.key ? [r.key as PermissionKey] : []))),
    timezone: company.timezone,
  };
}
