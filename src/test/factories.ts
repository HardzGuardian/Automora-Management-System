import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { inArray } from "drizzle-orm";
import {
  clients,
  companies,
  employees,
  permissions,
  projects,
  rolePermissions,
  roles,
  tasks,
  user,
  userRoles,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { groupOf, type PermissionKey } from "@/lib/permissions/catalog";

type Overrides<T> = Partial<T>;

export async function createCompany(o: Overrides<typeof companies.$inferInsert> = {}) {
  const [row] = await db
    .insert(companies)
    .values({ legalName: "Test Co Pvt Ltd", displayName: "Test Co", ...o })
    .returning();
  return row;
}

export async function createUser(
  companyId: string,
  o: Overrides<typeof user.$inferInsert> = {},
) {
  const id = o.id ?? randomUUID();
  const [row] = await db
    .insert(user)
    .values({ id, companyId, name: "User " + id.slice(0, 6), email: `${id}@test.local`, ...o })
    .returning();
  return row;
}

export async function createEmployee(
  companyId: string,
  o: Overrides<typeof employees.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(employees)
    .values({
      companyId,
      employeeCode: `EMP-${n}`,
      fullName: `Employee ${n}`,
      workEmail: `${n}@test.local`,
      ...o,
    })
    .returning();
  return row;
}

export async function createClient(
  companyId: string,
  o: Overrides<typeof clients.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(clients)
    .values({ companyId, clientCode: `CLI-${n}`, name: `Client ${n}`, ...o })
    .returning();
  return row;
}

export async function createProject(
  companyId: string,
  ownerEmployeeId: string,
  o: Overrides<typeof projects.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(projects)
    .values({
      companyId,
      ownerEmployeeId,
      projectCode: `PRJ-${n}`,
      name: `Project ${n}`,
      type: "Internal",
      ...o,
    })
    .returning();
  return row;
}

export async function createTask(
  companyId: string,
  o: Overrides<typeof tasks.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(tasks)
    .values({ companyId, taskCode: `TSK-${n}`, title: `Task ${n}`, ...o })
    .returning();
  return row;
}

export async function grantPermissions(
  companyId: string,
  userId: string,
  keys: readonly PermissionKey[],
  roleName = `Role ${randomUUID().slice(0, 6)}`,
) {
  const [role] = await db.insert(roles).values({ companyId, name: roleName }).returning();
  if (keys.length > 0) {
    await db
      .insert(permissions)
      .values(keys.map((key) => ({ key, groupName: groupOf(key) })))
      .onConflictDoNothing();
    const rows = await db.select().from(permissions).where(inArray(permissions.key, [...keys]));
    await db
      .insert(rolePermissions)
      .values(rows.map((p) => ({ roleId: role.id, companyId, permissionId: p.id })));
  }
  await db.insert(userRoles).values({ userId, roleId: role.id, companyId });
  return role;
}

export function buildActor(o: Partial<Actor> & Pick<Actor, "companyId">): Actor {
  return {
    userId: o.userId ?? randomUUID(),
    companyId: o.companyId,
    employeeId: o.employeeId ?? null,
    roles: o.roles ?? [],
    permissions: o.permissions ?? new Set(),
    timezone: o.timezone ?? "Asia/Kolkata",
  };
}
