import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { loadActor } from "./load-actor";

describe("loadActor", () => {
  it("throws UNAUTHENTICATED for an unknown user", async () => {
    await expect(loadActor(randomUUID())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws FORBIDDEN for a suspended (banned) user", async () => {
    const c = await createCompany();
    const u = await createUser(c.id, { banned: true });
    await expect(loadActor(u.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("loads company, employee, roles, permissions and timezone", async () => {
    const c = await createCompany({ timezone: "America/New_York" });
    const u = await createUser(c.id);
    const emp = await createEmployee(c.id, { userId: u.id });
    await grantPermissions(c.id, u.id, ["tasks.create", "tasks.assign"], "Lead");
    const actor = await loadActor(u.id);
    expect(actor).toMatchObject({
      userId: u.id,
      companyId: c.id,
      employeeId: emp.id,
      roles: ["Lead"],
      timezone: "America/New_York",
    });
    expect([...actor.permissions].sort()).toEqual(["tasks.assign", "tasks.create"]);
  });

  it("gives a role with no permissions an empty permission set", async () => {
    const c = await createCompany();
    const u = await createUser(c.id);
    await grantPermissions(c.id, u.id, [], "Empty");
    const actor = await loadActor(u.id);
    expect(actor.roles).toEqual(["Empty"]);
    expect(actor.permissions.size).toBe(0);
  });

  it("has a null employeeId when the user has no employee record", async () => {
    const c = await createCompany();
    const u = await createUser(c.id);
    expect((await loadActor(u.id)).employeeId).toBeNull();
  });
});
