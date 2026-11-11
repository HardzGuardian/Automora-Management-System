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
} from "@/db/schema";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES } from "@/lib/permissions";
import { runSeed, type SeedResult } from "./seed-core";

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
