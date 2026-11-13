import { describe, expect, it } from "vitest";
import { loadActor } from "@/lib/auth/load-actor";
import { buildActor, createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listUsers } from "./users";

async function admin() {
  const company = await createCompany();
  const u = await createUser(company.id, { name: "Zed Admin" });
  const role = await grantPermissions(company.id, u.id, ["users.read"], "Admin");
  return { company, u, role, actor: await loadActor(u.id) };
}

describe("listUsers", () => {
  it("is denied without users.read", async () => {
    const c = await createCompany();
    await expect(listUsers(buildActor({ companyId: c.id }), {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only the actor's company with roles and linked employee", async () => {
    const a = await admin();
    const other = await admin();
    const emp = await createEmployee(a.company.id, { fullName: "Linked Person" });
    const member = await createUser(a.company.id, { name: "Member One", banned: true });
    await db.update(employees).set({ userId: member.id }).where(eq(employees.id, emp.id));
    await grantPermissions(a.company.id, member.id, [], "Viewer");

    const res = await listUsers(a.actor, {});
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(a.u.id);
    expect(ids).toContain(member.id);
    expect(ids).not.toContain(other.u.id);
    expect(res.total).toBe(2);
    const m = res.items.find((i) => i.id === member.id);
    expect(m).toMatchObject({ banned: true, employeeId: emp.id, employeeName: "Linked Person" });
    expect(m?.roles.map((r) => r.name)).toEqual(["Viewer"]);
    expect(res.items.find((i) => i.id === a.u.id)?.roles.map((r) => r.name)).toEqual(["Admin"]);
  });

  it("searches by name or email", async () => {
    const a = await admin();
    await createUser(a.company.id, { name: "Alice Smith", email: "alice@acme.test" });
    await createUser(a.company.id, { name: "Bob Jones", email: "bob@acme.test" });
    expect((await listUsers(a.actor, { search: "alice" })).items.map((i) => i.name)).toEqual(["Alice Smith"]);
    expect((await listUsers(a.actor, { search: "bob@acme" })).items.map((i) => i.name)).toEqual(["Bob Jones"]);
    expect((await listUsers(a.actor, { search: "%" })).items).toHaveLength(0);
  });

  it("paginates and caps page size at 100", async () => {
    const a = await admin();
    for (let i = 0; i < 4; i++) await createUser(a.company.id, { name: `User ${i}` });
    const p1 = await listUsers(a.actor, { page: 1, pageSize: 2 });
    const p3 = await listUsers(a.actor, { page: 3, pageSize: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p3.items).toHaveLength(1);
    expect(p1.total).toBe(5);
    const capped = await listUsers(a.actor, { pageSize: 1000 });
    expect(capped.pageSize).toBe(100);
  });
});
