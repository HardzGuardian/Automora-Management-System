import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, permissions, rolePermissions, roles, userRoles } from "@/db/schema";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { loadActor } from "@/lib/auth/load-actor";
import { createCompany, createUser, grantPermissions, buildActor } from "@/test/factories";
import { assignRole, createRole, listRoles, removeRole, setRolePermissions } from "./roles";

const GRANTABLE = ["tasks.create", "tasks.assign"] as const;

async function admin(keys: Parameters<typeof grantPermissions>[2] = ["roles.read", "roles.manage", ...GRANTABLE]) {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, keys, "Admin");
  return { company, u, actor: await loadActor(u.id) };
}

const keysOfRole = async (roleId: string) =>
  (
    await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId))
  )
    .map((r) => r.key)
    .sort();

describe("roles", () => {
  it("denies everything without permissions", async () => {
    const c = await createCompany();
    const nobody = buildActor({ companyId: c.id });
    await expect(listRoles(nobody)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createRole(nobody, { name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setRolePermissions(nobody, "00000000-0000-0000-0000-000000000000", [])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assignRole(nobody, "u", "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists only the actor's company roles with their permission keys", async () => {
    const a = await admin();
    await admin();
    const list = await listRoles(a.actor);
    expect(list.map((r) => r.name)).toEqual(["Admin"]);
    expect(list[0].permissions.sort()).toEqual(["roles.manage", "roles.read", "tasks.assign", "tasks.create"]);
  });

  it("creates a role with no permissions and audits it", async () => {
    const a = await admin();
    const role = await createRole(a.actor, { name: "Intern", description: "Read only" });
    expect(role.permissions).toEqual([]);
    await expect(createRole(a.actor, { name: "Intern" })).rejects.toMatchObject({ code: "CONFLICT" });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, a.company.id));
    expect(logs.map((l) => l.action)).toContain("role.created");
  });

  it("edits the permission set and audits before/after", async () => {
    const a = await admin();
    const role = await createRole(a.actor, { name: "Lead" });
    await setRolePermissions(a.actor, role.id, ["tasks.create", "tasks.assign"]);
    expect(await keysOfRole(role.id)).toEqual(["tasks.assign", "tasks.create"]);
    await setRolePermissions(a.actor, role.id, ["tasks.create"]);
    expect(await keysOfRole(role.id)).toEqual(["tasks.create"]);
    const logs = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.entityId, role.id), eq(activityLogs.action, "role.permissions_changed")));
    expect(logs).toHaveLength(2);
    expect(logs[1].before).toEqual({ permissions: ["tasks.assign", "tasks.create"] });
    expect(logs[1].after).toEqual({ permissions: ["tasks.create"] });
  });

  it("rejects unknown permission keys", async () => {
    const a = await admin();
    const role = await createRole(a.actor, { name: "Odd" });
    await expect(setRolePermissions(a.actor, role.id, ["not.a.key" as never])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("treats another company's role as NOT_FOUND", async () => {
    const a = await admin();
    const b = await admin();
    const foreign = await createRole(b.actor, { name: "Foreign" });
    await expect(setRolePermissions(a.actor, foreign.id, ["tasks.create"])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assignRole(a.actor, a.u.id, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not let system roles be edited", async () => {
    const a = await admin();
    const [sys] = await db.insert(roles).values({ companyId: a.company.id, name: "Super Admin", isSystem: true }).returning();
    await expect(setRolePermissions(a.actor, sys.id, [])).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("assigns and removes roles for users of the same company only", async () => {
    const a = await admin();
    const other = await createUser(a.company.id);
    const foreignUser = await createUser((await createCompany()).id);
    const role = await createRole(a.actor, { name: "Helper" });
    await assignRole(a.actor, other.id, role.id);
    expect(await db.select().from(userRoles).where(and(eq(userRoles.userId, other.id), eq(userRoles.roleId, role.id)))).toHaveLength(1);
    await expect(assignRole(a.actor, foreignUser.id, role.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await removeRole(a.actor, other.id, role.id);
    expect(await db.select().from(userRoles).where(eq(userRoles.userId, other.id))).toHaveLength(0);
  });

  it("refuses to remove the last Super Admin", async () => {
    const a = await admin(["roles.read", "roles.manage", ...ALL_PERMISSION_KEYS]);
    const [sys] = await db.insert(roles).values({ companyId: a.company.id, name: "Super Admin", isSystem: true }).returning();
    const sa = await createUser(a.company.id);
    await assignRole(a.actor, sa.id, sys.id);
    await expect(removeRole(a.actor, sa.id, sys.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const sa2 = await createUser(a.company.id);
    await assignRole(a.actor, sa2.id, sys.id);
    await expect(removeRole(a.actor, sa.id, sys.id)).resolves.toBeUndefined();
  });
});

describe("privilege escalation guards", () => {
  it("refuses to grant permissions the actor does not hold", async () => {
    const a = await admin();
    const role = await createRole(a.actor, { name: "Grabby" });
    await expect(setRolePermissions(a.actor, role.id, ["finance.reports.read"])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await keysOfRole(role.id)).toEqual([]);
  });

  it("refuses to edit a role the actor holds themselves", async () => {
    const a = await admin();
    const [mine] = await db.select().from(roles).where(eq(roles.companyId, a.company.id));
    await expect(setRolePermissions(a.actor, mine.id, ["roles.manage"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to assign a role holding permissions the actor lacks", async () => {
    const a = await admin();
    const target = await createUser(a.company.id);
    const strong = await grantPermissions(a.company.id, (await createUser(a.company.id)).id, ["finance.reports.read"], "Strong");
    await expect(assignRole(a.actor, target.id, strong.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.select().from(userRoles).where(eq(userRoles.userId, target.id))).toHaveLength(0);
  });

  it("only an actor holding every permission may assign Super Admin", async () => {
    const a = await admin();
    const [sys] = await db.insert(roles).values({ companyId: a.company.id, name: "Super Admin", isSystem: true }).returning();
    const target = await createUser(a.company.id);
    await expect(assignRole(a.actor, target.id, sys.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const full = await admin(["roles.read", "roles.manage", ...ALL_PERMISSION_KEYS]);
    const [sys2] = await db.insert(roles).values({ companyId: full.company.id, name: "Super Admin", isSystem: true }).returning();
    const target2 = await createUser(full.company.id);
    await expect(assignRole(full.actor, target2.id, sys2.id)).resolves.toBeUndefined();
  });
});
