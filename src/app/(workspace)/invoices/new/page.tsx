import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getActor } from "@/lib/auth/actor";
import { addDays, todayInTz } from "@/lib/dates";
import { getCreationDefaults } from "@/modules/settings";
import { listInvoiceClients } from "@/modules/finance";
import { loadProjectOptions } from "../_components/project-options";
import { NewInvoiceForm } from "./_components/new-invoice-form";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const actor = await getActor();
  const clients = await listInvoiceClients(actor);
  const projects = clients.length === 0 ? [] : await loadProjectOptions(actor);
  const defaults = await getCreationDefaults(actor.companyId);
  const defaultDueDate = addDays(todayInTz(actor.timezone), defaults.invoiceDueDays);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader crumbs={[{ label: "Invoices", href: "/invoices" }]} title="New invoice" description="Create a draft with one line. Nothing is numbered or sent until you issue it." />
      {clients.length === 0 ? (
        <EmptyState title="No clients are available for invoicing" description="Add a client first, then come back to create the invoice." action={{ href: "/clients/new", label: "Add a client" }} />
      ) : (
        <NewInvoiceForm clients={clients} projects={projects} defaultDueDate={defaultDueDate} />
      )}
    </div>
  );
}
