import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { getCreationDefaults } from "@/modules/settings";
import { quickTaskOptions } from "@/modules/tasks";
import { NewTaskForm } from "./new-task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "tasks.create")) notFound();
  const sp = await searchParams;
  const canAssign = can(actor, "tasks.assign");

  const [defaults, clients, projects, options] = await Promise.all([
    getCreationDefaults(actor.companyId),
    can(actor, "clients.read") ? listClients(actor, { page: 1, pageSize: 100 }).then((r) => r.rows.map((c) => ({ id: c.id, name: c.name }))).catch(() => []) : Promise.resolve([]),
    listProjects(actor, { page: 1, pageSize: 100 }).then((r) => r.rows.map((p) => ({ id: p.id, name: p.name }))).catch(() => []),
    canAssign ? quickTaskOptions(actor).catch(() => null) : Promise.resolve(null),
  ]);
  const people = canAssign ? (options?.people.map((p) => ({ id: p.id, name: p.name, openTasks: p.openTasks })) ?? (await listEmployees(actor, { pageSize: 100, status: "Active" }).then((r) => r.rows.map((e) => ({ id: e.id, name: e.fullName, openTasks: 0 }))).catch(() => []))) : null;

  return (
    <div className="flex max-w-[800px] flex-col gap-5">
      <div>
        <BackLink href="/tasks">Tasks</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">New task</h1>
      </div>
      <NewTaskForm projects={projects} clients={clients} people={people} defaultPriority={defaults.taskPriority} defaultProjectId={sp.project} />
    </div>
  );
}
