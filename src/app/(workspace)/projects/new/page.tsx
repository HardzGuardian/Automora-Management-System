import { BackLink } from "@/components/ui/back-link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listTeamCards } from "@/modules/teams";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const actor = await requireActor();
  const allowed = can(actor, "projects.create");
  const [clients, teams] = allowed
    ? await Promise.all([
        can(actor, "clients.read") ? listClients(actor, { pageSize: 100 }) : { rows: [] },
        listTeamCards(actor, "projects.members.manage"),
      ])
    : [{ rows: [] }, []];

  return (
    <div className="flex max-w-[800px] flex-col gap-5">
      <div>
        <BackLink href="/projects">Projects</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">New project</h1>
        <p className="mt-1 text-muted">Add the details, attach reference documents, then choose the team that will do the work.</p>
      </div>
      {allowed ? (
        <NewProjectForm clients={clients.rows.map((c) => ({ id: c.id, name: c.name }))} teams={teams} />
      ) : (
        <div role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">
          Only admins can create projects and upload documents. Ask an admin to set this project up.
        </div>
      )}
    </div>
  );
}
