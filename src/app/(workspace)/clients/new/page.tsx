import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { ClientForm } from "../client-form";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const actor = await requireActor();
  if (!can(actor, "clients.create")) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/clients">Clients</BackLink>
      <PageHeader title="New client" />
        <Alert tone="warning">You do not have permission to create clients.</Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/clients">Clients</BackLink>
      <PageHeader title="New client" description="Only the name is required. You can add notes and projects afterwards." />
      <ClientForm />
    </div>
  );
}
