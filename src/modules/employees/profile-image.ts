import "server-only";
import { and, eq } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import { employees } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { toAvatarJpeg } from "@/lib/storage/avatar";
import { audit } from "@/modules/audit";
import { purgeObjects, removeFileRow, saveUpload, type FileAccessChecker } from "@/modules/files";
import { loadEmployee } from "./service";

/** A person may change their own photo; changing someone else's needs employees.update. */
function assertMayChange(actor: Actor, employeeId: string): void {
  if (actor.employeeId === employeeId) return;
  if (!can(actor, "employees.update")) throw new DomainError("FORBIDDEN", "You do not have permission to do that");
}

/**
 * Replaces the employee's photo. The upload is decoded and re-encoded to a small square JPEG
 * (so any size or format of photo works, and no metadata is kept), the old photo is removed in
 * the same transaction, and the change is audited. Returns the new file id.
 */
export async function setProfileImage(
  actor: Actor,
  employeeId: string,
  input: { name: string; mime: string; bytes: Buffer },
): Promise<{ fileId: string }> {
  assertMayChange(actor, employeeId);
  if (input.bytes.length === 0) throw new DomainError("VALIDATION", "The file is empty");
  if (input.bytes.length > env.UPLOAD_MAX_BYTES) {
    throw new DomainError("VALIDATION", `The file is larger than ${Math.floor(env.UPLOAD_MAX_BYTES / (1024 * 1024))} MB`);
  }
  await loadEmployee(db, actor, employeeId); // 404 for another company's employee, before any work

  const jpeg = await toAvatarJpeg(input.bytes);
  const file = await saveUpload(actor, { name: "photo.jpg", mime: "image/jpeg", bytes: jpeg });
  try {
    const oldKey = await withTransaction(async (tx) => {
      const before = await loadEmployee(tx, actor, employeeId);
      await tx
        .update(employees)
        .set({ profileImageFileId: file.id })
        .where(and(eq(employees.id, employeeId), eq(employees.companyId, actor.companyId)));
      const key = before.profileImageFileId ? await removeFileRow(tx, actor, before.profileImageFileId).catch(() => null) : null;
      await audit.record(tx, {
        actor,
        entity: "employee",
        entityId: employeeId,
        action: "employee.profile_image_changed",
        before: { profileImageFileId: before.profileImageFileId },
        after: { profileImageFileId: file.id },
      });
      return key;
    });
    if (oldKey) await purgeObjects([oldKey]); // after commit
    return { fileId: file.id };
  } catch (e) {
    // Never leave a stored photo that nothing references.
    const key = await withTransaction((tx) => removeFileRow(tx, actor, file.id)).catch(() => null);
    if (key) await purgeObjects([key]);
    throw e;
  }
}

export async function removeProfileImage(actor: Actor, employeeId: string): Promise<void> {
  assertMayChange(actor, employeeId);
  const key = await withTransaction(async (tx) => {
    const before = await loadEmployee(tx, actor, employeeId);
    if (!before.profileImageFileId) return null;
    await tx
      .update(employees)
      .set({ profileImageFileId: null })
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, actor.companyId)));
    const storageKey = await removeFileRow(tx, actor, before.profileImageFileId).catch(() => null);
    await audit.record(tx, {
      actor,
      entity: "employee",
      entityId: employeeId,
      action: "employee.profile_image_removed",
      before: { profileImageFileId: before.profileImageFileId },
      after: { profileImageFileId: null },
    });
    return storageKey;
  });
  if (key) await purgeObjects([key]);
}

/** File access rule for profile photos: the person themselves, or anyone who may read the directory. */
export const canAccessProfileImage: FileAccessChecker = async (actor, file) => {
  if (file.companyId !== actor.companyId) return false;
  const [owner] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.profileImageFileId, file.id), eq(employees.companyId, file.companyId)));
  if (!owner) return false;
  return actor.employeeId === owner.id || can(actor, "employees.read");
};
