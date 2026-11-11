import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, employees, invitations, user, userRoles } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { hashToken } from "@/lib/auth/token";
import {
  buildActor,
  createCompany,
  createEmployee,
  createUser,
  grantPermissions,
} from "@/test/factories";
import { loadActor } from "@/lib/auth/load-actor";
import {
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  resendInvitation,
  revokeInvitation,
} from "./invitations";

const PASSWORD = "a-long-enough-password";

async function setup() {
  const company = await createCompany();
  const adminUser = await createUser(company.id);
  const role = await grantPermissions(company.id, adminUser.id, ["users.invite"], "Inviter");
  const actor = await loadActor(adminUser.id);
  return { company, adminUser, role, actor };
}

const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;
const email = (n = "") => `new${n}-${Math.random().toString(36).slice(2, 8)}@test.local`;

describe("createInvitation", () => {
  it("requires users.invite", async () => {
    const { company, role } = await setup();
    const nobody = buildActor({ companyId: company.id });
    await expect(createInvitation(nobody, { email: email(), roleId: role.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stores only a hash of the token and audits", async () => {
    const { actor, role, company } = await setup();
    const { acceptUrl, invitationId } = await createInvitation(actor, { email: email(), roleId: role.id });
    const token = tokenOf(acceptUrl);
    const [row] = await db.select().from(invitations).where(eq(invitations.id, invitationId));
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, company.id));
    expect(logs.map((l) => l.action)).toContain("invitation.created");
  });

  it("rejects a role from another company as NOT_FOUND", async () => {
    const { actor } = await setup();
    const other = await setup();
    await expect(createInvitation(actor, { email: email(), roleId: other.role.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects an email that already has a user, and a second live invitation", async () => {
    const { actor, role, company } = await setup();
    const existing = await createUser(company.id, { email: "taken@test.local" });
    await expect(createInvitation(actor, { email: existing.email, roleId: role.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const e = email();
    await createInvitation(actor, { email: e, roleId: role.id });
    await expect(createInvitation(actor, { email: e.toUpperCase(), roleId: role.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("acceptInvitation", () => {
  it("creates an active user who can sign in, with the role and linked employee", async () => {
    const { actor, role, company } = await setup();
    const emp = await createEmployee(company.id);
    const e = email();
    const { acceptUrl } = await createInvitation(actor, { email: e, roleId: role.id, employeeId: emp.id });
    const { userId } = await acceptInvitation({ token: tokenOf(acceptUrl), name: "New Person", password: PASSWORD });

    const [u] = await db.select().from(user).where(eq(user.id, userId));
    expect(u).toMatchObject({ email: e.toLowerCase(), companyId: company.id, banned: false });
    expect(await db.select().from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)))).toHaveLength(1);
    const [linked] = await db.select().from(employees).where(eq(employees.id, emp.id));
    expect(linked.userId).toBe(userId);

    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": "10.50.0.1" },
        body: JSON.stringify({ email: e, password: PASSWORD }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("works without an employee record", async () => {
    const { actor, role } = await setup();
    const { acceptUrl } = await createInvitation(actor, { email: email(), roleId: role.id });
    await expect(acceptInvitation({ token: tokenOf(acceptUrl), name: "Solo", password: PASSWORD })).resolves.toHaveProperty("userId");
  });

  it("rejects a replayed token", async () => {
    const { actor, role } = await setup();
    const { acceptUrl } = await createInvitation(actor, { email: email(), roleId: role.id });
    const token = tokenOf(acceptUrl);
    await acceptInvitation({ token, name: "A", password: PASSWORD });
    await expect(acceptInvitation({ token, name: "B", password: PASSWORD })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an expired token", async () => {
    const { actor, role } = await setup();
    const { acceptUrl, invitationId } = await createInvitation(actor, { email: email(), roleId: role.id });
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, invitationId));
    await expect(acceptInvitation({ token: tokenOf(acceptUrl), name: "A", password: PASSWORD })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await getInvitationPreview(tokenOf(acceptUrl))).toBeNull();
  });

  it("rejects a revoked token and an unknown token", async () => {
    const { actor, role } = await setup();
    const { acceptUrl, invitationId } = await createInvitation(actor, { email: email(), roleId: role.id });
    await revokeInvitation(actor, invitationId);
    await expect(acceptInvitation({ token: tokenOf(acceptUrl), name: "A", password: PASSWORD })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(acceptInvitation({ token: "nope", name: "A", password: PASSWORD })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a weak password without consuming the invitation", async () => {
    const { actor, role } = await setup();
    const { acceptUrl } = await createInvitation(actor, { email: email(), roleId: role.id });
    await expect(acceptInvitation({ token: tokenOf(acceptUrl), name: "A", password: "short" })).rejects.toThrow();
    expect(await getInvitationPreview(tokenOf(acceptUrl))).not.toBeNull();
  });

  it("does not create a duplicate if the email became a user meanwhile", async () => {
    const { actor, role, company } = await setup();
    const e = email();
    const { acceptUrl } = await createInvitation(actor, { email: e, roleId: role.id });
    await createUser(company.id, { email: e.toLowerCase() });
    await expect(acceptInvitation({ token: tokenOf(acceptUrl), name: "A", password: PASSWORD })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("resend / revoke", () => {
  it("resend invalidates the old token and issues a new one", async () => {
    const { actor, role } = await setup();
    const first = await createInvitation(actor, { email: email(), roleId: role.id });
    const second = await resendInvitation(actor, first.invitationId);
    expect(tokenOf(second.acceptUrl)).not.toBe(tokenOf(first.acceptUrl));
    expect(await getInvitationPreview(tokenOf(first.acceptUrl))).toBeNull();
    expect(await getInvitationPreview(tokenOf(second.acceptUrl))).not.toBeNull();
  });

  it("another company's invitation is NOT_FOUND; a used one cannot be revoked", async () => {
    const a = await setup();
    const b = await setup();
    const inv = await createInvitation(a.actor, { email: email(), roleId: a.role.id });
    await expect(revokeInvitation(b.actor, inv.invitationId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(resendInvitation(b.actor, inv.invitationId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await acceptInvitation({ token: tokenOf(inv.acceptUrl), name: "A", password: PASSWORD });
    await expect(revokeInvitation(a.actor, inv.invitationId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires users.invite", async () => {
    const { company } = await setup();
    await expect(revokeInvitation(buildActor({ companyId: company.id }), "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
