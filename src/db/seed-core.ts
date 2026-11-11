import { and, eq, gt, isNull } from "drizzle-orm";
import { withTransaction, type Tx } from "@/db";
import {
  companies,
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

async function ensureCompany(tx: Tx): Promise<string> {
  // The seeded company is the one that owns the "Super Admin" system role.
  const [existing] = await tx
    .select({ companyId: roles.companyId })
    .from(roles)
    .where(and(eq(roles.name, "Super Admin"), eq(roles.isSystem, true)))
    .limit(1);
  if (existing) return existing.companyId;
  const [c] = await tx
    .insert(companies)
    .values({ legalName: "Automora", displayName: "Automora" })
    .returning({ id: companies.id });
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

