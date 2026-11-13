import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { deleteObject, putObject } from "@/lib/storage";
import { createExpenseAttachmentService, type FinanceStorageAdapter } from "./attachments";

type Row = typeof files.$inferSelect;
const toStored = (r: Row) => ({
  id: r.id,
  companyId: r.companyId,
  storageKey: r.storageKey,
  fileName: r.originalName,
  contentType: r.mimeType,
  size: r.sizeBytes,
});

/**
 * Binds the finance attachment port to the shared storage driver and the shared `files` table.
 * Downloads are served by /api/files/[id] (permission-checked via canAccessExpenseAttachment),
 * so the "signed URL" is that authenticated route rather than a public object URL.
 */
export const financeStorageAdapter: FinanceStorageAdapter = {
  putObject: ({ key, bytes, contentType }) => putObject(key, Buffer.from(bytes), contentType),
  deleteObject: ({ key }) => deleteObject(key),
  async getSignedUrl({ key }) {
    const [row] = await db.select({ id: files.id }).from(files).where(eq(files.storageKey, key)).limit(1);
    if (!row) throw new Error("Stored file not found");
    return `/api/files/${row.id}`;
  },
  files: {
    async create(tx, input) {
      const [row] = await tx
        .insert(files)
        .values({
          companyId: input.companyId,
          storageKey: input.storageKey,
          originalName: input.fileName,
          mimeType: input.contentType,
          sizeBytes: input.size,
          uploadedBy: input.actor.userId,
        })
        .returning({ id: files.id });
      return row;
    },
    async get(tx, input) {
      const [row] = await tx
        .select()
        .from(files)
        .where(and(eq(files.id, input.fileId), eq(files.companyId, input.companyId)))
        .limit(1);
      return row ? toStored(row) : null;
    },
    async getMany(tx, input) {
      if (input.fileIds.length === 0) return [];
      const rows = await tx
        .select()
        .from(files)
        .where(and(inArray(files.id, input.fileIds), eq(files.companyId, input.companyId)));
      return rows.map(toStored);
    },
  },
};

export const expenseAttachmentService = createExpenseAttachmentService(financeStorageAdapter);
