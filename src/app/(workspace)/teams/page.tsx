import Link from "next/link";
import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";
import { getTeamWork, type WorkPerson, type WorkTask } from "@/modules/teams";

export const metadata = { title: "Team" };

type SP = { team?: string; person?: string; filter?: string };
const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
] as const;

const isDone = (t: WorkTask) => t.status === "Completed";
function split(tasks: WorkTask[]) {
  const done = tasks.filter(isDone).length;
  const overdue = tasks.filter((t) => t.overdue).length;
  const active = tasks.filter((t) => !isDone(t) && !t.overdue && (t.status === "In Progress" || t.status === "In Review")).length;
  const pending = tasks.filter((t) => !isDone(t) && !t.overdue && t.status === "Pending").length;
  return { done, overdue, active, pending };
}

function href(sp: SP, patch: Partial<SP>): string {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v && !(k === "filter" && v === "all")) qs.set(k, v);
  const s = qs.toString();
  return s ? `/teams?${s}` : "/teams";
}

function PersonCard({ p, selected, link }: { p: WorkPerson; selected: boolean; link: string }) {
  const n = Math.max(1, p.tasks.length);
  const c = split(p.tasks);
  const parts = [c.done && `${c.done} done`, c.active && `${c.active} in progress`, c.pending && `${c.pending} pending`, c.overdue && `${c.overdue} overdue`].filter(Boolean);
  const segs = [
    { w: (c.done / n) * 100, cls: "bg-primary" },
    { w: (c.active / n) * 100, cls: "bg-info" },
    { w: (c.pending / n) * 100, cls: "bg-[#d9a21b]" },
    { w: (c.overdue / n) * 100, cls: "bg-danger" },
  ];
  return (
    <Link
      href={link}
      aria-current={selected ? "true" : undefined}
      className={cn("flex w-full flex-col gap-2.5 rounded-lg bg-surface px-4 py-3.5 text-left", selected ? "border-[1.5px] border-primary" : "border border-border hover:border-primary")}
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-[38px] flex-none items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-ink">
          {p.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">{p.name}</span>
          <span className="block text-xs text-muted">{p.role === "lead" ? "Team lead" : "Member"}</span>
        </span>
        <span className="text-[13px] font-semibold text-body">
          {c.done} of {p.tasks.length}
        </span>
      </span>
      <span className="flex h-2 overflow-hidden rounded bg-[#ecefec]" aria-hidden="true">
        {segs.map((g, i) => (
          <span key={i} className={cn("block h-2", g.cls)} style={{ width: `${g.w}%` }} />
        ))}
      </span>
      <span className="text-xs text-body">{parts.length ? parts.join(" · ") : "No tasks yet"}</span>
    </Link>
  );
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const work = await getTeamWork(actor, sp.team);
  const manage = can(actor, "teams.manage");

  const person = work.people.find((p) => p.employeeId === sp.person) ?? work.people[0];
  const filter = FILTERS.find((f) => f.key === sp.filter)?.key ?? "all";
  const all = work.people.flatMap((p) => p.tasks);
  const teamStats = [
    { label: "People", value: String(work.people.length), tone: "" },
    { label: "Tasks assigned", value: String(all.length), tone: "" },
    { label: "Completed", value: String(all.filter(isDone).length), tone: "text-primary-ink" },
    { label: "Overdue", value: String(all.filter((t) => t.overdue).length), tone: all.some((t) => t.overdue) ? "text-danger" : "" },
  ];

  const personTasks = person?.tasks ?? [];
  const shown = personTasks
    .filter((t) => (filter === "open" ? !isDone(t) : filter === "done" ? isDone(t) : true))
    .slice()
    .sort((a, b) => rank(a) - rank(b));
  const pDone = personTasks.filter(isDone).length;
  const pOver = personTasks.filter((t) => t.overdue).length;
  const base: SP = { team: work.selected?.id, person: person?.employeeId, filter };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-muted">See who has work, and whether it is done.</p>
        </div>
        {manage ? (
          <Link href="/teams/manage" className={buttonClass("secondary", "gap-2")}>
            <Icon name="settings" size={18} />
            Manage teams
          </Link>
        ) : null}
      </div>

      {!work.selected ? (
        <section className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-muted">
          {manage ? (
            <>
              No teams yet. <Link href="/teams/manage" className="font-medium text-primary-ink underline">Create a department and a team</Link> to see their work here.
            </>
          ) : (
            "You are not on a team yet. Your admin can add you to one."
          )}
        </section>
      ) : (
        <>
          <FilterPills
            label="Choose a team"
            pills={work.teams.map((t) => ({ label: t.label, href: href({}, { team: t.id }), active: t.id === work.selected!.id }))}
          />

          <section aria-label="Team summary" className="grid grid-cols-2 rounded-lg border border-border bg-surface lg:grid-cols-4">
            {teamStats.map((k, i) => (
              <div key={k.label} className={cn("px-5 py-4", i > 0 && "lg:border-l lg:border-border", i % 2 === 1 && "border-l border-border lg:border-l")}>
                <div className="text-xs text-muted">{k.label}</div>
                <div className={cn("mt-1 text-[28px] font-semibold tracking-tight text-foreground", k.tone)}>{k.value}</div>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-start gap-5">
            <section aria-label="People" className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
              <h2 className="m-0 text-base font-semibold text-foreground">People</h2>
              {work.people.length === 0 ? <p className="m-0 text-sm text-muted">This team has no active members yet.</p> : null}
              {work.people.map((p) => (
                <PersonCard key={p.employeeId} p={p} selected={p.employeeId === person?.employeeId} link={href(base, { person: p.employeeId, filter: "all" })} />
              ))}
            </section>

            <section aria-label="Selected person's work" className="min-w-0 flex-[1.4_1_440px] rounded-lg border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-[18px]">
                <div>
                  <h2 className="m-0 text-base font-semibold text-foreground">{person ? person.name + (person.role === "lead" ? " (team lead)" : "") : "No one selected"}</h2>
                  <p className="mb-0 mt-0.5 text-xs text-muted">
                    {pDone} of {personTasks.length} tasks done{pOver ? `, ${pOver} overdue` : ""}
                  </p>
                </div>
                <nav aria-label="Filter work" className="inline-flex overflow-hidden rounded-lg border border-field">
                  {FILTERS.map((f) => (
                    <Link
                      key={f.key}
                      href={href(base, { filter: f.key })}
                      aria-current={filter === f.key ? "true" : undefined}
                      className={cn("inline-flex h-9 items-center px-3.5 text-[13px] font-medium", filter === f.key ? "bg-primary-soft text-primary-ink" : "bg-surface text-foreground hover:bg-primary-soft")}
                    >
                      {f.label}
                    </Link>
                  ))}
                </nav>
              </div>
              {shown.length === 0 ? (
                <p className="border-t border-border px-5 py-9 text-center text-muted">
                  {personTasks.length === 0 ? "No tasks assigned yet." : "Nothing here. Switch the filter to see the other tasks."}
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {shown.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5 first:border-t-0">
                      <span className="min-w-0 flex-[1_1_220px]">
                        <Link href={`/tasks/${t.id}`} className={cn("block font-medium hover:text-primary-ink", isDone(t) ? "text-muted line-through" : "text-foreground")}>
                          {t.title}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted">
                          {t.projectName ?? "No project"} · due {t.dueDate ?? "—"}
                        </span>
                      </span>
                      <StatusBadge status={t.status} overdue={t.overdue} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function rank(t: WorkTask): number {
  if (t.overdue) return 0;
  if (t.status === "In Progress" || t.status === "In Review") return 1;
  if (t.status === "Pending") return 2;
  return 3;
}
