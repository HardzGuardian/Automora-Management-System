import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/states";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getOrgChart } from "@/modules/teams";
import { archiveDepartmentAction, createDepartmentAction, createTeamAction } from "./actions";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { error } = await searchParams;
  const departments = await getOrgChart(actor);
  const manage = can(actor, "teams.manage");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Teams"
        description="Departments hold teams, and teams hold people. Assign a task or project to a team and everyone on it gets it."
      />
      {error ? <Alert tone="error">{error.slice(0, 300)}</Alert> : null}

      {departments.length === 0 ? (
        <EmptyState
          title={manage ? "No departments yet" : "You are not on a team yet"}
          description={manage ? "Create a department such as Marketing or Software Development, then add teams to it." : "Your manager can add you to a team."}
        />
      ) : (
        departments.map((d) => (
          <SectionCard
            key={d.id}
            title={d.name}
            count={d.teams.length}
            action={
              manage && d.teams.length === 0 ? (
                <ConfirmForm
                  action={archiveDepartmentAction}
                  triggerClassName="min-h-8 px-2.5 text-xs"
                  label={
                    <>
                      Archive<span className="sr-only"> {d.name}</span>
                    </>
                  }
                  title={`Archive ${d.name}?`}
                  description="The department is hidden. You can only do this while it has no teams."
                  confirmLabel="Archive department"
                >
                  <input type="hidden" name="id" value={d.id} />
                </ConfirmForm>
              ) : null
            }
          >
            {d.description ? <p className="text-sm text-muted">{d.description}</p> : null}
            {d.teams.length === 0 ? (
              <p className="text-sm text-muted">No teams in this department yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.teams.map((t) => (
                  <li key={t.id} className="rounded-md border border-border bg-background p-3 text-sm">
                    <Link href={`/teams/${t.id}`} className={`${linkClass} font-medium`}>
                      {t.name}
                    </Link>
                    <p className="mt-1 text-muted">
                      {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                      {t.leads.length > 0 ? ` · Lead: ${t.leads.join(", ")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {manage ? (
              <form action={createTeamAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <input type="hidden" name="departmentId" value={d.id} />
                <div className="flex flex-col gap-1">
                  <label htmlFor={`team-name-${d.id}`} className="text-sm font-medium">
                    New team in {d.name}
                  </label>
                  <input id={`team-name-${d.id}`} name="name" required maxLength={80} placeholder="Team A" className={`${inputClass} sm:w-64`} />
                </div>
                <button type="submit" className={buttonClass("secondary")}>
                  Add team
                </button>
              </form>
            ) : null}
          </SectionCard>
        ))
      )}

      {manage ? (
        <SectionCard title="New department">
          <form action={createDepartmentAction} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="dept-name" className="text-sm font-medium">
                Department name
              </label>
              <input id="dept-name" name="name" required maxLength={80} placeholder="Marketing" className={`${inputClass} sm:w-64`} />
            </div>
            <button type="submit" className={buttonClass("primary")}>
              Create department
            </button>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}
