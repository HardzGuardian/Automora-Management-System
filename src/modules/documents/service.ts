import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, type SQL } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import { files, projectDocuments, projects, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requirePermission, projectScope } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { purgeObjects, removeFileRow, saveUpload, type FileAccessChecker } from "@/modules/files";
import { loadProject, notifyProjectMembers } from "@/modules/projects";

/** The four groups the Documents screen filters by. */
export const DOC_KINDS = ["PDF", "Docs", "Sheets", "Images"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export function docKind(mime: string): DocKind {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Images";
  if (mime === "text/csv" || mime === "application/vnd.ms-excel" || mime.includes("spreadsheetml")) return "Sheets";
  return "Docs";
}

const KIND_MIMES: Record<DocKind, (c: SQL | undefined) => SQL | undefined> = {
  PDF: () => eq(files.mimeType, "application/pdf"),
  Images: () => ilike(files.mimeType, "image/%"),
  Sheets: () => inArray(files.mimeType, ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  Docs: () =>
    inArray(files.mimeType, ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
};

export type DocumentDTO = {
  id: string;
  fileId: string;
  name: string;
  mime: string;
  kind: DocKind;
  size: number;
  projectId: string;
  projectName: string;
  uploadedByName: string | null;
  createdAt: Date;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const selection = {
  id: projectDocuments.id,
  fileId: files.id,
  name: files.originalName,
  mime: files.mimeType,
  size: files.sizeBytes,
  projectId: projects.id,
  projectName: projects.name,
  uploadedByName: user.name,
  createdAt: projectDocuments.createdAt,
};

const toDTO = (r: Omit<DocumentDTO, "kind">): DocumentDTO => ({ ...r, kind: docKind(r.mime) });

/** The library: every document of every project the actor can see. Counts ignore the kind filter so the pills stay stable. */
export async function listDocuments(
  actor: Actor,
  input: { q?: string; projectId?: string; kind?: DocKind } = {},
): Promise<{ rows: DocumentDTO[]; kindCounts: Record<"All" | DocKind, number> }> {
  const base: SQL[] = [eq(projectDocuments.companyId, actor.companyId), projectScope(actor), isNull(projects.archivedAt)];
  if (input.q?.trim()) base.push(ilike(files.originalName, `%${escapeLike(input.q.trim())}%`));
  if (input.projectId) base.push(eq(projects.id, input.projectId));

  const from = () =>
    db
      .select(selection)
      .from(projectDocuments)
      .innerJoin(files, and(eq(files.id, projectDocuments.fileId), eq(files.companyId, projectDocuments.companyId)))
      .innerJoin(projects, and(eq(projects.id, projectDocuments.projectId), eq(projects.companyId, projectDocuments.companyId)))
      .leftJoin(user, eq(user.id, files.uploadedBy));

  const rows = await from()
    .where(and(...base, input.kind ? KIND_MIMES[input.kind](undefined) : undefined))
    .orderBy(desc(projectDocuments.createdAt), desc(projectDocuments.id))
    .limit(200);

  const all = await from().where(and(...base)).limit(1000);
  const kindCounts = { All: all.length, PDF: 0, Docs: 0, Sheets: 0, Images: 0 };
  for (const r of all) kindCounts[docKind(r.mime)]++;
  return { rows: rows.map(toDTO), kindCounts };
}

export async function listProjectDocuments(actor: Actor, projectId: string): Promise<DocumentDTO[]> {
  await loadProject(db, actor, projectId);
  const rows = await db
    .select(selection)
    .from(projectDocuments)
    .innerJoin(files, and(eq(files.id, projectDocuments.fileId), eq(files.companyId, projectDocuments.companyId)))
    .innerJoin(projects, and(eq(projects.id, projectDocuments.projectId), eq(projects.companyId, projectDocuments.companyId)))
    .leftJoin(user, eq(user.id, files.uploadedBy))
    .where(and(eq(projectDocuments.projectId, projectId), eq(projectDocuments.companyId, actor.companyId)))
    .orderBy(desc(projectDocuments.createdAt), desc(projectDocuments.id));
  return rows.map(toDTO);
}

export async function countProjectDocuments(actor: Actor): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(projectDocuments)
    .innerJoin(projects, and(eq(projects.id, projectDocuments.projectId), eq(projects.companyId, projectDocuments.companyId)))
    .where(and(eq(projectDocuments.companyId, actor.companyId), projectScope(actor)));
  return r.n;
}

/** Admins and managers (projects.update) add documents; the project must be visible and not archived. */
export async function addProjectDocument(
  actor: Actor,
  projectId: string,
  input: { name: string; mime: string; bytes: Buffer },
): Promise<DocumentDTO> {
  requirePermission(actor, "projects.update");
  // Authorise and check the project BEFORE any bytes are stored.
  const pre = await loadProject(db, actor, projectId);
  if (pre.archivedAt) throw new DomainError("VALIDATION", "Archived projects cannot receive documents");

  const file = await saveUpload(actor, input); // validates type, size and signature
  try {
    const id = await withTransaction(async (tx) => {
      await loadProject(tx, actor, projectId);
      const [row] = await tx
        .insert(projectDocuments)
        .values({ companyId: actor.companyId, projectId, fileId: file.id })
        .returning({ id: projectDocuments.id });
      await audit.record(tx, {
        actor,
        entity: "project",
        entityId: projectId,
        action: "project.document_added",
        after: { documentId: row.id, name: file.name },
      });
      return row.id;
    });
    await notifyProjectMembers(actor, projectId, {
      type: "document.added",
      title: `New document: ${file.name}`,
      body: pre.name,
      eventKey: `project:${projectId}:document:${id}`,
    });
    return toDTO({
      id,
      fileId: file.id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      projectId,
      projectName: pre.name,
      uploadedByName: null,
      createdAt: file.createdAt,
    });
  } catch (e) {
    // Compensate: never leave a stored file that nothing references.
    const key = await withTransaction((tx) => removeFileRow(tx, actor, file.id)).catch(() => null);
    if (key) await purgeObjects([key]);
    throw e;
  }
}

export async function removeProjectDocument(actor: Actor, projectId: string, documentId: string): Promise<void> {
  requirePermission(actor, "projects.update");
  const key = await withTransaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    const [row] = await tx
      .select({ fileId: projectDocuments.fileId, name: files.originalName })
      .from(projectDocuments)
      .innerJoin(files, and(eq(files.id, projectDocuments.fileId), eq(files.companyId, projectDocuments.companyId)))
      .where(and(eq(projectDocuments.id, documentId), eq(projectDocuments.projectId, projectId), eq(projectDocuments.companyId, actor.companyId)));
    if (!row) throw new DomainError("NOT_FOUND", "Document not found");
    await tx.delete(projectDocuments).where(eq(projectDocuments.id, documentId));
    const storageKey = await removeFileRow(tx, actor, row.fileId);
    await audit.record(tx, {
      actor,
      entity: "project",
      entityId: projectId,
      action: "project.document_removed",
      before: { documentId, name: row.name },
    });
    return storageKey;
  });
  await purgeObjects([key]); // after commit
}

/** File access rule: whoever can see the project can download its documents. */
export const canAccessProjectDocument: FileAccessChecker = async (actor, file) => {
  const [hit] = await db
    .select({ id: projectDocuments.id })
    .from(projectDocuments)
    .innerJoin(projects, and(eq(projects.id, projectDocuments.projectId), eq(projects.companyId, projectDocuments.companyId)))
    .where(and(eq(projectDocuments.fileId, file.id), eq(projectDocuments.companyId, file.companyId), projectScope(actor)));
  return Boolean(hit);
};
