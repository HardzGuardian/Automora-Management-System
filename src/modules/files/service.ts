import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { files } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { deleteObject, getObject, newStorageKey, putObject, sanitizeFileName, validateUpload } from "@/lib/storage";

export type FileDTO = { id: string; name: string; mime: string; size: number; createdAt: Date };

/**
 * Decides whether the actor may read a file through its parent record (task attachment,
 * finance receipt, profile image...). Each owning module provides one; the download route
 * assembles them. Default is deny.
 */
export type FileAccessChecker = (actor: Actor, file: { id: string; companyId: string }) => Promise<boolean>;

const toDTO = (r: typeof files.$inferSelect): FileDTO => ({
  id: r.id,
  name: r.originalName,
  mime: r.mimeType,
  size: r.sizeBytes,
  createdAt: r.createdAt,
});

/**
 * Validates and stores an upload. The caller (e.g. task attachments) has already checked
 * the actor's permission on the parent record. The object key is server-generated.
 */
export async function saveUpload(
  actor: Actor,
  input: { name: string; mime: string; bytes: Buffer },
  tx: Pick<Tx, "insert"> = db,
): Promise<FileDTO> {
  const check = validateUpload(input, env.UPLOAD_MAX_BYTES);
  if (!check.ok) throw new DomainError("VALIDATION", check.reason);

  const key = newStorageKey(actor.companyId);
  await putObject(key, input.bytes, check.mime);
  try {
    const [row] = await tx
      .insert(files)
      .values({
        companyId: actor.companyId,
        storageKey: key,
        originalName: sanitizeFileName(input.name),
        mimeType: check.mime,
        sizeBytes: input.bytes.length,
        uploadedBy: actor.userId,
      })
      .returning();
    return toDTO(row);
  } catch (e) {
    await deleteObject(key).catch(() => undefined); // no orphaned object if the row failed
    throw e;
  }
}

export async function readFile(
  actor: Actor,
  fileId: string,
  checkers: readonly FileAccessChecker[],
): Promise<{ bytes: Buffer; name: string; mime: string }> {
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.companyId, actor.companyId)));
  if (!row) throw new DomainError("NOT_FOUND", "File not found");

  let allowed = false;
  for (const check of checkers) {
    if (await check(actor, { id: row.id, companyId: row.companyId })) {
      allowed = true;
      break;
    }
  }
  if (!allowed) throw new DomainError("NOT_FOUND", "File not found");
  return { bytes: await getObject(row.storageKey), name: row.originalName, mime: row.mimeType };
}

/** Removes the metadata row inside the caller's transaction; returns the key to purge after commit. */
export async function removeFileRow(tx: Tx, actor: Actor, fileId: string): Promise<string> {
  const [row] = await tx
    .delete(files)
    .where(and(eq(files.id, fileId), eq(files.companyId, actor.companyId)))
    .returning({ key: files.storageKey });
  if (!row) throw new DomainError("NOT_FOUND", "File not found");
  return row.key;
}

export async function purgeObjects(keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => undefined)));
}
