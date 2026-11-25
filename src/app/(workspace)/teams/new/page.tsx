import Link from "next/link";
import { ControlPanel, sheetClass } from "@/components/ui/odoo";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { getOrgChart } from "@/modules/teams";
import { createTeamAction } from "../actions";

export const metadata = { title: "Add team" };

export default async function NewTeamPage({ searchParams }: { searchParams?: Promise<{ department?: string }> }) {
  const actor = await requireActor();
  const preselected = (await searchParams)?.department;
  if (!can(actor, "teams.manage")) {
    return <p role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">Only admins can add teams.</p>;
  }
  const [departments, people] = await Promise.all([
    getOrgChart(actor),
    can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }).then((r) => r.rows) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <ControlPanel crumbs={[{ label: "Teams", href: "/teams" }, { label: "Add team" }]} description={<>Name the team, choose its department, then pick who is on it and who leads it.</>} />
      <div data-sheet className={`${sheetClass} max-w-[640px] flex flex-col gap-5`}>
      {departments.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          There is no department yet. <Link href="/teams/departments/new" className="font-medium text-primary-ink underline">Create a department</Link> first.
        </p>
      ) : (
        <form action={createTeamAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nt-name" className="text-sm font-medium">Team name</label>
            <input id="nt-name" name="name" required maxLength={80} placeholder="Team A" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="nt-dept" className="text-sm font-medium">Department</label>
            <select id="nt-dept" name="departmentId" required defaultValue={departments.some((d) => d.id === preselected) ? preselected : undefined} className={inputClass}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {people.length > 0 ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="nt-lead" className="text-sm font-medium">Team lead <span className="font-normal text-muted">(optional)</span></label>
                <select id="nt-lead" name="leadId" defaultValue="" className={inputClass}>
                  <option value="">No lead yet</option>
                  {people.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </select>
              </div>
              <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
                <legend className="mb-1 text-sm font-medium">Members <span className="font-normal text-muted">(the lead is added automatically)</span></legend>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-field">
                  {people.map((e) => (
                    <label key={e.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-3 first:border-t-0 hover:bg-primary-soft">
                      <input type="checkbox" name="members" value={e.id} className="size-4" />
                      <span className="text-sm text-foreground">{e.fullName}</span>
                      <span className="text-xs text-muted">{e.designation ?? ""}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}
          <div>
            <button type="submit" className={buttonClass("primary")}>Create team</button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
