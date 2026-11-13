"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { removeProfileImage, setProfileImage } from "@/modules/employees";

export type PhotoState = { error?: string; ok?: boolean };

const uuid = z.string().uuid();

function refresh(employeeId: string) {
  revalidatePath("/profile");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
}

export async function uploadPhotoAction(_prev: PhotoState, fd: FormData): Promise<PhotoState> {
  const actor = await requireActor();
  const id = uuid.safeParse(fd.get("employeeId"));
  if (!id.success) return { error: "That employee could not be found." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const r = await toActionResult(() => setProfileImage(actor, id.data, { name: file.name, mime: file.type, bytes }));
  if (!r.ok) return { error: r.error.message };
  refresh(id.data);
  return { ok: true };
}

export async function removePhotoAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.safeParse(fd.get("employeeId"));
  if (!id.success) return;
  await toActionResult(() => removeProfileImage(actor, id.data));
  refresh(id.data);
}
