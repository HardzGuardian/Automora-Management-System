import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  clients,
  companies,
  employees,
  invitations,
  permissions,
  rolePermissions,
  roles,
  tasks,
  user,
  userRoles,
} from "@/db/schema";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES } from "@/lib/permissions";
import { reissueAdminInvitation, runSeed, type SeedResult } from "./seed-core";

const ADMIN = "admin@seed.test";
let first: SeedResult;

async function keysOf(roleName: string, companyId: string): Promise<string[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(roles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(roles.companyId, companyId), eq(roles.name, roleName)));
  return rows.map((r) => r.key).sort();
}

describe("runSeed (no demo)", () => {
  beforeAll(async () => {
    // Test DB is shared; this file seeds the single company it owns.
    first = await runSeed({ demo: false, adminEmail: ADMIN, appUrl: "http://localhost:3000" });
  });

  it("creates the company, all permissions and the three system roles", async () => {
    const [c] = await db.select().from(companies).where(eq(companies.id, first.companyId));
    expect(c.timezone).toBe("Asia/Kolkata");
    const perms = await db.select().from(permissions);
    expect(perms.length).toBeGreaterThanOrEqual(ALL_PERMISSION_KEYS.length);
    const r = await db.select().from(roles).where(eq(roles.companyId, first.companyId));
    expect(r.map((x) => x.name).sort()).toEqual(["Employee", "Manager", "Super Admin"]);
    expect(r.every((x) => x.isSystem)).toBe(true);
  });

  it("gives Super Admin every key and Employee exactly its five keys", async () => {
    expect(await keysOf("Super Admin", first.companyId)).toEqual([...ALL_PERMISSION_KEYS].sort());
    expect(await keysOf("Employee", first.companyId)).toEqual([...SYSTEM_ROLES.Employee].sort());
    expect(await keysOf("Manager", first.companyId)).toEqual([...SYSTEM_ROLES.Manager].sort());
  });

  it("creates no user, only a hashed Super Admin invitation", async () => {
    const users = await db.select().from(user).where(eq(user.companyId, first.companyId));
    expect(users).toHaveLength(0);
    expect(first.invitationToken).toBeTruthy();
    const [inv] = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
    expect(inv.email).toBe(ADMIN);
    expect(inv.tokenHash).not.toBe(first.invitationToken);
    expect(inv.tokenHash).toBe(createHash("sha256").update(first.invitationToken!).digest("hex"));
    expect(inv.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    expect(inv.usedAt).toBeNull();
  });

  it("is idempotent: a second run adds no duplicates", async () => {
    const second = await runSeed({ demo: false, adminEmail: ADMIN, appUrl: "http://localhost:3000" });
    expect(second.companyId).toBe(first.companyId);
    expect(second.invitationToken).toBeNull();
    expect(await db.select().from(invitations).where(eq(invitations.companyId, first.companyId))).toHaveLength(1);
    expect(await db.select().from(roles).where(eq(roles.companyId, first.companyId))).toHaveLength(3);
  });

  it("creates no demo data unless demo is true", async () => {
    expect(await db.select().from(employees).where(eq(employees.companyId, first.companyId))).toHaveLength(0);
  });
});

describe("runSeed (demo)", () => {
  it("adds labelled demo data once", async () => {
    await runSeed({ demo: true, adminEmail: ADMIN, appUrl: "http://localhost:3000" });
    await runSeed({ demo: true, adminEmail: ADMIN, appUrl: "http://localhost:3000" });
    const cl = await db.select().from(clients).where(eq(clients.companyId, first.companyId));
    expect(cl.length).toBe(2);
    expect(cl.every((c) => c.name.startsWith("[DEMO]"))).toBe(true);
    expect((await db.select().from(employees).where(eq(employees.companyId, first.companyId))).length).toBe(3);
    expect((await db.select().from(tasks).where(eq(tasks.companyId, first.companyId))).length).toBe(5);
  });
});

// Last in the file on purpose: these add invitation rows and a temporary admin to the seeded company.
describe("reissueAdminInvitation (lost first-admin link)", () => {
  const url = "http://localhost:3000";

  it("revokes the pending invitation and issues a fresh, hashed one", async () => {
    const before = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
    const pendingBefore = before.filter((i) => !i.usedAt && !i.revokedAt);
    expect(pendingBefore.length).toBeGreaterThan(0);

    const result = await reissueAdminInvitation({ adminEmail: "again@seed.test", appUrl: url });
    expect(result.status).toBe("issued");
    if (result.status !== "issued") return;
    expect(result.revoked).toBe(pendingBefore.length);
    expect(result.acceptUrl).toMatch(/^http:\/\/localhost:3000\/accept-invite\?token=[A-Za-z0-9_-]{20,}$/);

    const after = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
    const pending = after.filter((i) => !i.usedAt && !i.revokedAt);
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe("again@seed.test");
    const token = new URL(result.acceptUrl).searchParams.get("token")!;
    expect(pending[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(pending[0].tokenHash).not.toBe(token);
    // the old links no longer work
    for (const old of pendingBefore) {
      const [row] = await db.select().from(invitations).where(eq(invitations.id, old.id));
      expect(row.revokedAt).not.toBeNull();
    }
  });

  it("can be run repeatedly and always leaves exactly one valid invitation", async () => {
    await reissueAdminInvitation({ adminEmail: "a@seed.test", appUrl: url });
    await reissueAdminInvitation({ adminEmail: "b@seed.test", appUrl: url });
    const rows = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
    const pending = rows.filter((i) => !i.usedAt && !i.revokedAt);
    expect(pending.map((i) => i.email)).toEqual(["b@seed.test"]);
  });

  it("refuses when a Super Admin already exists, and changes nothing", async () => {
    const [superAdmin] = await db.select().from(roles).where(and(eq(roles.companyId, first.companyId), eq(roles.name, "Super Admin")));
    const [u] = await db
      .insert(user)
      .values({ id: "seed-test-admin", name: "Existing Admin", email: "existing@seed.test", emailVerified: true, companyId: first.companyId })
      .returning();
    await db.insert(userRoles).values({ userId: u.id, roleId: superAdmin.id, companyId: first.companyId });
    try {
      const before = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
      const result = await reissueAdminInvitation({ adminEmail: "intruder@seed.test", appUrl: url });
      expect(result).toEqual({ status: "admin_exists" });
      const after = await db.select().from(invitations).where(eq(invitations.companyId, first.companyId));
      expect(after).toHaveLength(before.length);
      expect(after.filter((i) => !i.usedAt && !i.revokedAt).length).toBe(before.filter((i) => !i.usedAt && !i.revokedAt).length);
    } finally {
      await db.delete(userRoles).where(eq(userRoles.userId, u.id));
      await db.delete(user).where(eq(user.id, u.id));
    }
  });
});
