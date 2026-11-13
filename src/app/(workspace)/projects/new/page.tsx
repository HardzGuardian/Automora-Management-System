import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { ProjectForm } from "./project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const actor = await requireActor();
  if (!can(actor, "projects.create")) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="New project" />
        <Alert tone="warning">You do not have permission to create projects.</Alert>
      </div>
    );
  }
  const [clients, employees] = await Promise.all([
    can(actor, "clients.read") ? listClients(actor, { pageSize: 100 }) : { rows: [] },
    can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }) : { rows: [] },
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New project" description="Set up the project; tasks and milestones are added on its page." />
      <ProjectForm
        clients={clients.rows.map((c) => ({ id: c.id, label: `${c.clientCode} ${c.name}` }))}
        employees={employees.rows.map((e) => ({ id: e.id, label: `${e.employeeCode} ${e.fullName}` }))}
        defaultOwnerId={actor.employeeId}
      />
    </div>
  );
}
