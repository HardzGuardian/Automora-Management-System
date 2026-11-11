import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { TaskForm } from "./task-form";

export default async function NewTaskPage() {
  const actor = await requireActor();
  if (!can(actor, "tasks.create")) {
    return <main className="p-8">You do not have permission to create tasks.</main>;
  }
  const [projects, employees] = await Promise.all([
    listProjects(actor, { pageSize: 100 }),
    can(actor, "tasks.assign") && can(actor, "employees.read")
      ? listEmployees(actor, { pageSize: 100, status: "Active" })
      : { rows: [] },
  ]);
  return (
    <main className="flex flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">New task</h1>
      <TaskForm
        projects={projects.rows.map((p) => ({ id: p.id, label: `${p.projectCode} ${p.name}` }))}
        employees={employees.rows.map((e) => ({ id: e.id, label: `${e.employeeCode} ${e.fullName}` }))}
      />
    </main>
  );
}
