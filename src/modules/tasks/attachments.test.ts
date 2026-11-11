import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { files, taskActivityLogs } from "@/db/schema";
import { readFile } from "@/modules/files";
import { workWorld } from "@/test/work";
import { attachToTask, canAccessTaskAttachment, listAttachments, removeAttachment } from "./attachments";
import { archiveTask, createTask } from "./service";

const PDF = Buffer.from("%PDF-1.7\nhello");
const upload = { name: "spec.pdf", mime: "application/pdf", bytes: PDF };

async function setup() {
  const w = await workWorld();
  const a = await w.employee();
  const b = await w.employee();
  const outsider = await w.employee();
  const t = await createTask(w.manager, { title: "Files", assigneeIds: [a.employeeId, b.employeeId] });
  return { w, a, b, outsider, t };
}

const fileCount = async (companyId: string) => (await db.select().from(files).where(eq(files.companyId, companyId))).length;

describe("attachToTask / listAttachments", () => {
  it("attaches, lists with metadata and logs the activity", async () => {
    const s = await setup();
    const att = await attachToTask(s.a.actor, s.t.id, upload);
    expect(att).toMatchObject({ name: "spec.pdf", mime: "application/pdf", size: PDF.length, uploadedBy: s.a.userId });
    const list = await listAttachments(s.b.actor, s.t.id);
    expect(list.map((x) => x.id)).toEqual([att.id]);
    const logs = await db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, s.t.id));
    expect(logs.map((l) => l.action)).toContain("attachment_added");
  });

  it("requires tasks.attach and task visibility, storing nothing when denied", async () => {
    const s = await setup();
    const noPerm = await s.w.employee(["tasks.comment"]);
    const t2 = await createTask(s.w.manager, { title: "x", assigneeIds: [noPerm.employeeId] });
    const before = await fileCount(s.w.company.id);
    await expect(attachToTask(noPerm.actor, t2.id, upload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(attachToTask(s.outsider.actor, s.t.id, upload)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listAttachments(s.outsider.actor, s.t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await fileCount(s.w.company.id)).toBe(before);
  });

  it("rejects invalid files and archived tasks without leaving files behind", async () => {
    const s = await setup();
    const before = await fileCount(s.w.company.id);
    await expect(attachToTask(s.a.actor, s.t.id, { name: "x.exe", mime: "application/octet-stream", bytes: Buffer.from("MZ") })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(attachToTask(s.a.actor, s.t.id, { name: "x.pdf", mime: "application/pdf", bytes: Buffer.from("not a pdf") })).rejects.toMatchObject({ code: "VALIDATION" });
    await archiveTask(s.w.manager, s.t.id);
    await expect(attachToTask(s.a.actor, s.t.id, upload)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await fileCount(s.w.company.id)).toBe(before);
  });
});

describe("download access (AC-02 files half)", () => {
  it("lets task participants download and denies out-of-scope users and other companies", async () => {
    const s = await setup();
    const att = await attachToTask(s.a.actor, s.t.id, upload);
    const got = await readFile(s.b.actor, att.fileId, [canAccessTaskAttachment]);
    expect(got.bytes.equals(PDF)).toBe(true);
    expect((await readFile(s.w.manager, att.fileId, [canAccessTaskAttachment])).name).toBe("spec.pdf");
    await expect(readFile(s.outsider.actor, att.fileId, [canAccessTaskAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await workWorld();
    await expect(readFile(other.manager, att.fileId, [canAccessTaskAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("denies access to files that are not task attachments", async () => {
    const s = await setup();
    const { saveUpload } = await import("@/modules/files");
    const orphan = await saveUpload(s.w.manager, upload);
    await expect(readFile(s.w.manager, orphan.id, [canAccessTaskAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("inherits task visibility: project members can see attachments of project tasks", async () => {
    const s = await setup();
    const member = await s.w.employee();
    const p = await s.w.project({ members: [member.employeeId] });
    const t = await createTask(s.w.manager, { title: "proj", projectId: p.id });
    const att = await attachToTask(s.w.manager, t.id, upload);
    expect((await readFile(member.actor, att.fileId, [canAccessTaskAttachment])).bytes.length).toBe(PDF.length);
  });
});

describe("removeAttachment", () => {
  it("lets the uploader or a manager remove it, deleting the file and the object", async () => {
    const s = await setup();
    const mine = await attachToTask(s.a.actor, s.t.id, upload);
    const theirs = await attachToTask(s.b.actor, s.t.id, upload);
    await expect(removeAttachment(s.a.actor, s.t.id, theirs.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await removeAttachment(s.a.actor, s.t.id, mine.id);
    await removeAttachment(s.w.manager, s.t.id, theirs.id);
    expect(await listAttachments(s.w.manager, s.t.id)).toEqual([]);
    await expect(readFile(s.w.manager, mine.fileId, [async () => true])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const logs = await db.select().from(taskActivityLogs).where(eq(taskActivityLogs.taskId, s.t.id));
    expect(logs.filter((l) => l.action === "attachment_removed")).toHaveLength(2);
  });

  it("is NOT_FOUND for unknown or out-of-scope attachments", async () => {
    const s = await setup();
    const att = await attachToTask(s.a.actor, s.t.id, upload);
    await expect(removeAttachment(s.outsider.actor, s.t.id, att.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(removeAttachment(s.w.manager, s.t.id, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
