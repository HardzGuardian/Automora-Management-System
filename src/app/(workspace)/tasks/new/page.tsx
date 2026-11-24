import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { listEmployees } from "@/modules/employees";
import { listMembers, listProjects } from "@/modules/projects";
import { getCreationDefaults } from "@/modules/settings";
import { quickTaskOptions } from "@/modules/tasks";
import { NewTaskForm } from "./new-task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const actor = await requireActor();
  const full = can(actor, "tasks.create");
  if (!full && !can(actor, "tasks.create.in_project")) notFound();
  const sp = await searchParams;
  const canAssign = can(actor, "tasks.assign");

  // Employees: only projects they are on, each with the people a task there can be given to.
  if (!full) {
    const defaults = await getCreationDefaults(actor.companyId);
    const all = await listProjects(actor, { page: 1, pageSize: 100 }).then((r) => r.rows).catch(() => []);
    const withPeople = await Promise.all(
      all.map(async (p) => ({ p, people: (await listMembers(actor, p.id).catch(() => [])).filter((m) => m.membershipRole !== "viewer") })),
    );
    const mine = withPeople.filter((x) => x.people.some((m) => m.employeeId === actor.employeeId));
    return (
      <div className="flex max-w-[800px] flex-col gap-5">
        <div>
          <BackLink href="/tasks">Tasks</BackLink>
          <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">New task</h1>
          <p className="mt-1 text-muted">Add a task to a project you are on. Give it to yourself or to someone else on that project.</p>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted">You are not on any project yet, so there is nowhere to add a task.</p>
        ) : (
          <NewTaskForm
            memberMode
            projects={mine.map((x) => ({ id: x.p.id, name: x.p.name }))}
            projectPeople={Object.fromEntries(mine.map((x) => [x.p.id, x.people.map((m) => ({ id: m.employeeId, name: m.fullName }))]))}
            clients={[]}
            people={null}
            defaultPriority={defaults.taskPriority}
            defaultProjectId={mine.some((x) => x.p.id === sp.project) ? sp.project : undefined}
          />
        )}
      </div>
    );
  }

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
