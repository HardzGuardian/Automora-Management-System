import "server-only";
import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { can, type PermissionKey } from "@/lib/permissions";

/**
 * Who may hand work to a team: anyone holding `permission` (a boss/manager), or that team's own lead.
 * The team must exist in the actor's company and be active; anything else is NOT_FOUND / VALIDATION.
 */
export async function assertCanAssignToTeam(
  tx: Pick<Tx, "select">,
  actor: Actor,
  teamId: string,
  permission: PermissionKey,
  opts: { allowArchived?: boolean } = {},
): Promise<void> {
  const [team] = await tx
    .select({ archivedAt: teams.archivedAt })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.companyId, actor.companyId)));
  if (!team) throw new DomainError("NOT_FOUND", "Team not found");
  if (team.archivedAt && !opts.allowArchived) throw new DomainError("VALIDATION", "This team is archived");
  if (can(actor, permission)) return;
  if (actor.employeeId) {
    const [lead] = await tx
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.employeeId, actor.employeeId), eq(teamMembers.role, "lead")));
    if (lead) return;
  }
  throw new DomainError("FORBIDDEN", "You can only assign work to a team you lead");
}

