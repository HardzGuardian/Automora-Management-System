import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icons";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmptyDepartments, listTeamOverview } from "@/modules/teams";

export const metadata = { title: "Teams" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const actor = await requireActor();
  const { q = "", error } = await searchParams;
  const search = q.trim();
  const manage = can(actor, "teams.manage");
  const [teams, emptyDepartments] = await Promise.all([listTeamOverview(actor, { search }), listEmptyDepartments(actor, { search })]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-muted">Open a team to see who is on it and how many tasks each person has.</p>
        </div>
        {manage ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Link href="/teams/departments/new" className={buttonClass("secondary")}>
              Create department
            </Link>
            <Link href="/teams/new" className={buttonClass("primary", "gap-2")}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              Add team
            </Link>
          </div>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error.slice(0, 300)}</Alert> : null}

      <form role="search" aria-label="Team search" className="flex flex-wrap items-center gap-2">
        <input name="q" type="search" defaultValue={search} placeholder="Search teams by name" aria-label="Search teams" className={`${inputClass} max-w-sm flex-1`} />
        <button type="submit" className={buttonClass("secondary")}>Search</button>
        {search ? <Link href="/teams" className="text-[13px] font-medium text-primary-ink hover:text-primary-hover">Clear</Link> : null}
      </form>

      <section aria-label="Teams" className="overflow-hidden rounded-lg border border-border bg-surface">
        {teams.length === 0 && emptyDepartments.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted">
            {search
              ? `No team matches “${search}”.`
              : manage
                ? "No teams yet. Create a department, then use Add team."
                : "You are not on a team yet. Your admin can add you to one."}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {emptyDepartments.map((d) => (
              <li key={d.id} className="border-t border-border first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-[18px]">
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{d.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Department with no team yet</span>
                  </span>
                  {manage ? (
                    <Link href={`/teams/new?department=${d.id}`} className={buttonClass("secondary", "min-h-8 px-3 py-1")}>
                      Add team
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
            {teams.map((t) => (
              <li key={t.id} className="border-t border-border first:border-t-0">
                <details open={search ? true : undefined} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-[18px]">
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{t.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">{t.department}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-body">{plural(t.members.length, "member", "members")}</span>
                      <Icon name="chevronDown" size={18} strokeWidth={2.2} className="text-body transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="border-t border-border bg-background px-6 py-4">
                    {t.members.length === 0 ? (
                      <p className="m-0 text-sm text-muted">Nobody is on this team yet.</p>
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">Members of {t.name}</caption>
                        <thead>
                          <tr className="text-left text-xs text-muted">
                            <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                            <th scope="col" className="px-3 py-2 font-medium">Role</th>
                            <th scope="col" className="py-2 pl-3 text-right font-medium">Tasks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.members.map((m) => (
                            <tr key={m.employeeId} className="border-t border-border">
                              <td className="py-2.5 pr-3 font-medium text-foreground">{m.name}</td>
                              <td className="px-3 py-2.5 text-body">{m.role === "lead" ? "Team lead" : (m.designation ?? "Member")}</td>
                              <td className="py-2.5 pl-3 text-right tabular-nums text-body">
                                {m.tasks === null ? "—" : `${m.tasks}${m.open !== null && m.tasks > 0 ? ` (${m.open} open)` : ""}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {manage ? (
                      <p className="mb-0 mt-3 text-sm">
                        <Link href={`/teams/${t.id}`} className="font-medium text-primary-ink hover:text-primary-hover">
                          Edit team and members
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
