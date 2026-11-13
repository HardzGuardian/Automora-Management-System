import { and, eq, gt, isNull } from "drizzle-orm";
import { withTransaction, type Tx } from "@/db";
import {
  companies,
  companySettings,
  invitations,
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from "@/db/schema";
import { generateToken } from "@/lib/auth/token";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES, groupOf } from "@/lib/permissions";
import { seedDemoData } from "./seed-demo";

export type SeedOptions = { demo: boolean; adminEmail: string; appUrl: string };
export type SeedResult = {
  companyId: string;
  /** Raw invitation token; null when a valid invitation or a Super Admin already exists. */
  invitationToken: string | null;
  acceptUrl: string | null;
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Idempotent. Never creates a user or a password: the Super Admin is created by invitation. */
export async function runSeed(opts: SeedOptions): Promise<SeedResult> {
  return withTransaction(async (tx) => {
    const companyId = await ensureCompany(tx);
    await ensurePermissions(tx);
    const roleIds = await ensureSystemRoles(tx, companyId);
    const invitationToken = await ensureAdminInvitation(tx, companyId, roleIds["Super Admin"], opts.adminEmail);
    if (opts.demo) await seedDemoData(tx, companyId);
    return {
      companyId,
      invitationToken,
      acceptUrl: invitationToken ? `${opts.appUrl}/accept-invite?token=${invitationToken}` : null,
    };
  });
}

const SEED_MARKER = "system.seeded";

async function ensureCompany(tx: Tx): Promise<string> {
  // The seeded company is identified by an explicit marker, not by name or roles, so it
  // survives renames and is unambiguous in a database that holds other companies.
  const [existing] = await tx
    .select({ companyId: companySettings.companyId })
    .from(companySettings)
    .where(eq(companySettings.settingKey, SEED_MARKER))
    .limit(1);
  if (existing) return existing.companyId;
  const [c] = await tx
    .insert(companies)
    .values({ legalName: "Automora", displayName: "Automora" })
    .returning({ id: companies.id });
  await tx.insert(companySettings).values({ companyId: c.id, settingKey: SEED_MARKER, settingValueJson: true });
  return c.id;
}

async function ensurePermissions(tx: Tx): Promise<void> {
  await tx
    .insert(permissions)
    .values(ALL_PERMISSION_KEYS.map((key) => ({ key, groupName: groupOf(key) })))
    .onConflictDoNothing();
}

async function ensureSystemRoles(tx: Tx, companyId: string): Promise<Record<string, string>> {
  const permRows = await tx.select().from(permissions);
  const permId = new Map(permRows.map((p) => [p.key, p.id]));
  const ids: Record<string, string> = {};
  for (const [name, keys] of Object.entries(SYSTEM_ROLES)) {
    await tx
      .insert(roles)
      .values({ companyId, name, isSystem: true })
      .onConflictDoNothing({ target: [roles.companyId, roles.name] });
    const [role] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.companyId, companyId), eq(roles.name, name)));
    ids[name] = role.id;
    // Insert missing defaults only: admin customisations of an existing role are not wiped.
    await tx
      .insert(rolePermissions)
      .values(keys.map((k) => ({ roleId: role.id, companyId, permissionId: permId.get(k)! })))
      .onConflictDoNothing();
  }
  return ids;
}

async function ensureAdminInvitation(
  tx: Tx,
  companyId: string,
  superAdminRoleId: string,
  email: string,
): Promise<string | null> {
  const [hasAdmin] = await tx
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, superAdminRoleId))
    .limit(1);
  if (hasAdmin) return null;

  const [pending] = await tx
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.companyId, companyId),
        eq(invitations.roleId, superAdminRoleId),
        isNull(invitations.usedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (pending) return null;

  const { token, tokenHash } = generateToken();
  await tx.insert(invitations).values({
    companyId,
    email,
    roleId: superAdminRoleId,
    tokenHash,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return token;
}

export type ReissueResult = { status: "issued"; acceptUrl: string; revoked: number } | { status: "admin_exists" };

/**
 * Recovery for a first-admin link that was lost or expired. `runSeed` refuses to create a second
 * invitation while one is still valid, and the token is stored hashed so it cannot be shown again.
 * This revokes every pending Super Admin invitation and issues a fresh one. It never touches an
 * installation that already has a Super Admin (use the in-app invite or password reset instead).
 */
export async function reissueAdminInvitation(opts: { adminEmail: string; appUrl: string }): Promise<ReissueResult> {
  return withTransaction(async (tx) => {
    const companyId = await ensureCompany(tx);
    await ensurePermissions(tx);
    const roleIds = await ensureSystemRoles(tx, companyId);
    const roleId = roleIds["Super Admin"];

    const [hasAdmin] = await tx.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, roleId)).limit(1);
    if (hasAdmin) return { status: "admin_exists" as const };

    const revoked = await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.companyId, companyId), eq(invitations.roleId, roleId), isNull(invitations.usedAt), isNull(invitations.revokedAt)))
      .returning({ id: invitations.id });

    const { token, tokenHash } = generateToken();
    await tx.insert(invitations).values({
      companyId,
      email: opts.adminEmail,
      roleId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    return { status: "issued" as const, acceptUrl: `${opts.appUrl}/accept-invite?token=${token}`, revoked: revoked.length };
  });
}
