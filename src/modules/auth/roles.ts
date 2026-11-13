import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction, type Tx } from "@/db";
import { permissions, rolePermissions, roles, user, userRoles } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import {
  ALL_PERMISSION_KEYS,
  groupOf,
  requirePermission,
  type PermissionKey,
} from "@/lib/permissions";
import { audit } from "@/modules/audit";

export type RoleDTO = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionKey[];
};

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
});

const SUPER_ADMIN = "Super Admin";

async function keysFor(db_: Pick<Tx, "select">, roleId: string): Promise<PermissionKey[]> {
  const rows = await db_
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.key as PermissionKey).sort();
}

async function loadRole(tx: Tx, actor: Actor, roleId: string) {
  const [role] = await tx
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.companyId, actor.companyId)))
    .for("update");
  if (!role) throw new DomainError("NOT_FOUND", "Role not found");
  return role;
}

const isSuperAdmin = (r: { name: string; isSystem: boolean }) => r.isSystem && r.name === SUPER_ADMIN;

const holdsAll = (actor: Actor, keys: readonly string[]) => keys.every((k) => actor.permissions.has(k as PermissionKey));

/** An actor may only hand out a role whose permissions they all hold themselves (Super Admin included). */
export async function assertCanGrantRole(
  tx: Pick<Tx, "select">,
  actor: Actor,
  role: { id: string; name: string; isSystem: boolean },
): Promise<void> {
  const keys = await keysFor(tx, role.id);
  const missing = !holdsAll(actor, keys);
  const lacksSuperAdmin = isSuperAdmin(role) && !holdsAll(actor, ALL_PERMISSION_KEYS);
  if (missing || lacksSuperAdmin) {
    throw new DomainError("FORBIDDEN", "You cannot grant a role with permissions you do not hold");
  }
}

export async function listRoles(actor: Actor): Promise<RoleDTO[]> {
  requirePermission(actor, "roles.read");
  const rows = await db.select().from(roles).where(eq(roles.companyId, actor.companyId)).orderBy(roles.name);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: await keysFor(db, r.id),
    })),
  );
}

export async function createRole(
  actor: Actor,
  input: { name: string; description?: string },
): Promise<RoleDTO> {
  requirePermission(actor, "roles.manage");
  const data = createRoleSchema.parse(input);
  return withTransaction(async (tx) => {
    const [dup] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.companyId, actor.companyId), eq(roles.name, data.name)));
    if (dup) throw new DomainError("CONFLICT", "A role with this name already exists");
    const [role] = await tx
      .insert(roles)
      .values({ companyId: actor.companyId, name: data.name, description: data.description ?? null })
      .returning();
    await audit.record(tx, { actor, entity: "role", entityId: role.id, action: "role.created", after: { name: role.name } });
    return { id: role.id, name: role.name, description: role.description, isSystem: false, permissions: [] };
  });
}

export async function setRolePermissions(
  actor: Actor,
  roleId: string,
  keys: readonly PermissionKey[],
): Promise<void> {
  requirePermission(actor, "roles.manage");
  const unique = [...new Set(keys)];
  const known = new Set<string>(ALL_PERMISSION_KEYS);
  const bad = unique.filter((k) => !known.has(k));
  if (bad.length > 0) throw new DomainError("VALIDATION", `Unknown permissions: ${bad.join(", ")}`);

  await withTransaction(async (tx) => {
    const role = await loadRole(tx, actor, roleId);
    if (isSuperAdmin(role)) throw new DomainError("CONFLICT", "The Super Admin role cannot be edited");
    if (!holdsAll(actor, unique)) {
      throw new DomainError("FORBIDDEN", "You cannot grant permissions you do not hold");
    }
    const [held] = await tx
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, actor.userId), eq(userRoles.roleId, role.id)));
    if (held) throw new DomainError("FORBIDDEN", "You cannot edit a role you hold yourself");
    const before = await keysFor(tx, role.id);

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (unique.length > 0) {
      await tx
        .insert(permissions)
        .values(unique.map((key) => ({ key, groupName: groupOf(key) })))
        .onConflictDoNothing();
      const rows = await tx.select({ id: permissions.id }).from(permissions).where(inArray(permissions.key, unique));
      await tx
        .insert(rolePermissions)
        .values(rows.map((p) => ({ roleId: role.id, companyId: actor.companyId, permissionId: p.id })));
    }
    await audit.record(tx, {
      actor,
      entity: "role",
      entityId: role.id,
      action: "role.permissions_changed",
      before: { permissions: before },
      after: { permissions: [...unique].sort() },
    });
  });
}

async function loadTargetUser(tx: Tx, actor: Actor, userId: string) {
  const [u] = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.companyId, actor.companyId)));
  if (!u) throw new DomainError("NOT_FOUND", "User not found");
}

export async function assignRole(actor: Actor, userId: string, roleId: string): Promise<void> {
  requirePermission(actor, "roles.manage");
  await withTransaction(async (tx) => {
    const role = await loadRole(tx, actor, roleId);
    await loadTargetUser(tx, actor, userId);
    await assertCanGrantRole(tx, actor, role);
    await tx
      .insert(userRoles)
      .values({ userId, roleId: role.id, companyId: actor.companyId })
      .onConflictDoNothing();
    await audit.record(tx, {
      actor,
      entity: "user",
      entityId: userId,
      action: "role.assigned",
      after: { roleId: role.id, role: role.name },
    });
  });
}

export async function removeRole(actor: Actor, userId: string, roleId: string): Promise<void> {
  requirePermission(actor, "roles.manage");
  await withTransaction(async (tx) => {
    const role = await loadRole(tx, actor, roleId);
    await loadTargetUser(tx, actor, userId);
    if (isSuperAdmin(role)) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(userRoles)
        .where(eq(userRoles.roleId, role.id));
      if (n <= 1) throw new DomainError("CONFLICT", "At least one Super Admin must remain");
    }
    await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));
    await audit.record(tx, {
      actor,
      entity: "user",
      entityId: userId,
      action: "role.removed",
      before: { roleId: role.id, role: role.name },
    });
  });
}
