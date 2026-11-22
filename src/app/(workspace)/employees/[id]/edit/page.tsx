import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getEmployee } from "@/modules/employees";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/styles";
import { deactivateAction, reactivateAction, suspendAction } from "../../actions";
import { EditEmployeeForm } from "./edit-employee-form";

export const metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!can(actor, "employees.update")) {
    return <p role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">Only admins can edit employees.</p>;
  }
  let e;
  try {
    e = await getEmployee(actor, id);
  } catch (err) {
    if (err instanceof DomainError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const active = e.employmentStatus === "Active";
  const canDeactivate = can(actor, "employees.deactivate");
  const canSuspend = can(actor, "users.suspend");
  const showStatus = active ? canDeactivate || canSuspend : canDeactivate;
  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <div>
        <BackLink href={`/employees/${id}`}>{e.fullName}</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Edit employee</h1>
        <p className="mt-1 text-muted">{e.employeeCode}. Teams are changed from the Team tab.</p>
      </div>
      <EditEmployeeForm id={id} fullName={e.fullName} workEmail={e.workEmail} phone={e.phone} designation={e.designation} joiningDate={e.joiningDate} />
      {showStatus ? (
        <section aria-label="Account status" className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-base font-semibold">Account status</h2>
            <StatusBadge status={e.employmentStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active ? (
              <>
                {canDeactivate ? (
                  <ConfirmForm
                    action={deactivateAction}
                    label="Deactivate"
                    title={`Deactivate ${e.fullName}?`}
                    description="They are signed out, cannot sign in, and cannot be assigned new work. Their history and existing assignments are kept. You can reactivate them later."
                    confirmLabel="Deactivate"
                  >
                    <input type="hidden" name="id" value={id} />
                  </ConfirmForm>
                ) : null}
                {canSuspend ? (
                  <ConfirmForm
                    action={suspendAction}
                    label="Suspend"
                    title={`Suspend ${e.fullName}?`}
                    description="Their account is blocked and all their sessions end immediately. Their history and assignments are kept. A user with the right permission can reactivate them."
                    confirmLabel="Suspend"
                  >
                    <input type="hidden" name="id" value={id} />
                  </ConfirmForm>
                ) : null}
              </>
            ) : (
              <form action={reactivateAction}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className={buttonClass("secondary")}>
                  Reactivate
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
