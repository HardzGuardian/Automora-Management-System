import type { clientNotes, clients } from "@/db/schema";

export type ClientDTO = {
  id: string;
  clientCode: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  serviceType: string | null;
  status: string;
  archived: boolean;
  createdAt: Date;
};

export type ClientNoteDTO = { id: string; note: string; createdBy: string | null; createdAt: Date };

export function toClientDTO(r: typeof clients.$inferSelect): ClientDTO {
  return {
    id: r.id,
    clientCode: r.clientCode,
    name: r.name,
    contactPerson: r.contactPerson,
    email: r.email,
    phone: r.phone,
    address: r.address,
    serviceType: r.serviceType,
    status: r.status,
    archived: r.archivedAt !== null,
    createdAt: r.createdAt,
  };
}

export function toNoteDTO(r: typeof clientNotes.$inferSelect): ClientNoteDTO {
  return { id: r.id, note: r.note, createdBy: r.createdBy, createdAt: r.createdAt };
}
