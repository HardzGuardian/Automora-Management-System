import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { EmployeeForm } from "./employee-form";

export const metadata = { title: "New employee" };

export default async function NewEmployeePage() {
  const actor = await requireActor();
  if (!can(actor, "employees.create")) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="New employee" />
        <Alert tone="warning">You do not have permission to create employees.</Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New employee" description="Creating an employee does not give them access. Invite them from their page." />
      <EmployeeForm />
    </div>
  );
}
