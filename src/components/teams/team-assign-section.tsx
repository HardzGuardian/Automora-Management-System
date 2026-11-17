import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { SectionCard } from "@/components/ui/section-card";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";

type AssignedTeam = { teamId: string; teamName: string; departmentName: string; memberCount: number };

/** "Teams" block on a task or project: the teams that hold it, plus a picker to hand it to another team. */
export function TeamAssignSection({
  id,
  noun,
  teams,
  options,
  canRemoveAny,
  assignAction,
  unassignAction,
}: {
  id: string;
  /** "task" or "project", used in the help text. */
  noun: string;
  teams: AssignedTeam[];
  /** Teams this viewer may assign to (already excludes archived teams). */
  options: { id: string; label: string }[];
  /** True when the viewer holds the assign permission; otherwise only teams they lead can be removed. */
  canRemoveAny: boolean;
  assignAction: (fd: FormData) => Promise<void>;
  unassignAction: (fd: FormData) => Promise<void>;
}) {
  const mine = new Set(options.map((o) => o.id));
  const free = options.filter((o) => !teams.some((t) => t.teamId === o.id));
  if (teams.length === 0 && free.length === 0) return null;
  return (
    <SectionCard title="Teams" count={teams.length}>
      {teams.length === 0 ? (
        <p className="text-sm text-muted">Not assigned to a team. Assigning a team gives this {noun} to everyone on it.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {teams.map((t) => (
            <li key={t.teamId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <Link href={`/teams/${t.teamId}`} className={`${linkClass} font-medium`}>
                  {t.teamName}
                </Link>
                <span className="text-muted">
                  {" "}
                  · {t.departmentName} · {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
              {canRemoveAny || mine.has(t.teamId) ? (
                <ConfirmForm
                  action={unassignAction}
                  triggerClassName="min-h-8 px-2.5 text-xs"
                  label={
                    <>
                      Remove<span className="sr-only"> {t.teamName}</span>
                    </>
                  }
                  title={`Take this ${noun} off ${t.teamName}?`}
                  description={`People who have it only through this team lose it. Anyone assigned to it directly keeps it.`}
                  confirmLabel="Remove team"
                >
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="teamId" value={t.teamId} />
                </ConfirmForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 ? (
        <form action={assignAction} className="flex flex-wrap gap-2 border-t border-border pt-3">
          <input type="hidden" name="id" value={id} />
          <select name="teamId" aria-label="Team to assign" required className={`${inputClass} sm:max-w-xs`}>
            {free.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass("secondary")}>
            Assign team
          </button>
        </form>
      ) : null}
    </SectionCard>
  );
}
