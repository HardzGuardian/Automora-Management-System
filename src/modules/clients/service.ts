import "server-only";
import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { clientNotes, clients } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { nextCode } from "@/lib/codes";
import { DomainError } from "@/lib/errors";
import { clientScope, requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { toClientDTO, toNoteDTO, type ClientDTO, type ClientNoteDTO } from "./dto";
import {
  createClientSchema,
  listClientsSchema,
  noteSchema,
  updateClientSchema,
  type CreateClientInput,
  type ListClientsInput,
  type UpdateClientInput,
} from "./schemas";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Loads through scope; anything outside the actor's scope is NOT_FOUND. */
export async function loadClient(tx: Pick<Tx, "select">, actor: Actor, id: string) {
  const [row] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), clientScope(actor)));
  if (!row) throw new DomainError("NOT_FOUND", "Client not found");
  return row;
}

export async function createClient(actor: Actor, input: CreateClientInput): Promise<ClientDTO> {
  requirePermission(actor, "clients.create");
  const data = createClientSchema.parse(input);
  return withTransaction(async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({
        companyId: actor.companyId,
        clientCode: await nextCode(tx, actor.companyId, "CLI"),
        name: data.name,
        contactPerson: data.contactPerson ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        serviceType: data.serviceType ?? null,
      })
      .returning();
    const dto = toClientDTO(row);
    await audit.record(tx, { actor, entity: "client", entityId: row.id, action: "client.created", after: dto });
    return dto;
  });
}

export async function updateClient(actor: Actor, id: string, input: UpdateClientInput): Promise<ClientDTO> {
  requirePermission(actor, "clients.update");
  const patch = updateClientSchema.parse(input);
  return withTransaction(async (tx) => {
    const before = await loadClient(tx, actor, id);
    const [row] = await tx
      .update(clients)
      .set(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      .where(and(eq(clients.id, id), eq(clients.companyId, actor.companyId)))
      .returning();
    await audit.record(tx, {
      actor,
      entity: "client",
      entityId: id,
      action: "client.updated",
      before: toClientDTO(before),
      after: toClientDTO(row),
    });
    return toClientDTO(row);
  });
}

export async function getClient(actor: Actor, id: string): Promise<ClientDTO> {
  requirePermission(actor, "clients.read");
  return toClientDTO(await loadClient(db, actor, id));
}

export async function listClients(
  actor: Actor,
  input: ListClientsInput,
): Promise<{ rows: ClientDTO[]; total: number }> {
  requirePermission(actor, "clients.read");
  const f = listClientsSchema.parse(input);
  const conds: SQL[] = [clientScope(actor)];
  if (!f.includeArchived) conds.push(isNull(clients.archivedAt));
  if (f.status) conds.push(eq(clients.status, f.status));
  if (f.search) {
    const p = `%${escapeLike(f.search)}%`;
    conds.push(
      or(ilike(clients.name, p), ilike(clients.clientCode, p), ilike(clients.email, p), ilike(clients.contactPerson, p))!,
    );
  }
  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .orderBy(asc(clients.name), asc(clients.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(clients).where(where),
  ]);
  return { rows: rows.map(toClientDTO), total };
}

async function setArchived(actor: Actor, id: string, archived: boolean): Promise<ClientDTO> {
  requirePermission(actor, "clients.archive");
  return withTransaction(async (tx) => {
    const before = await loadClient(tx, actor, id);
    if ((before.archivedAt !== null) === archived) {
      throw new DomainError("CONFLICT", archived ? "Client is already archived" : "Client is not archived");
    }
    // Archive, never delete: projects, tasks and finance history stay attached.
    const [row] = await tx
      .update(clients)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(clients.id, id), eq(clients.companyId, actor.companyId)))
      .returning();
    await audit.record(tx, {
      actor,
      entity: "client",
      entityId: id,
      action: archived ? "client.archived" : "client.unarchived",
    });
    return toClientDTO(row);
  });
}

export const archiveClient = (actor: Actor, id: string) => setArchived(actor, id, true);
export const unarchiveClient = (actor: Actor, id: string) => setArchived(actor, id, false);

export async function addClientNote(actor: Actor, clientId: string, note: string): Promise<ClientNoteDTO> {
  requirePermission(actor, "clients.update");
  const text = noteSchema.parse(note);
  return withTransaction(async (tx) => {
    await loadClient(tx, actor, clientId);
    const [row] = await tx
      .insert(clientNotes)
      .values({ companyId: actor.companyId, clientId, note: text, createdBy: actor.userId })
      .returning();
    await audit.record(tx, { actor, entity: "client", entityId: clientId, action: "client.note_added" });
    return toNoteDTO(row);
  });
}

export async function listClientNotes(actor: Actor, clientId: string): Promise<ClientNoteDTO[]> {
  requirePermission(actor, "clients.read");
  await loadClient(db, actor, clientId);
  const rows = await db
    .select()
    .from(clientNotes)
    .where(and(eq(clientNotes.clientId, clientId), eq(clientNotes.companyId, actor.companyId)))
    .orderBy(desc(clientNotes.createdAt), desc(clientNotes.id));
  return rows.map(toNoteDTO);
}
