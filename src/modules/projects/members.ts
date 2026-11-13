import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction } from "@/db";
import { employees, projectMembers, projects } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { assertAssignable } from "@/modules/employees";
import { loadProject } from "./service";

export type MemberDTO = { employeeId: string; fullName: string; employeeCode: string; membershipRole: string; viaTeamId: string | null };

const roleSchema = z.enum(["member", "viewer"]);

export async function listMembers(actor: Actor, projectId: string): Promise<MemberDTO[]> {
  await loadProject(db, actor, projectId);
  const rows = await db
    .select({
      employeeId: projectMembers.employeeId,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      membershipRole: projectMembers.membershipRole,
      viaTeamId: projectMembers.viaTeamId,
    })
    .from(projectMembers)
    .innerJoin(employees, and(eq(employees.id, projectMembers.employeeId), eq(employees.companyId, projectMembers.companyId)))
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.companyId, actor.companyId)))
    .orderBy(asc(projectMembers.createdAt), asc(employees.fullName));
  // owner first
  return rows.sort((a, b) => Number(b.membershipRole === "owner") - Number(a.membershipRole === "owner"));
}

export async function addMember(
  actor: Actor,
  projectId: string,
  employeeId: string,
  role: "member" | "viewer" = "member",
): Promise<void> {
  requirePermission(actor, "projects.members.manage");
  const membershipRole = roleSchema.parse(role);
  await withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    await assertAssignable(tx, actor.companyId, employeeId);
    const [dup] = await tx
      .select({ id: projectMembers.employeeId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, employeeId)));
    if (dup) throw new DomainError("CONFLICT", "This employee is already a member");
    await tx.insert(projectMembers).values({ projectId, companyId: actor.companyId, employeeId, membershipRole });
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: "project.member_added",
      after: { employeeId, membershipRole },
    });
  });
}

async function loadMember(tx: Pick<typeof db, "select">, projectId: string, employeeId: string) {
  const [m] = await tx
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, employeeId)));
  if (!m) throw new DomainError("NOT_FOUND", "Member not found");
  return m;
}

export async function removeMember(actor: Actor, projectId: string, employeeId: string): Promise<void> {
  requirePermission(actor, "projects.members.manage");
  await withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    const m = await loadMember(tx, projectId, employeeId);
    if (m.membershipRole === "owner") throw new DomainError("CONFLICT", "Change the project owner before removing them");
    if (m.viaTeamId) throw new DomainError("CONFLICT", "This person is on the project through a team. Remove the team, or take them out of the team.");
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, employeeId)));
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: "project.member_removed",
      before: { employeeId, membershipRole: m.membershipRole },
    });
  });
}

export async function setMemberRole(
  actor: Actor,
  projectId: string,
  employeeId: string,
  role: "member" | "viewer",
): Promise<void> {
  requirePermission(actor, "projects.members.manage");
  const membershipRole = roleSchema.parse(role);
  await withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    const m = await loadMember(tx, projectId, employeeId);
    if (m.membershipRole === "owner") throw new DomainError("CONFLICT", "The owner's role changes only by transferring ownership");
    await tx
      .update(projectMembers)
      .set({ membershipRole })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, employeeId)));
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: "project.member_role_changed",
      before: { employeeId, membershipRole: m.membershipRole },
      after: { employeeId, membershipRole },
    });
  });
}

export async function changeOwner(actor: Actor, projectId: string, newOwnerId: string): Promise<void> {
  requirePermission(actor, "projects.members.manage");
  await withTransaction(async (tx) => {
    const project = await loadProject(tx, actor, projectId);
    if (project.ownerEmployeeId === newOwnerId) throw new DomainError("CONFLICT", "That employee already owns the project");
    await assertAssignable(tx, actor.companyId, newOwnerId);

    await tx
      .update(projectMembers)
      .set({ membershipRole: "member" })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.employeeId, project.ownerEmployeeId)));
    await tx
      .insert(projectMembers)
      .values({ projectId, companyId: actor.companyId, employeeId: newOwnerId, membershipRole: "owner" })
      .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.employeeId], set: { membershipRole: "owner", viaTeamId: null } });
    await tx
      .update(projects)
      .set({ ownerEmployeeId: newOwnerId })
      .where(and(eq(projects.id, projectId), eq(projects.companyId, actor.companyId)));
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: "project.owner_changed",
      before: { ownerEmployeeId: project.ownerEmployeeId },
      after: { ownerEmployeeId: newOwnerId },
    });
  });
}
