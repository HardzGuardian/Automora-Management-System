import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import {
  account,
  companies,
  employees,
  invitations,
  roles,
  user,
  userRoles,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { auth } from "@/lib/auth/auth";
import { generateToken, hashToken } from "@/lib/auth/token";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { inviteEmail } from "@/lib/email/templates";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  type AcceptInvitationInput,
  type CreateInvitationInput,
} from "./schemas";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID = "This invitation link is invalid or has expired";

const acceptUrlFor = (token: string) => `${env.APP_URL}/accept-invite?token=${token}`;

async function deliver(actorCompanyId: string, to: string, acceptUrl: string): Promise<void> {
  try {
    const [c] = await db.select({ name: companies.displayName }).from(companies).where(eq(companies.id, actorCompanyId));
    await sendEmail(inviteEmail(to, c?.name ?? "Automora", acceptUrl));
  } catch {
    // A mail failure never fails the invitation; the admin can resend or copy the link.
  }
}

export async function createInvitation(
  actor: Actor,
  input: CreateInvitationInput,
): Promise<{ invitationId: string; acceptUrl: string }> {
  requirePermission(actor, "users.invite");
  const data = createInvitationSchema.parse(input);

  const { invitationId, token } = await withTransaction(async (tx) => {
    const [role] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.id, data.roleId), eq(roles.companyId, actor.companyId)));
    if (!role) throw new DomainError("NOT_FOUND", "Role not found");

    if (data.employeeId) {
      const [emp] = await tx
        .select({ userId: employees.userId, status: employees.employmentStatus })
        .from(employees)
        .where(and(eq(employees.id, data.employeeId), eq(employees.companyId, actor.companyId)));
      if (!emp) throw new DomainError("NOT_FOUND", "Employee not found");
      if (emp.userId) throw new DomainError("CONFLICT", "This employee already has an account");
      if (emp.status !== "Active") throw new DomainError("VALIDATION", "Employee is not active");
    }

    const [existingUser] = await tx.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${data.email}`);
    if (existingUser) throw new DomainError("CONFLICT", "A user with this email already exists");

    const [live] = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.companyId, actor.companyId),
          sql`lower(${invitations.email}) = ${data.email}`,
          isNull(invitations.usedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      );
    if (live) throw new DomainError("CONFLICT", "A pending invitation already exists for this email");

    const t = generateToken();
    const [inv] = await tx
      .insert(invitations)
      .values({
        companyId: actor.companyId,
        email: data.email,
        roleId: data.roleId,
        employeeId: data.employeeId ?? null,
        tokenHash: t.tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdBy: actor.userId,
      })
      .returning({ id: invitations.id });
    await audit.record(tx, {
      actor,
      entity: "invitation",
      entityId: inv.id,
      action: "invitation.created",
      after: { email: data.email, roleId: data.roleId, employeeId: data.employeeId ?? null },
    });
    return { invitationId: inv.id, token: t.token };
  });

  const acceptUrl = acceptUrlFor(token);
  await deliver(actor.companyId, data.email, acceptUrl);
  return { invitationId, acceptUrl };
}

async function loadOwnPending(tx: Parameters<Parameters<typeof withTransaction>[0]>[0], actor: Actor, id: string) {
  const [inv] = await tx
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.companyId, actor.companyId)))
    .for("update");
  if (!inv) throw new DomainError("NOT_FOUND", "Invitation not found");
  if (inv.usedAt) throw new DomainError("CONFLICT", "This invitation has already been accepted");
  return inv;
}

export async function resendInvitation(
  actor: Actor,
  invitationId: string,
): Promise<{ invitationId: string; acceptUrl: string }> {
  requirePermission(actor, "users.invite");
  const { token, email } = await withTransaction(async (tx) => {
    const inv = await loadOwnPending(tx, actor, invitationId);
    const t = generateToken();
    await tx
      .update(invitations)
      .set({ tokenHash: t.tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS), revokedAt: null })
      .where(eq(invitations.id, inv.id));
    await audit.record(tx, { actor, entity: "invitation", entityId: inv.id, action: "invitation.resent" });
    return { token: t.token, email: inv.email };
  });
  const acceptUrl = acceptUrlFor(token);
  await deliver(actor.companyId, email, acceptUrl);
  return { invitationId, acceptUrl };
}

export async function revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
  requirePermission(actor, "users.invite");
  await withTransaction(async (tx) => {
    const inv = await loadOwnPending(tx, actor, invitationId);
    await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, inv.id));
    await audit.record(tx, { actor, entity: "invitation", entityId: inv.id, action: "invitation.revoked" });
  });
}

/** Public: shown on the accept-invite page. Null when unknown, used, revoked or expired. */
export async function getInvitationPreview(
  token: string,
): Promise<{ email: string; roleName: string; companyName: string } | null> {
  const [row] = await db
    .select({ email: invitations.email, roleName: roles.name, companyName: companies.displayName })
    .from(invitations)
    .innerJoin(roles, and(eq(roles.id, invitations.roleId), eq(roles.companyId, invitations.companyId)))
    .innerJoin(companies, eq(companies.id, invitations.companyId))
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.usedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/** Public: consumes a single-use invitation and activates the account in one transaction. */
export async function acceptInvitation(input: AcceptInvitationInput): Promise<{ userId: string }> {
  const data = acceptInvitationSchema.parse(input);
  const passwordHash = await (await auth.$context).password.hash(data.password);

  return withTransaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(data.token)))
      .for("update");
    if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt <= new Date()) {
      throw new DomainError("VALIDATION", INVALID);
    }

    const [dup] = await tx.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${inv.email.toLowerCase()}`);
    if (dup) throw new DomainError("CONFLICT", "An account with this email already exists");

    const [role] = await tx.select({ name: roles.name }).from(roles).where(eq(roles.id, inv.roleId));
    const userId = randomUUID();
    await tx.insert(user).values({
      id: userId,
      companyId: inv.companyId,
      name: data.name,
      email: inv.email.toLowerCase(),
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
    await tx.insert(userRoles).values({ userId, roleId: inv.roleId, companyId: inv.companyId });

    let employeeId: string | null = null;
    if (inv.employeeId) {
      const linked = await tx
        .update(employees)
        .set({ userId })
        .where(and(eq(employees.id, inv.employeeId), eq(employees.companyId, inv.companyId), isNull(employees.userId)))
        .returning({ id: employees.id });
      if (linked.length === 0) throw new DomainError("CONFLICT", "This employee already has an account");
      employeeId = inv.employeeId;
    }

    await tx.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.id, inv.id));
    await audit.record(tx, {
      actor: {
        userId,
        companyId: inv.companyId,
        employeeId,
        roles: [role?.name ?? ""],
        permissions: new Set(),
        timezone: "UTC",
      },
      entity: "user",
      entityId: userId,
      action: "invitation.accepted",
      after: { email: inv.email, invitationId: inv.id },
    });
    return { userId };
  });
}
