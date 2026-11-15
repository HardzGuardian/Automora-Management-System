import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { files } from "@/db/schema";
import { readFile } from "@/modules/files";
import { workWorld, MANAGER_KEYS } from "@/test/work";
import {
  addProjectDocument,
  canAccessProjectDocument,
  docKind,
  listDocuments,
  listProjectDocuments,
  removeProjectDocument,
} from "./service";

const PDF = Buffer.from("%PDF-1.7\nhello");
const pdf = { name: "brief.pdf", mime: "application/pdf", bytes: PDF };
const txt = { name: "notes.txt", mime: "text/plain", bytes: Buffer.from("plain notes") };

async function setup() {
  const w = await workWorld([...MANAGER_KEYS, "projects.update"]);
  const member = await w.employee();
  const outsider = await w.employee();
  const project = await w.project({ members: [member.employeeId] });
  return { w, member, outsider, project };
}

const fileCount = async (companyId: string) => (await db.select().from(files).where(eq(files.companyId, companyId))).length;

describe("docKind", () => {
  it("groups mime types into the four design filters", () => {
    expect(docKind("application/pdf")).toBe("PDF");
    expect(docKind("image/png")).toBe("Images");
    expect(docKind("text/csv")).toBe("Sheets");
    expect(docKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Sheets");
    expect(docKind("text/plain")).toBe("Docs");
    expect(docKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("Docs");
  });
});

describe("addProjectDocument / listProjectDocuments", () => {
  it("adds, lists with metadata, and lets members read", async () => {
    const s = await setup();
    const doc = await addProjectDocument(s.w.manager, s.project.id, pdf);
    expect(doc).toMatchObject({ name: "brief.pdf", kind: "PDF", size: PDF.length, projectId: s.project.id });
    const list = await listProjectDocuments(s.member.actor, s.project.id);
    expect(list.map((d) => d.id)).toEqual([doc.id]);
  });

  it("needs projects.update and project visibility, storing nothing when denied", async () => {
    const s = await setup();
    const before = await fileCount(s.w.company.id);
    await expect(addProjectDocument(s.member.actor, s.project.id, pdf)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listProjectDocuments(s.outsider.actor, s.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await fileCount(s.w.company.id)).toBe(before);
  });

  it("rejects invalid files without leaving anything behind", async () => {
    const s = await setup();
    const before = await fileCount(s.w.company.id);
    await expect(addProjectDocument(s.w.manager, s.project.id, { name: "x.exe", mime: "application/octet-stream", bytes: Buffer.from("MZ") })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addProjectDocument(s.w.manager, s.project.id, { name: "x.pdf", mime: "application/pdf", bytes: Buffer.from("not a pdf") })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await fileCount(s.w.company.id)).toBe(before);
  });
});

describe("listDocuments (library)", () => {
  it("shows only documents of visible projects, filters by name/project/kind, and counts per kind", async () => {
    const s = await setup();
    const other = await s.w.project({ members: [] });
    await addProjectDocument(s.w.manager, s.project.id, pdf);
    await addProjectDocument(s.w.manager, s.project.id, txt);
    await addProjectDocument(s.w.manager, other.id, { ...pdf, name: "hidden.pdf" });

    const mine = await listDocuments(s.member.actor);
    expect(mine.rows.map((d) => d.name).sort()).toEqual(["brief.pdf", "notes.txt"]);
    expect(mine.kindCounts).toMatchObject({ All: 2, PDF: 1, Docs: 1, Sheets: 0, Images: 0 });

    expect((await listDocuments(s.member.actor, { q: "BRIEF" })).rows.map((d) => d.name)).toEqual(["brief.pdf"]);
    expect((await listDocuments(s.member.actor, { kind: "Docs" })).rows.map((d) => d.name)).toEqual(["notes.txt"]);
    expect((await listDocuments(s.member.actor, { kind: "Docs" })).kindCounts.All).toBe(2);
    expect((await listDocuments(s.w.manager, { projectId: other.id })).rows.map((d) => d.name)).toEqual(["hidden.pdf"]);
  });

  it("treats % and _ in the search as plain characters", async () => {
    const s = await setup();
    await addProjectDocument(s.w.manager, s.project.id, pdf);
    expect((await listDocuments(s.w.manager, { q: "%" })).rows).toHaveLength(0);
  });
});

describe("download access and removal", () => {
  it("lets project members download, and denies outsiders and other companies", async () => {
    const s = await setup();
    const doc = await addProjectDocument(s.w.manager, s.project.id, pdf);
    expect((await readFile(s.member.actor, doc.fileId, [canAccessProjectDocument])).name).toBe("brief.pdf");
    await expect(readFile(s.outsider.actor, doc.fileId, [canAccessProjectDocument])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await workWorld();
    await expect(readFile(other.manager, doc.fileId, [canAccessProjectDocument])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removes the document and its file, only for people who can update the project", async () => {
    const s = await setup();
    const doc = await addProjectDocument(s.w.manager, s.project.id, pdf);
    await expect(removeProjectDocument(s.member.actor, s.project.id, doc.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await removeProjectDocument(s.w.manager, s.project.id, doc.id);
    expect(await listProjectDocuments(s.w.manager, s.project.id)).toHaveLength(0);
    await expect(removeProjectDocument(s.w.manager, s.project.id, doc.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
