import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const actor = await requireActor();
  if (!can(actor, "projects.create")) {
    return <main className="">You do not have permission to create projects.</main>;
  }
  const [clients, employees] = await Promise.all([
    can(actor, "clients.read") ? listClients(actor, { pageSize: 100 }) : { rows: [] },
    can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }) : { rows: [] },
  ]);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New project</h1>
      <ProjectForm
        clients={clients.rows.map((c) => ({ id: c.id, label: `${c.clientCode} ${c.name}` }))}
        employees={employees.rows.map((e) => ({ id: e.id, label: `${e.employeeCode} ${e.fullName}` }))}
        defaultOwnerId={actor.employeeId}
      />
    </main>
  );
}
