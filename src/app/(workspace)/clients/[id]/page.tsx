import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getClient, listClientNotes } from "@/modules/clients";
import { listProjects } from "@/modules/projects";
import { addNoteAction, archiveClientAction } from "../actions";
import { ClientForm } from "../client-form";

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
  const [notes, projects] = await Promise.all([
    listClientNotes(actor, id),
    listProjects(actor, { clientId: id, includeArchived: true, pageSize: 100 }),
  ]);

  return (
    <main className="flex flex-col gap-6 p-8">
      <Link href="/clients" className="text-sm underline">
        ← Clients
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="text-sm text-gray-600">
          {client.clientCode} · {client.archived ? "Archived" : client.status}
        </p>
      </header>

      {can(actor, "clients.archive") ? (
        <form action={archiveClientAction}>
          <input type="hidden" name="id" value={id} />
          {client.archived ? <input type="hidden" name="undo" value="1" /> : null}
          <button type="submit" className="rounded border border-gray-300 px-3 py-2">
            {client.archived ? "Unarchive" : "Archive"}
          </button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Projects ({projects.total})</h2>
        {projects.rows.length === 0 ? (
          <p className="text-sm text-gray-600">No projects visible to you.</p>
        ) : (
          <ul className="text-sm">
            {projects.rows.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="underline">
                  {p.projectCode} {p.name}
                </Link>{" "}
                · {p.status}
              </li>
            ))}
          </ul>
        )}
        {/* Finance tab: rendered only via @/modules/finance once it exists (D1-30). */}
      </section>

      {can(actor, "clients.update") ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Details</h2>
          <ClientForm client={client} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Notes</h2>
        {can(actor, "clients.update") ? (
          <form action={addNoteAction} className="flex max-w-md flex-col gap-2">
            <input type="hidden" name="id" value={id} />
            <textarea name="note" required rows={3} className="rounded border border-gray-300 px-3 py-2" />
            <button type="submit" className="self-start rounded bg-black px-3 py-2 text-white">
              Add note
            </button>
          </form>
        ) : null}
        <ul className="flex flex-col gap-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-gray-200 p-2">
              <p className="whitespace-pre-wrap">{n.note}</p>
              <p className="text-xs text-gray-500">{n.createdAt.toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
