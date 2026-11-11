import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { expenseAttachments, expenses } from "@/db/schema";
import { audit } from "@/modules/audit";
import { expenseAttachmentSchema, type ExpenseAttachmentInput } from "./schemas";

type FinanceTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

type StoredFile = {
  id: string;
  companyId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  size: number;
};

/** Adapter contract: bind these operations to the documented @/lib/storage helpers. */
export type FinanceStorageAdapter = {
  putObject(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void>;
  getSignedUrl(input: { key: string; expiresInSeconds: number }): Promise<string>;
  deleteObject(input: { key: string }): Promise<void>;
  files: {
    create(tx: FinanceTransaction, input: {
      actor: Actor;
      companyId: string;
      storageKey: string;
      fileName: string;
      contentType: string;
      size: number;
    }): Promise<{ id: string }>;
    get(tx: FinanceTransaction, input: { actor: Actor; companyId: string; fileId: string }): Promise<StoredFile | null>;
    getMany(tx: FinanceTransaction, input: { actor: Actor; companyId: string; fileIds: string[] }): Promise<StoredFile[]>;
  };
};

export type ExpenseAttachmentDTO = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
};

export function createExpenseAttachmentService(storage: FinanceStorageAdapter) {
  return {
    async attachExpenseFile(
      actor: Actor,
      expenseId: string,
      input: ExpenseAttachmentInput,
      bytes: Uint8Array,
    ): Promise<ExpenseAttachmentDTO> {
      requirePermission(actor, "finance.expenses.update");
      const parsed = expenseAttachmentSchema.safeParse(input);
      if (!parsed.success) throw new DomainError("VALIDATION", "Expense attachment is invalid.", parsed.error.flatten());
      if (bytes.byteLength !== parsed.data.size) throw new DomainError("VALIDATION", "Uploaded file size did not match its metadata.");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expenseId)) {
        throw new DomainError("VALIDATION", "Expense ID is invalid.");
      }

      const [visibleExpense] = await db.select({ id: expenses.id }).from(expenses).where(and(
        eq(expenses.id, expenseId),
        eq(expenses.companyId, actor.companyId),
      )).limit(1);
      if (!visibleExpense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");

      const storageKey = `${actor.companyId}/finance/expenses/${randomUUID()}`;
      await storage.putObject({ key: storageKey, bytes, contentType: parsed.data.contentType });
      try {
        return await withTransaction(async (tx) => {
          const [expense] = await tx.select({ id: expenses.id }).from(expenses).where(and(
            eq(expenses.id, expenseId),
            eq(expenses.companyId, actor.companyId),
          )).limit(1).for("update");
          if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");

          const file = await storage.files.create(tx, {
            actor,
            companyId: actor.companyId,
            storageKey,
            fileName: parsed.data.fileName,
            contentType: parsed.data.contentType,
            size: parsed.data.size,
          });
          const [attachment] = await tx.insert(expenseAttachments).values({
            companyId: actor.companyId,
            expenseId,
            fileId: file.id,
            createdBy: actor.userId,
          }).returning({ id: expenseAttachments.fileId, createdAt: expenseAttachments.createdAt });
          if (!attachment) throw new DomainError("CONFLICT", "Expense attachment could not be saved.");
          await audit.record(tx, {
            actor,
            entity: "expense",
            entityId: expenseId,
            action: "expense.attachment.added",
            after: { fileId: file.id, fileName: parsed.data.fileName, size: parsed.data.size },
          });
          return {
            id: attachment.id,
            fileName: parsed.data.fileName,
            contentType: parsed.data.contentType,
            size: parsed.data.size,
            createdAt: attachment.createdAt,
          };
        });
      } catch (error) {
        await storage.deleteObject({ key: storageKey }).catch(() => undefined);
        throw error;
      }
    },

    async listExpenseFiles(actor: Actor, expenseId: string): Promise<ExpenseAttachmentDTO[]> {
      requirePermission(actor, "finance.expenses.read");
      const [expense] = await db.select({ id: expenses.id }).from(expenses).where(and(
        eq(expenses.id, expenseId),
        eq(expenses.companyId, actor.companyId),
      )).limit(1);
      if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");

      const links = await db.select({ fileId: expenseAttachments.fileId, createdAt: expenseAttachments.createdAt })
        .from(expenseAttachments).where(and(
          eq(expenseAttachments.expenseId, expenseId),
          eq(expenseAttachments.companyId, actor.companyId),
        ));
      if (links.length === 0) return [];
      const files = await withTransaction((tx) => storage.files.getMany(tx, {
        actor,
        companyId: actor.companyId,
        fileIds: links.map((link) => link.fileId),
      }));
      const fileById = new Map(files.map((file) => [file.id, file]));
      return links.flatMap((link) => {
        const file = fileById.get(link.fileId);
        if (!file || file.companyId !== actor.companyId) return [];
        return [{
          id: file.id,
          fileName: file.fileName,
          contentType: file.contentType,
          size: file.size,
          createdAt: link.createdAt,
        }];
      });
    },

    async getExpenseFileDownloadUrl(actor: Actor, expenseId: string, fileId: string): Promise<{ url: string }> {
      requirePermission(actor, "finance.expenses.read");
      const [link] = await db.select({ fileId: expenseAttachments.fileId }).from(expenseAttachments)
        .innerJoin(expenses, and(
          eq(expenses.id, expenseAttachments.expenseId),
          eq(expenses.companyId, expenseAttachments.companyId),
        )).where(and(
          eq(expenseAttachments.expenseId, expenseId),
          eq(expenseAttachments.fileId, fileId),
          eq(expenseAttachments.companyId, actor.companyId),
          eq(expenses.companyId, actor.companyId),
        )).limit(1);
      if (!link) throw new DomainError("FILE_NOT_FOUND", "Expense attachment was not found.");

      const file = await withTransaction((tx) => storage.files.get(tx, {
        actor,
        companyId: actor.companyId,
        fileId: link.fileId,
      }));
      if (!file || file.companyId !== actor.companyId) throw new DomainError("FILE_NOT_FOUND", "Expense attachment was not found.");
      return { url: await storage.getSignedUrl({ key: file.storageKey, expiresInSeconds: 300 }) };
    },
  };
}
