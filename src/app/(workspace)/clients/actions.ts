"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { addClientNote, archiveClient, createClient, deleteClientNote, editClientNote, unarchiveClient, updateClient } from "@/modules/clients";
import { flashed } from "@/lib/flash";

export type ClientFormState = { error?: string; fieldErrors?: Record<string, string[]>; saved?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function clientFields(fd: FormData) {
  return {
    name: str(fd.get("name")),
    contactPerson: str(fd.get("contactPerson")),
    email: str(fd.get("email")),
    phone: str(fd.get("phone")),
    address: str(fd.get("address")),
    serviceType: str(fd.get("serviceType")),
    ...(fd.get("status") ? { status: str(fd.get("status")) as "Active" | "Inactive" } : {}),
  };
}

export async function createClientAction(_prev: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const actor = await requireActor();
  const r = await toActionResult(() => createClient(actor, clientFields(fd)));
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/clients");
  redirect(`/clients/${r.data.id}`);
}

export async function updateClientAction(_prev: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  const r = await toActionResult(() => updateClient(actor, id, clientFields(fd)));
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath(`/clients/${id}`);
  return { saved: true };
}

export async function archiveClientAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  await flashed(() => (fd.get("undo") ? unarchiveClient(actor, id) : archiveClient(actor, id)));
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function editNoteAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  await flashed(() => editClientNote(actor, id, z.string().uuid().parse(fd.get("noteId")), str(fd.get("note"))), "Note saved.");
  revalidatePath(`/clients/${id}`);
}

export async function deleteNoteAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  await flashed(() => deleteClientNote(actor, id, z.string().uuid().parse(fd.get("noteId"))), "Note deleted.");
  revalidatePath(`/clients/${id}`);
}

export async function addNoteAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  await flashed(() => addClientNote(actor, id, str(fd.get("note"))));
  revalidatePath(`/clients/${id}`);
}
