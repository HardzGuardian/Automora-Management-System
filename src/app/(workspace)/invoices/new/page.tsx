import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { listInvoiceClients } from "@/modules/finance";
import { NewInvoiceForm } from "./_components/new-invoice-form";

export default async function NewInvoicePage() {
  const actor = await getActor();
  const clients = await listInvoiceClients(actor);
  return (
    <main>
      <p><Link href="/invoices">Invoices</Link></p>
      <h1>New invoice</h1>
      {clients.length === 0
        ? <p>No clients are available for invoicing.</p>
        : <NewInvoiceForm clients={clients} />}
    </main>
  );
}
