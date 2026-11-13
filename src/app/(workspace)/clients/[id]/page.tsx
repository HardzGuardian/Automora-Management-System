import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { DetailHeader } from "@/components/ui/detail-header";
import { DetailsList } from "@/components/ui/details-list";
import { Field } from "@/components/ui/field";
import { formatDateTime } from "@/components/ui/format";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getClient, listClientNotes } from "@/modules/clients";
import { getClientFinanceSummary, type ClientFinanceSummary } from "@/modules/finance";
import { listProjects } from "@/modules/projects";
import { addNoteAction, archiveClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let client;
  try {
    client = await getClient(actor, id);
  } catch (e) {
    if (e instanceof DomainError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  // Finance data comes only through @/modules/finance and only for users with finance access.
  let finance: ClientFinanceSummary | null = null;
  let financeUnavailable = false;
  if (can(actor, "finance.invoices.read")) {
    try {
      finance = await getClientFinanceSummary(actor, id);
    } catch {
      financeUnavailable = true; // never let a finance problem break the client page
    }
  }
  const [notes, projects] = await Promise.all([
    listClientNotes(actor, id),
    listProjects(actor, { clientId: id, includeArchived: true, pageSize: 100 }),
  ]);
  const canUpdate = can(actor, "clients.update");
  const tz = actor.timezone;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/clients">Clients</BackLink>
      <DetailHeader
        title={client.name}
        code={client.clientCode}
        badges={<StatusBadge status={client.archived ? "Archived" : client.status} />}
        facts={[client.contactPerson ?? "No contact person", client.email ?? "No email", client.serviceType ?? "No service type"]}
      />

      {can(actor, "clients.archive") ? (
        <div className="flex flex-wrap items-center gap-2">
          {client.archived ? (
            <form action={archiveClientAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="undo" value="1" />
              <button type="submit" className={buttonClass("secondary")}>
                Unarchive
              </button>
            </form>
          ) : (
            <ConfirmForm
              action={archiveClientAction}
              label="Archive"
              title={`Archive ${client.name}?`}
              description="The client is hidden from the default client list and cannot be chosen for new projects. Existing projects and invoices are kept. You can unarchive it later."
              confirmLabel="Archive client"
            >
              <input type="hidden" name="id" value={id} />
            </ConfirmForm>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <SectionCard title="Projects" count={projects.total}>
            {projects.rows.length === 0 ? (
              <p className="text-sm text-muted">No projects visible to you.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {projects.rows.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <Link href={`/projects/${p.id}`} className={linkClass}>
                      {p.projectCode} {p.name}
                    </Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {can(actor, "finance.invoices.read") ? (
            <section aria-label="Finance" className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
              <h2 className="m-0 text-base font-semibold">Finance</h2>
              {financeUnavailable ? (
                <p className="text-sm text-muted">Finance data is unavailable right now.</p>
              ) : finance && finance.outstandingByCurrency.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {finance.outstandingByCurrency.map((o) => (
                    <li key={o.currency} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="text-muted">Outstanding receivables</span>
                      <span className="font-medium tabular-nums">
                        {o.currency} {o.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No outstanding invoices.</p>
              )}
            </section>
          ) : null}

          <SectionCard title="Notes" count={notes.length}>
            {notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-background p-3">
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <p className="mt-2 text-xs text-muted">{formatDateTime(n.createdAt, tz)}</p>
                  </li>
                ))}
              </ul>
            )}
            {canUpdate ? (
              <form action={addNoteAction} className="flex w-full max-w-xl flex-col gap-3 border-t border-border pt-3">
                <input type="hidden" name="id" value={id} />
                <Field id="note" label="Add a note" hint="Visible to everyone who can open this client.">
                  <textarea id="note" name="note" required rows={3} className={inputClass} aria-describedby="note-hint" />
                </Field>
                <div>
                  <button type="submit" className={buttonClass("secondary")}>
                    Add note
                  </button>
                </div>
              </form>
            ) : null}
          </SectionCard>

          {canUpdate ? (
            <SectionCard title="Edit client">
              <ClientForm client={client} />
            </SectionCard>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <DetailsList
            items={[
              { label: "Status", value: <StatusBadge status={client.archived ? "Archived" : client.status} /> },
              { label: "Contact", value: client.contactPerson },
              { label: "Email", value: client.email ? <a href={`mailto:${client.email}`} className={linkClass}>{client.email}</a> : null },
              { label: "Phone", value: client.phone },
              { label: "Address", value: client.address ? <span className="whitespace-pre-wrap">{client.address}</span> : null },
              { label: "Service", value: client.serviceType },
              { label: "Created", value: formatDateTime(client.createdAt, tz) },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
