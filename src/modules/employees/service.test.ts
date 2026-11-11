import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { buildActor, createCompany, createEmployee as makeEmployee, createUser, grantPermissions } from "@/test/factories";
import { createEmployee, getEmployee, listEmployees, updateEmployee } from "./service";

async function hr(keys: Parameters<typeof grantPermissions>[2] = ["employees.read", "employees.create", "employees.update"]) {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, keys, "HR");
  return { company, u, actor: await loadActor(u.id) };
}

const mail = () => `p${Math.random().toString(36).slice(2, 9)}@test.local`;
const input = (o: Record<string, unknown> = {}) => ({ fullName: "Priya Nair", workEmail: mail(), ...o });

describe("createEmployee", () => {
  it("requires employees.create", async () => {
    const c = await createCompany();
    await expect(createEmployee(buildActor({ companyId: c.id }), input())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a profile with an EMP code, lowercased email, and audits", async () => {
    const h = await hr();
    const e = await createEmployee(h.actor, input({ workEmail: "Priya.Nair@Test.Local", designation: "Designer", joiningDate: "2026-01-15" }));
    expect(e).toMatchObject({ employeeCode: "EMP-000001", workEmail: "priya.nair@test.local", employmentStatus: "Active", hasAccount: false, joiningDate: "2026-01-15" });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, e.id));
    expect(logs.map((l) => l.action)).toEqual(["employee.created"]);
  });

  it("rejects a duplicate work email in the same company but allows it in another", async () => {
    const h = await hr();
    const other = await hr();
    await createEmployee(h.actor, input({ workEmail: "dup@test.local" }));
    await expect(createEmployee(h.actor, input({ workEmail: "DUP@test.local" }))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createEmployee(other.actor, input({ workEmail: "dup@test.local" }))).resolves.toBeDefined();
  });

  it("validates input", async () => {
    const h = await hr();
    await expect(createEmployee(h.actor, input({ fullName: "" }))).rejects.toThrow();
    await expect(createEmployee(h.actor, input({ workEmail: "not-an-email" }))).rejects.toThrow();
    await expect(createEmployee(h.actor, input({ joiningDate: "15/01/2026" }))).rejects.toThrow();
  });

  it("gives 15 concurrent creations 15 distinct codes", async () => {
    const h = await hr();
    const all = await Promise.all(Array.from({ length: 15 }, () => createEmployee(h.actor, input())));
    expect(new Set(all.map((e) => e.employeeCode)).size).toBe(15);
  });
});

describe("updateEmployee / getEmployee", () => {
  it("updates fields and audits before/after", async () => {
    const h = await hr();
    const e = await createEmployee(h.actor, input());
    const u = await updateEmployee(h.actor, e.id, { designation: "Lead", phone: "+91 98765 43210" });
    expect(u).toMatchObject({ designation: "Lead", phone: "+91 98765 43210", fullName: "Priya Nair" });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, e.id));
    expect(logs.find((l) => l.action === "employee.updated")?.after).toMatchObject({ designation: "Lead" });
  });

  it("requires employees.update and treats another company's employee as NOT_FOUND", async () => {
    const h = await hr();
    const readOnly = await hr(["employees.read"]);
    const foreign = await makeEmployee(readOnly.company.id);
    await expect(updateEmployee(readOnly.actor, foreign.id, { designation: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateEmployee(h.actor, foreign.id, { designation: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getEmployee(h.actor, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to change to an email another employee uses", async () => {
    const h = await hr();
    const a = await createEmployee(h.actor, input());
    const b = await createEmployee(h.actor, input());
    await expect(updateEmployee(h.actor, b.id, { workEmail: a.workEmail })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets anyone read their own record but others need employees.read", async () => {
    const h = await hr();
    const mine = await createEmployee(h.actor, input());
    const other = await createEmployee(h.actor, input());
    const company = h.company;
    const u = await createUser(company.id);
    await db.update((await import("@/db/schema")).employees).set({ userId: u.id }).where(eq((await import("@/db/schema")).employees.id, mine.id));
    const self = await loadActor(u.id);
    expect((await getEmployee(self, mine.id)).id).toBe(mine.id);
    await expect(getEmployee(self, other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("listEmployees", () => {
  it("requires employees.read", async () => {
    const c = await createCompany();
    await expect(listEmployees(buildActor({ companyId: c.id }), {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only this company's non-archived employees with total, paginated", async () => {
    const h = await hr();
    const other = await hr();
    await makeEmployee(other.company.id);
    for (let i = 0; i < 5; i++) await createEmployee(h.actor, input({ fullName: `Person ${i}` }));
    const page1 = await listEmployees(h.actor, { page: 1, pageSize: 2, sort: "name" });
    const page3 = await listEmployees(h.actor, { page: 3, pageSize: 2, sort: "name" });
    expect(page1.total).toBe(5);
    expect(page1.rows.map((r) => r.fullName)).toEqual(["Person 0", "Person 1"]);
    expect(page3.rows.map((r) => r.fullName)).toEqual(["Person 4"]);
  });

  it("searches name, email and code; filters by status and department", async () => {
    const h = await hr();
    await createEmployee(h.actor, input({ fullName: "Anita Desai", workEmail: "anita@test.local", department: "Design" }));
    await createEmployee(h.actor, input({ fullName: "Bharat Kumar", department: "Engineering" }));
    expect((await listEmployees(h.actor, { search: "anita" })).rows).toHaveLength(1);
    expect((await listEmployees(h.actor, { search: "BHARAT" })).rows).toHaveLength(1);
    expect((await listEmployees(h.actor, { search: "EMP-000002" })).rows.map((r) => r.fullName)).toEqual(["Bharat Kumar"]);
    expect((await listEmployees(h.actor, { department: "Design" })).rows).toHaveLength(1);
    expect((await listEmployees(h.actor, { status: "Inactive" })).total).toBe(0);
  });

  it("caps pageSize at 100", async () => {
    const h = await hr();
    await expect(listEmployees(h.actor, { pageSize: 500 })).rejects.toThrow();
  });

  it("treats LIKE wildcards in search literally", async () => {
    const h = await hr();
    await createEmployee(h.actor, input({ fullName: "Normal Person" }));
    expect((await listEmployees(h.actor, { search: "%" })).total).toBe(0);
  });
});
