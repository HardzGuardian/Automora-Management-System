import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const actor = await requireActor();
  if (!can(actor, "clients.create")) {
    return <main className="p-8">You do not have permission to create clients.</main>;
  }
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">New client</h1>
      <ClientForm />
    </main>
  );
}
