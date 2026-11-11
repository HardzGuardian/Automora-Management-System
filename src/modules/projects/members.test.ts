import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, projects } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import type { PermissionKey } from "@/lib/permissions";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { addMember, changeOwner, listMembers, removeMember, setMemberRole } from "./members";
import { createProject } from "./service";

async function world(keys: PermissionKey[] = ["projects.read.all", "projects.create", "projects.members.manage"]) {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, keys, "PM");
  const actor = await loadActor(u.id);
  const owner = await createEmployee(company.id);
  const project = await createProject(actor, { name: "P", type: "Internal", ownerEmployeeId: owner.id });
  return { company, actor, owner, project };
}

describe("members", () => {
  it("lists the owner as the first member", async () => {
    const w = await world();
    const m = await listMembers(w.actor, w.project.id);
    expect(m).toMatchObject([{ employeeId: w.owner.id, membershipRole: "owner", fullName: w.owner.fullName }]);
  });

  it("adds and removes members and audits", async () => {
    const w = await world();
    const e = await createEmployee(w.company.id);
    await addMember(w.actor, w.project.id, e.id);
    expect((await listMembers(w.actor, w.project.id)).map((m) => m.employeeId).sort()).toEqual([e.id, w.owner.id].sort());
    await removeMember(w.actor, w.project.id, e.id);
    expect(await listMembers(w.actor, w.project.id)).toHaveLength(1);
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, w.project.id));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["project.member_added", "project.member_removed"]));
  });

  it("rejects duplicates, inactive, foreign and owner-role additions", async () => {
    const w = await world();
    const e = await createEmployee(w.company.id);
    await addMember(w.actor, w.project.id, e.id, "viewer");
    await expect(addMember(w.actor, w.project.id, e.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const inactive = await createEmployee(w.company.id, { employmentStatus: "Inactive" });
    await expect(addMember(w.actor, w.project.id, inactive.id)).rejects.toMatchObject({ code: "VALIDATION" });
    const foreign = await createEmployee((await createCompany()).id);
    await expect(addMember(w.actor, w.project.id, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await createEmployee(w.company.id);
    await expect(addMember(w.actor, w.project.id, other.id, "owner" as never)).rejects.toThrow();
  });

  it("changes a member's role between member and viewer, but not the owner's", async () => {
    const w = await world();
    const e = await createEmployee(w.company.id);
    await addMember(w.actor, w.project.id, e.id);
    await setMemberRole(w.actor, w.project.id, e.id, "viewer");
    expect((await listMembers(w.actor, w.project.id)).find((m) => m.employeeId === e.id)?.membershipRole).toBe("viewer");
    await expect(setMemberRole(w.actor, w.project.id, w.owner.id, "member")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setMemberRole(w.actor, w.project.id, "00000000-0000-0000-0000-000000000000", "member")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("will not remove the owner", async () => {
    const w = await world();
    await expect(removeMember(w.actor, w.project.id, w.owner.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("transfers ownership: new owner becomes owner member, old owner a member", async () => {
    const w = await world();
    const next = await createEmployee(w.company.id);
    await changeOwner(w.actor, w.project.id, next.id);
    const members = await listMembers(w.actor, w.project.id);
    expect(members.find((m) => m.employeeId === next.id)?.membershipRole).toBe("owner");
    expect(members.find((m) => m.employeeId === w.owner.id)?.membershipRole).toBe("member");
    const [p] = await db.select().from(projects).where(eq(projects.id, w.project.id));
    expect(p.ownerEmployeeId).toBe(next.id);
    const inactive = await createEmployee(w.company.id, { employmentStatus: "Suspended" });
    await expect(changeOwner(w.actor, w.project.id, inactive.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires projects.members.manage for writes and scope for reads", async () => {
    const w = await world();
    const reader = await (async () => {
      const c = await createCompany();
      const u = await createUser(c.id);
      await grantPermissions(c.id, u.id, ["projects.read.all"], "Reader");
      return { actor: await loadActor(u.id) };
    })();
    const e = await createEmployee(w.company.id);
    const noManage = await (async () => {
      const u = await createUser(w.company.id);
      await grantPermissions(w.company.id, u.id, ["projects.read.all"], "Reader");
      return loadActor(u.id);
    })();
    await expect(addMember(noManage, w.project.id, e.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeMember(noManage, w.project.id, e.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeOwner(noManage, w.project.id, e.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // other company cannot see the project at all
    await expect(listMembers(reader.actor, w.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const crossManager = await world();
    await expect(addMember(crossManager.actor, w.project.id, e.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
