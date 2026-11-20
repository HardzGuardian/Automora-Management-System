import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DetailHeader } from "@/components/ui/detail-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { getTeam } from "@/modules/teams";
import {
  addMemberAction,
  removeMemberAction,
  setRoleAction,
} from "../actions";

const compact = "min-h-8 px-2.5 text-xs";

export const metadata = { title: "Team" };

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let team;
  try {
    team = await getTeam(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const manage = team.canManage && !team.archived;
  const candidates =
    manage && can(actor, "employees.read")
      ? (await listEmployees(actor, { pageSize: 100, status: "Active" })).rows.filter((e) => !team.members.some((m) => m.employeeId === e.id))
      : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/teams">Teams</BackLink>
        {manage ? (
          <Link href={`/teams/${id}/edit`} className={buttonClass("secondary")}>
            Edit team
          </Link>
        ) : null}
      </div>
      {error ? <Alert tone="error">{error.slice(0, 300)}</Alert> : null}
      <DetailHeader
        title={team.name}
        code={team.departmentName}
        badges={team.archived ? <StatusBadge status="Archived" /> : null}
        facts={[
          <span key="m">{team.members.length} {team.members.length === 1 ? "member" : "members"}</span>,
          <Link key="w" href={`/teams?team=${id}`} className={linkClass}>See work on the Team tab</Link>,
        ]}
      />

      <div className="grid gap-5">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Members" count={team.members.length}>
            {team.members.length === 0 ? (
              <p className="text-sm text-muted">Nobody is on this team yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {team.members.map((m) => (
                  <li key={m.employeeId} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="font-medium">{m.fullName}</span>
                      <span className="text-muted">
                        {" "}
                        · {m.employeeCode}
                        {m.designation ? ` · ${m.designation}` : ""}
                        {m.role === "lead" ? " · Team lead" : ""}
                        {m.active ? "" : " · Not active"}
                      </span>
                    </span>
                    {manage ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <form action={setRoleAction}>
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="employeeId" value={m.employeeId} />
                          <input type="hidden" name="role" value={m.role === "lead" ? "member" : "lead"} />
                          <button type="submit" className={buttonClass("secondary", compact)}>
                            {m.role === "lead" ? "Make member" : "Make lead"}
                            <span className="sr-only"> {m.fullName}</span>
                          </button>
                        </form>
                        <ConfirmForm
                          action={removeMemberAction}
                          triggerClassName={compact}
                          label={
                            <>
                              Remove<span className="sr-only"> {m.fullName}</span>
                            </>
                          }
                          title={`Remove ${m.fullName} from ${team.name}?`}
                          description="They lose any open task or project they only had through this team. Work assigned to them directly is not changed."
                          confirmLabel="Remove member"
                        >
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="employeeId" value={m.employeeId} />
                        </ConfirmForm>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {candidates.length > 0 ? (
              <form action={addMemberAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <input type="hidden" name="id" value={id} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="member-employee" className="text-sm font-medium">
                    Add a person
                  </label>
                  <select id="member-employee" name="employeeId" required className={`${inputClass} sm:w-64`}>
                    {candidates.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.employeeCode} {e.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="member-role" className="text-sm font-medium">
                    Role
                  </label>
                  <select id="member-role" name="role" className={inputClass} defaultValue="member">
                    <option value="member">Member</option>
                    <option value="lead">Team lead</option>
                  </select>
                </div>
                <button type="submit" className={buttonClass("secondary")}>
                  Add to team
                </button>
              </form>
            ) : manage ? (
              <p className="border-t border-border pt-3 text-sm text-muted">
                {can(actor, "employees.read") ? "Every active employee is already on this team." : "You need access to the employee directory to add people."}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Tasks" count={team.tasks.length}>
            {team.tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks have been assigned to this team.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {team.tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <Link href={`/tasks/${t.id}`} className={linkClass}>
                      {t.taskCode} {t.title}
                    </Link>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Projects" count={team.projects.length}>
            {team.projects.length === 0 ? (
              <p className="text-sm text-muted">No projects have been assigned to this team.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {team.projects.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <Link href={`/projects/${p.id}`} className={linkClass}>
                      {p.projectCode} {p.name}
                    </Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

      </div>
    </div>
  );
}
