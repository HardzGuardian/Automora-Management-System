import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import type { PermissionKey } from "@/lib/permissions";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { createMilestone, deleteMilestone, listMilestones, updateMilestone } from "./milestones";
import { createProject } from "./service";

async function world(keys: PermissionKey[] = ["projects.read.all", "projects.create", "projects.milestones.manage"]) {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, keys, "PM");
  const actor = await loadActor(u.id);
  const owner = await createEmployee(company.id);
  const project = await createProject(actor, { name: "P", type: "Internal", ownerEmployeeId: owner.id });
  return { company, actor, project };
}

describe("milestones", () => {
  it("creates and lists in due-date order", async () => {
    const w = await world();
    await createMilestone(w.actor, w.project.id, { name: "Launch", dueDate: "2026-06-01" });
    await createMilestone(w.actor, w.project.id, { name: "Design", dueDate: "2026-03-01" });
    await createMilestone(w.actor, w.project.id, { name: "No date" });
    const list = await listMilestones(w.actor, w.project.id);
    expect(list.map((m) => m.name)).toEqual(["Design", "Launch", "No date"]);
    expect(list.every((m) => m.status === "Pending" && m.completedAt === null)).toBe(true);
  });

  it("sets completed_at on Completed and clears it on reopen", async () => {
    const w = await world();
    const m = await createMilestone(w.actor, w.project.id, { name: "Beta" });
    const done = await updateMilestone(w.actor, w.project.id, m.id, { status: "Completed" });
    expect(done.completedAt).toBeInstanceOf(Date);
    const reopened = await updateMilestone(w.actor, w.project.id, m.id, { status: "In Progress" });
    expect(reopened.completedAt).toBeNull();
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, w.project.id));
    expect(logs.filter((l) => l.action.startsWith("milestone.")).length).toBeGreaterThanOrEqual(3);
  });

  it("validates name, status and date", async () => {
    const w = await world();
    await expect(createMilestone(w.actor, w.project.id, { name: "" })).rejects.toThrow();
    await expect(createMilestone(w.actor, w.project.id, { name: "x", dueDate: "01-02-2026" })).rejects.toThrow();
    const m = await createMilestone(w.actor, w.project.id, { name: "ok" });
    await expect(updateMilestone(w.actor, w.project.id, m.id, { status: "Done" as never })).rejects.toThrow();
  });

  it("updates fields and deletes", async () => {
    const w = await world();
    const m = await createMilestone(w.actor, w.project.id, { name: "A" });
    expect((await updateMilestone(w.actor, w.project.id, m.id, { name: "B", description: "d" })).name).toBe("B");
    await deleteMilestone(w.actor, w.project.id, m.id);
    expect(await listMilestones(w.actor, w.project.id)).toHaveLength(0);
    await expect(deleteMilestone(w.actor, w.project.id, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires projects.milestones.manage to write; other company's project is NOT_FOUND; milestone must belong to the project", async () => {
    const w = await world();
    const u = await createUser(w.company.id);
    await grantPermissions(w.company.id, u.id, ["projects.read.all"], "Reader");
    const reader = await loadActor(u.id);
    await expect(createMilestone(reader, w.project.id, { name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listMilestones(reader, w.project.id)).toEqual([]);

    const other = await world();
    await expect(createMilestone(other.actor, w.project.id, { name: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listMilestones(other.actor, w.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const m = await createMilestone(w.actor, w.project.id, { name: "mine" });
    const second = await world();
    await expect(updateMilestone(second.actor, second.project.id, m.id, { name: "hijack" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
