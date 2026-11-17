"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { expenseAttachmentService } from "@/modules/finance";

export type ReceiptUploadState = { error?: string; ok?: boolean };

/** Uploads a receipt/invoice scan to an expense. Validation (type, size, content signature) happens in the service. */
export async function uploadExpenseReceiptAction(_prev: ReceiptUploadState, fd: FormData): Promise<ReceiptUploadState> {
  const actor = await requireActor();
  const expenseId = z.string().uuid().safeParse(fd.get("expenseId"));
  const file = fd.get("file");
  if (!expenseId.success) return { error: "This expense could not be found." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await toActionResult(() =>
    expenseAttachmentService.attachExpenseFile(actor, expenseId.data, { fileName: file.name, contentType: file.type, size: bytes.byteLength }, bytes),
  );
  if (!r.ok) return { error: r.error.message };
  revalidatePath(`/expenses/${expenseId.data}`);
  return { ok: true };
}
