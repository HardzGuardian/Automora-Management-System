import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, projectMembers } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import type { PermissionKey } from "@/lib/permissions";
import {
  buildActor,
  createClient,
  createCompany,
  createEmployee,
  createProject,
  createUser,
  grantPermissions,
} from "@/test/factories";
import { PROJECT_TRANSITIONS, canTransition } from "./status";
import { changeProjectStatus, createProject as createProjectSvc, getProject, listProjects, updateProject } from "./service";

const MANAGER: PermissionKey[] = ["projects.read.all", "projects.create", "projects.update", "projects.archive"];

async function world(keys: PermissionKey[] = MANAGER) {
  const company = await createCompany();
  const u = await createUser(company.id);
  const me = await createEmployee(company.id, { userId: u.id });
  await grantPermissions(company.id, u.id, keys, "PM");
  const client = await createClient(company.id);
  const owner = await createEmployee(company.id);
  return { company, u, me, client, owner, actor: await loadActor(u.id) };
}

const base = (w: Awaited<ReturnType<typeof world>>, o: Record<string, unknown> = {}) => ({
  name: "Website Revamp",
  type: "Client" as const,
  clientId: w.client.id,
  ownerEmployeeId: w.owner.id,
  ...o,
});

describe("status machine (table-driven)", () => {
  const valid: [string, string][] = [
    ["Planning", "Active"],
    ["Planning", "Cancelled"],
    ["Active", "On Hold"],
    ["Active", "Completed"],
    ["Active", "Cancelled"],
    ["On Hold", "Active"],
    ["On Hold", "Cancelled"],
    ["Completed", "Archived"],
    ["Cancelled", "Archived"],
  ];
  it.each(valid)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
  const invalid: [string, string][] = [
    ["Planning", "Completed"],
    ["Planning", "On Hold"],
    ["Active", "Planning"],
    ["Completed", "Active"],
    ["Archived", "Active"],
    ["Archived", "Archived"],
    ["Cancelled", "Active"],
    ["Active", "Active"],
  ];
  it.each(invalid)("rejects %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
  it("lists every status as a key", () => {
    expect(Object.keys(PROJECT_TRANSITIONS).sort()).toEqual(["Active", "Archived", "Cancelled", "Completed", "On Hold", "Planning"]);
  });
});

describe("createProject", () => {
  it("requires projects.create", async () => {
    const w = await world(["projects.read.all"]);
    await expect(createProjectSvc(w.actor, base(w))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a client project with PRJ code, owner as member, and audits", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w, { budgetAmount: "150000.50", startDate: "2026-01-01", dueDate: "2026-06-30" }));
    expect(p).toMatchObject({ projectCode: "PRJ-000001", status: "Planning", type: "Client", clientId: w.client.id, budgetAmount: "150000.50", currency: "INR" });
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, p.id));
    expect(members).toMatchObject([{ employeeId: w.owner.id, membershipRole: "owner" }]);
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, p.id));
    expect(logs.map((l) => l.action)).toEqual(["project.created"]);
  });

  it("creates an internal project without a client", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w, { type: "Internal", clientId: null }));
    expect(p.clientId).toBeNull();
  });

  it("enforces the client/internal rule with VALIDATION", async () => {
    const w = await world();
    await expect(createProjectSvc(w.actor, base(w, { clientId: null }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createProjectSvc(w.actor, base(w, { type: "Internal" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects archived and foreign-company clients", async () => {
    const w = await world();
    const archived = await createClient(w.company.id, { archivedAt: new Date() });
    const foreign = await createClient((await createCompany()).id);
    await expect(createProjectSvc(w.actor, base(w, { clientId: archived.id }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createProjectSvc(w.actor, base(w, { clientId: foreign.id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires an active owner from the same company", async () => {
    const w = await world();
    const inactive = await createEmployee(w.company.id, { employmentStatus: "Inactive" });
    const foreign = await createEmployee((await createCompany()).id);
    await expect(createProjectSvc(w.actor, base(w, { ownerEmployeeId: inactive.id }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createProjectSvc(w.actor, base(w, { ownerEmployeeId: foreign.id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates dates, budget and currency", async () => {
    const w = await world();
    await expect(createProjectSvc(w.actor, base(w, { startDate: "2026-02-01", dueDate: "2026-01-01" }))).rejects.toThrow();
    await expect(createProjectSvc(w.actor, base(w, { budgetAmount: "-5" }))).rejects.toThrow();
    await expect(createProjectSvc(w.actor, base(w, { budgetAmount: "1.234" }))).rejects.toThrow();
    await expect(createProjectSvc(w.actor, base(w, { currency: "rupees" }))).rejects.toThrow();
  });
});

describe("updateProject", () => {
  it("updates allowed fields, validates merged dates, and refuses type/client changes", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w, { startDate: "2026-03-01", dueDate: "2026-04-01" }));
    expect((await updateProject(w.actor, p.id, { name: "Renamed", budgetAmount: "99.00" })).name).toBe("Renamed");
    await expect(updateProject(w.actor, p.id, { dueDate: "2026-02-01" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateProject(w.actor, p.id, { clientId: null } as never)).rejects.toThrow();
    await expect(updateProject(w.actor, p.id, { type: "Internal" } as never)).rejects.toThrow();
  });

  it("requires projects.update and is company-scoped", async () => {
    const w = await world();
    const other = await world();
    const p = await createProjectSvc(w.actor, base(w));
    const reader = await world(["projects.read.all"]);
    await expect(updateProject(reader.actor, p.id, { name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateProject(other.actor, p.id, { name: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("changeProjectStatus", () => {
  it("walks the lifecycle, audits, and sets archived_at on Archived", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w));
    for (const s of ["Active", "On Hold", "Active", "Completed"] as const) {
      expect((await changeProjectStatus(w.actor, p.id, s)).status).toBe(s);
    }
    const archived = await changeProjectStatus(w.actor, p.id, "Archived");
    expect(archived.archived).toBe(true);
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, p.id));
    expect(logs.filter((l) => l.action === "project.status_changed")).toHaveLength(5);
    expect((await listProjects(w.actor, {})).rows.some((r) => r.id === p.id)).toBe(false);
    expect((await listProjects(w.actor, { includeArchived: true })).rows.some((r) => r.id === p.id)).toBe(true);
  });

  it("rejects an invalid transition as CONFLICT and archiving needs projects.archive", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w));
    await expect(changeProjectStatus(w.actor, p.id, "Completed")).rejects.toMatchObject({ code: "CONFLICT" });
    const noArchive = await world(["projects.read.all", "projects.create", "projects.update"]);
    const q = await createProjectSvc(noArchive.actor, base(noArchive));
    await changeProjectStatus(noArchive.actor, q.id, "Cancelled");
    await expect(changeProjectStatus(noArchive.actor, q.id, "Archived")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("getProject / listProjects scope", () => {
  it("employees see only projects they belong to; read.all sees the company's", async () => {
    const w = await world();
    const company = w.company;
    const empUser = await createUser(company.id);
    const emp = await createEmployee(company.id, { userId: empUser.id });
    await grantPermissions(company.id, empUser.id, ["tasks.comment"], "Emp");
    const employeeActor = await loadActor(empUser.id);

    const mine = await createProject(company.id, emp.id);
    await db.insert(projectMembers).values({ projectId: mine.id, companyId: company.id, employeeId: emp.id, membershipRole: "owner" });
    const notMine = await createProject(company.id, w.owner.id);

    expect((await listProjects(employeeActor, {})).rows.map((r) => r.id)).toEqual([mine.id]);
    await expect(getProject(employeeActor, notMine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getProject(w.actor, notMine.id)).id).toBe(notMine.id);
    expect((await listProjects(w.actor, {})).total).toBe(2);
  });

  it("filters by status, type and client, searches, paginates and caps pageSize", async () => {
    const w = await world();
    const a = await createProjectSvc(w.actor, base(w, { name: "Alpha site" }));
    await createProjectSvc(w.actor, base(w, { name: "Beta app", type: "Internal", clientId: null }));
    await changeProjectStatus(w.actor, a.id, "Active");
    expect((await listProjects(w.actor, { status: "Active" })).rows.map((r) => r.name)).toEqual(["Alpha site"]);
    expect((await listProjects(w.actor, { type: "Internal" })).rows.map((r) => r.name)).toEqual(["Beta app"]);
    expect((await listProjects(w.actor, { clientId: w.client.id })).total).toBe(1);
    expect((await listProjects(w.actor, { search: "BETA" })).total).toBe(1);
    expect((await listProjects(w.actor, { page: 2, pageSize: 1 })).rows).toHaveLength(1);
    await expect(listProjects(w.actor, { pageSize: 101 })).rejects.toThrow();
  });

  it("a user with no capability and no employee record sees nothing", async () => {
    const w = await world();
    await createProjectSvc(w.actor, base(w));
    const stranger = buildActor({ companyId: w.company.id });
    expect((await listProjects(stranger, {})).total).toBe(0);
  });
});

describe("budget visibility", () => {
  it("hides the budget from members who cannot edit the project or use finance", async () => {
    const w = await world();
    const p = await createProjectSvc(w.actor, base(w, { budgetAmount: "250000.00" }));
    expect((await getProject(w.actor, p.id)).budgetAmount).toBe("250000.00");

    const memberUser = await createUser(w.company.id);
    const memberEmp = await createEmployee(w.company.id, { userId: memberUser.id });
    await grantPermissions(w.company.id, memberUser.id, ["tasks.comment"], "Member");
    await db.insert(projectMembers).values({ projectId: p.id, companyId: w.company.id, employeeId: memberEmp.id, membershipRole: "member" });
    const member = await loadActor(memberUser.id);
    expect((await getProject(member, p.id)).budgetAmount).toBeNull();
    expect((await listProjects(member, {})).rows[0].budgetAmount).toBeNull();
  });
});
