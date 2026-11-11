import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { EmployeeForm } from "./employee-form";

export default async function NewEmployeePage() {
  const actor = await requireActor();
  if (!can(actor, "employees.create")) {
    return <main className="p-8">You do not have permission to create employees.</main>;
  }
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">New employee</h1>
      <EmployeeForm />
    </main>
  );
}
