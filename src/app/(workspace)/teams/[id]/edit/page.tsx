import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { ControlPanel, sheetClass } from "@/components/ui/odoo";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getTeam } from "@/modules/teams";
import { updateTeamAction } from "../../actions";

export const metadata = { title: "Edit team" };

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let team;
  try {
    team = await getTeam(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <div className="flex flex-col gap-4">
      <ControlPanel crumbs={[{ label: team.name, href: `/teams/${id}` }, { label: "Edit team" }]} />
      <div data-sheet className={`${sheetClass} max-w-[520px] flex flex-col gap-5`}>
      {can(actor, "teams.manage") && !team.archived ? (
        <form action={updateTeamAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="team-name" className="text-sm font-medium">Team name</label>
            <input id="team-name" name="name" required maxLength={80} defaultValue={team.name} className={inputClass} />
          </div>
          <div>
            <button type="submit" className={buttonClass("primary")}>Save</button>
          </div>
        </form>
      ) : (
        <Alert tone="error">You cannot edit this team.</Alert>
      )}
      </div>
    </div>
  );
}
