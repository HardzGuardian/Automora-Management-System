import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Chatter, type ChatterEntry } from "@/components/ui/chatter";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { FieldGrid, FormView, SheetTitle, SmartButtons, StatusBar } from "@/components/ui/odoo";
import { Field } from "@/components/ui/field";
import { formatDateTime } from "@/components/ui/format";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getClient, listClientNotes } from "@/modules/clients";
import { listProjects } from "@/modules/projects";
import { addNoteAction, archiveClientAction, deleteNoteAction, editNoteAction } from "../actions";
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
  // The client page lists projects only; each project's unpaid charges, invoices and tasks open in a pop-up.
  const [notes, projects] = await Promise.all([
    listClientNotes(actor, id),
    listProjects(actor, { clientId: id, includeArchived: true, pageSize: 100 }),
  ]);
  const canUpdate = can(actor, "clients.update");
  const tz = actor.timezone;

  const noteEntries: ChatterEntry[] = notes.map((n) => ({
    id: n.id,
    author: "Note",
    at: n.createdAt,
    kind: "message",
    body: n.note,
    actions: canUpdate ? (
      <details>
        <summary className="cursor-pointer text-xs font-medium text-primary-ink">Edit or delete</summary>
        <form action={editNoteAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="noteId" value={n.id} />
          <textarea name="note" required rows={3} defaultValue={n.note} aria-label="Note text" className={inputClass} />
          <div className="flex items-center gap-3">
            <button type="submit" className={buttonClass("secondary", "min-h-8 px-3 text-xs")}>
              Save note
            </button>
            <button type="submit" formAction={deleteNoteAction} formNoValidate className="text-xs font-medium text-danger hover:underline">
              Delete note
            </button>
          </div>
        </form>
      </details>
    ) : undefined,
  }));

  return (
    <FormView
      crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      actions={
        can(actor, "clients.archive") ? (
          client.archived ? (
            <form action={archiveClientAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="undo" value="1" />
              <button type="submit" className={buttonClass("secondary", "min-h-9")}>
                Unarchive
              </button>
            </form>
          ) : (
            <ConfirmForm
              action={archiveClientAction}
              label="Archive"
              triggerClassName="min-h-9"
              title={`Archive ${client.name}?`}
              description="The client is hidden from the default client list and cannot be chosen for new projects. Existing projects and invoices are kept. You can unarchive it later."
              confirmLabel="Archive client"
            >
              <input type="hidden" name="id" value={id} />
            </ConfirmForm>
          )
        ) : null
      }
      statusbar={
        <StatusBar
          label="Client status"
          stages={["Active", "Inactive", "Archived"].map((s) => ({
            key: s,
            label: s,
            state: (client.archived ? "Archived" : client.status) === s ? "current" : "todo",
          }))}
        />
      }
      chatter={
        <Chatter
          title="Notes"
          entries={noteEntries}
          timeZone={tz}
          empty="No notes yet."
          composer={
            canUpdate ? (
              <form action={addNoteAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={id} />
                <Field id="note" label="Add a note" hint="Visible to everyone who can open this client.">
                  <textarea id="note" name="note" required rows={3} className={inputClass} aria-describedby="note-hint" />
                </Field>
                <div>
                  <button type="submit" className={buttonClass("primary", "min-h-9")}>
                    Add note
                  </button>
                </div>
              </form>
            ) : undefined
          }
        />
      }
    >
      <SheetTitle
        code={client.clientCode}
        title={client.name}
        smart={<SmartButtons items={[{ icon: "projects", value: projects.total, label: projects.total === 1 ? "Project" : "Projects" }]} />}
      />
      <FieldGrid
        items={[
          { label: "Contact", value: client.contactPerson },
          { label: "Email", value: client.email ? <a href={`mailto:${client.email}`} className={linkClass}>{client.email}</a> : null },
          { label: "Phone", value: client.phone },
          { label: "Service", value: client.serviceType },
          { label: "Address", value: client.address ? <span className="whitespace-pre-wrap">{client.address}</span> : null },
          { label: "Created", value: formatDateTime(client.createdAt, tz) },
        ]}
      />

      <SectionCard title="Projects" count={projects.total} className="mt-6">
        {projects.rows.length === 0 ? (
          <p className="text-sm text-muted">No projects visible to you. Create a project for this client to start tracking its tasks and invoices.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {projects.rows.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/clients/${id}/projects/${p.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-primary/40 hover:bg-background"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{p.name}</span>
                      <span className="block text-xs text-muted">{p.projectCode}</span>
                    </span>
                    <StatusBadge status={p.status} />
                  </span>
                  <span className="text-xs text-muted">{p.dueDate ? `Due ${p.dueDate}` : "No due date"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canUpdate ? (
        <SectionCard title="Edit client" className="mt-6">
          <ClientForm client={client} />
        </SectionCard>
      ) : null}
    </FormView>
  );
}
