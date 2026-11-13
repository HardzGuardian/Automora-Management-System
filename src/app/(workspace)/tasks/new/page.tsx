import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { listProjects } from "@/modules/projects";
import { TaskForm } from "./task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  const actor = await requireActor();
  if (!can(actor, "tasks.create")) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/tasks">All tasks</BackLink>
      <PageHeader title="New task" />
        <Alert tone="warning">You do not have permission to create tasks.</Alert>
      </div>
    );
  }
  const [projects, employees] = await Promise.all([
    listProjects(actor, { pageSize: 100 }),
    can(actor, "tasks.assign") && can(actor, "employees.read")
      ? listEmployees(actor, { pageSize: 100, status: "Active" })
      : { rows: [] },
  ]);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/tasks">All tasks</BackLink>
      <PageHeader title="New task" description="Give it a title; everything else can be added later." />
      <TaskForm
        projects={projects.rows.map((p) => ({ id: p.id, label: `${p.projectCode} ${p.name}` }))}
        employees={employees.rows.map((e) => ({ id: e.id, label: `${e.employeeCode} ${e.fullName}` }))}
      />
    </div>
  );
}
