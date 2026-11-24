import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { SectionCard } from "@/components/ui/section-card";
import { inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees";
import { getProject, listMembers } from "@/modules/projects";
import { changeOwnerAction } from "../../actions";
import { EditProjectForm } from "./edit-project-form";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let project;
  try {
    project = await getProject(actor, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const canEdit = can(actor, "projects.update") && !project.archived;
  const canTransfer = can(actor, "projects.members.manage") && !project.archived;
  const [members, people] = await Promise.all([
    listMembers(actor, id),
    canTransfer && can(actor, "employees.read") ? listEmployees(actor, { pageSize: 100, status: "Active" }).then((r) => r.rows).catch(() => []) : Promise.resolve([]),
  ]);
  const owner = members.find((m) => m.membershipRole === "owner");
  const candidates = people.filter((e) => e.id !== project.ownerEmployeeId);

  return (
    <div className="flex max-w-[800px] flex-col gap-5">
      <div>
        <BackLink href={`/projects/${id}`}>{project.projectCode}</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Edit project</h1>
      </div>
      {canEdit ? (
        <EditProjectForm
          id={id}
          name={project.name}
          description={project.description}
          startDate={project.startDate}
          dueDate={project.dueDate}
          budgetAmount={project.budgetAmount}
          currency={project.currency}
          canSeeBudget={project.budgetAmount !== null || can(actor, "projects.update")}
        />
      ) : (
        <p role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">You cannot edit this project.</p>
      )}

      {canTransfer ? (
        <SectionCard title="Project owner">
          <p className="m-0 text-sm text-body">Current owner: <strong>{owner?.fullName ?? "—"}</strong>. The previous owner stays on the project as a member.</p>
          {candidates.length > 0 ? (
            <OwnerTransfer id={id} candidates={candidates.map((e) => ({ id: e.id, name: e.fullName }))} />
          ) : (
            <p className="m-0 text-sm text-muted">There is no one else to transfer the project to.</p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}

function OwnerTransfer({ id, candidates }: { id: string; candidates: { id: string; name: string }[] }) {
  return (
    <ConfirmForm
      action={changeOwnerAction}
      label="Transfer ownership"
      title="Transfer this project to a new owner?"
      description="The new owner gets full responsibility for the project. The current owner stays as a member."
      confirmLabel="Transfer ownership"
      danger={false}
      formClassName="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        New owner
        <select name="employeeId" required defaultValue={candidates[0].id} className={inputClass}>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </ConfirmForm>
  );
}
