import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, withTransaction } from "@/db";
import { account, activityLogs, employees, invitations, roles, session, taskAssignees, user, userRoles } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { loadActor } from "@/lib/auth/load-actor";
import {
  createCompany,
  createEmployee,
  createTask,
  createUser,
  grantPermissions,
} from "@/test/factories";
import { acceptInvitation, createInvitation, resendInvitation } from "@/modules/auth";
import {
  assertAssignable,
  deactivateEmployee,
  reactivateEmployee,
  suspendEmployee,
} from "./lifecycle";

const PASSWORD = "lifecycle-password-1";
let ip = 0;
const signIn = (email: string) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `10.70.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}` },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );

async function world(adminKeys: Parameters<typeof grantPermissions>[2] = ["employees.deactivate", "users.suspend"]) {
  const company = await createCompany();
  const adminUser = await createUser(company.id);
  const adminEmp = await createEmployee(company.id, { userId: adminUser.id });
  await grantPermissions(company.id, adminUser.id, adminKeys, "Admin");
  const actor = await loadActor(adminUser.id);

  const email = `${randomUUID()}@test.local`;
  const staffUser = await createUser(company.id, { email });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: staffUser.id,
    providerId: "credential",
    userId: staffUser.id,
    password: await (await auth.$context).password.hash(PASSWORD),
  });
  const staff = await createEmployee(company.id, { userId: staffUser.id });
  return { company, actor, adminEmp, staff, staffUser, email };
}

describe("deactivate / reactivate", () => {
  it("deactivates: status, ban, sessions revoked, cannot sign in, history kept", async () => {
    const w = await world();
    expect((await signIn(w.email)).status).toBe(200);
    expect(await db.select().from(session).where(eq(session.userId, w.staffUser.id))).toHaveLength(1);
    const task = await createTask(w.company.id);
    await db.insert(taskAssignees).values({ taskId: task.id, companyId: w.company.id, employeeId: w.staff.id });

    const dto = await deactivateEmployee(w.actor, w.staff.id, { reason: "Left the company" });
    expect(dto.employmentStatus).toBe("Inactive");
    const [u] = await db.select().from(user).where(eq(user.id, w.staffUser.id));
    expect(u.banned).toBe(true);
    expect(await db.select().from(session).where(eq(session.userId, w.staffUser.id))).toHaveLength(0);
    expect((await signIn(w.email)).status).toBe(403);
    // history and assignments retained
    expect(await db.select().from(taskAssignees).where(eq(taskAssignees.employeeId, w.staff.id))).toHaveLength(1);
    expect(await db.select().from(employees).where(eq(employees.id, w.staff.id))).toHaveLength(1);
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, w.staff.id));
    expect(logs.map((l) => l.action)).toContain("employee.deactivated");
  });

  it("reactivates: sign-in works again", async () => {
    const w = await world();
    await deactivateEmployee(w.actor, w.staff.id, {});
    const dto = await reactivateEmployee(w.actor, w.staff.id);
    expect(dto.employmentStatus).toBe("Active");
    expect((await signIn(w.email)).status).toBe(200);
  });

  it("works for an employee without an account (status only)", async () => {
    const w = await world();
    const noAccount = await createEmployee(w.company.id);
    expect((await deactivateEmployee(w.actor, noAccount.id, {})).employmentStatus).toBe("Inactive");
  });

  it("refuses to deactivate yourself", async () => {
    const w = await world();
    await expect(deactivateEmployee(w.actor, w.adminEmp.id, {})).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("is a conflict to deactivate someone already inactive", async () => {
    const w = await world();
    await deactivateEmployee(w.actor, w.staff.id, {});
    await expect(deactivateEmployee(w.actor, w.staff.id, {})).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires employees.deactivate", async () => {
    const w = await world(["users.suspend"]);
    await expect(deactivateEmployee(w.actor, w.staff.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reactivateEmployee(w.actor, w.staff.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("treats another company's employee as NOT_FOUND", async () => {
    const w = await world();
    const other = await world();
    await expect(deactivateEmployee(w.actor, other.staff.id, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reactivateEmployee(w.actor, other.staff.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("will not lock out the last Super Admin", async () => {
    const w = await world();
    const [sys] = await db.insert(roles).values({ companyId: w.company.id, name: "Super Admin", isSystem: true }).returning();
    await db.insert(userRoles).values({ userId: w.staffUser.id, roleId: sys.id, companyId: w.company.id });
    await expect(deactivateEmployee(w.actor, w.staff.id, {})).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("suspend", () => {
  it("suspends with the same account effects and needs users.suspend", async () => {
    const w = await world();
    const dto = await suspendEmployee(w.actor, w.staff.id, { reason: "Investigation" });
    expect(dto.employmentStatus).toBe("Suspended");
    expect((await signIn(w.email)).status).toBe(403);

    const w2 = await world(["employees.deactivate"]);
    await expect(suspendEmployee(w2.actor, w2.staff.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reactivating a suspended employee also needs users.suspend", async () => {
    const w = await world();
    await suspendEmployee(w.actor, w.staff.id, {});
    const limited = await world(["employees.deactivate"]);
    await db.update(employees).set({ employmentStatus: "Suspended" }).where(eq(employees.id, limited.staff.id));
    await expect(reactivateEmployee(limited.actor, limited.staff.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reactivateEmployee(w.actor, w.staff.id)).resolves.toMatchObject({ employmentStatus: "Active" });
  });
});

describe("assertAssignable", () => {
  it("accepts active employees only, within the company", async () => {
    const w = await world();
    const inactive = await createEmployee(w.company.id, { employmentStatus: "Inactive" });
    const suspended = await createEmployee(w.company.id, { employmentStatus: "Suspended" });
    const foreign = await createEmployee((await createCompany()).id);
    await expect(withTransaction((tx) => assertAssignable(tx, w.company.id, w.staff.id))).resolves.toBeUndefined();
    await expect(withTransaction((tx) => assertAssignable(tx, w.company.id, inactive.id))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(withTransaction((tx) => assertAssignable(tx, w.company.id, suspended.id))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(withTransaction((tx) => assertAssignable(tx, w.company.id, foreign.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("pending invitations", () => {
  it("deactivating an employee revokes their open invitation so it can no longer be accepted", async () => {
    const w = await world(["employees.deactivate", "users.suspend", "users.invite"]);
    const pending = await createEmployee(w.company.id);
    const [role] = await db.select().from(roles).where(eq(roles.companyId, w.company.id));
    const inv = await createInvitation(w.actor, {
      email: `${randomUUID()}@test.local`,
      roleId: role.id,
      employeeId: pending.id,
    });
    const token = new URL(inv.acceptUrl).searchParams.get("token")!;

    await deactivateEmployee(w.actor, pending.id, {});

    const [row] = await db.select().from(invitations).where(eq(invitations.id, inv.invitationId));
    expect(row.revokedAt).not.toBeNull();
    await expect(acceptInvitation({ token, name: "Late", password: "a-long-enough-password" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("refuses to accept or resend an invitation whose employee is no longer active", async () => {
    const w = await world(["employees.deactivate", "users.suspend", "users.invite"]);
    const pending = await createEmployee(w.company.id);
    const [role] = await db.select().from(roles).where(eq(roles.companyId, w.company.id));
    const inv = await createInvitation(w.actor, {
      email: `${randomUUID()}@test.local`,
      roleId: role.id,
      employeeId: pending.id,
    });
    const token = new URL(inv.acceptUrl).searchParams.get("token")!;
    // Bypass lock() to simulate any path that leaves the invite open.
    await db.update(employees).set({ employmentStatus: "Suspended" }).where(eq(employees.id, pending.id));

    await expect(acceptInvitation({ token, name: "Late", password: "a-long-enough-password" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(resendInvitation(w.actor, inv.invitationId)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
