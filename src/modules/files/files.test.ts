import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { files } from "@/db/schema";
import { buildActor, createCompany, createUser } from "@/test/factories";
import { readFile, saveUpload, type FileAccessChecker } from "./service";

const PDF = Buffer.from("%PDF-1.7\nbody");
const allowAll: FileAccessChecker = async () => true;
const denyAll: FileAccessChecker = async () => false;

async function actorIn(companyId?: string) {
  const cid = companyId ?? (await createCompany()).id;
  const u = await createUser(cid);
  return buildActor({ companyId: cid, userId: u.id });
}

describe("saveUpload", () => {
  it("stores bytes under a server-generated key and records metadata", async () => {
    const a = await actorIn();
    const f = await saveUpload(a, { name: "../../Quarterly Report.pdf", mime: "application/pdf", bytes: PDF });
    expect(f).toMatchObject({ name: "Quarterly Report.pdf", mime: "application/pdf", size: PDF.length });
    const [row] = await db.select().from(files).where(eq(files.id, f.id));
    expect(row.storageKey).toMatch(new RegExp(`^${a.companyId}/[0-9a-f-]{36}$`));
    expect(row.storageKey).not.toContain("Quarterly");
    expect(row).toMatchObject({ uploadedBy: a.userId, originalName: "Quarterly Report.pdf", sizeBytes: PDF.length });
  });

  it("rejects invalid uploads with VALIDATION and stores nothing", async () => {
    const a = await actorIn();
    const before = (await db.select().from(files).where(eq(files.companyId, a.companyId))).length;
    await expect(saveUpload(a, { name: "evil.exe", mime: "application/octet-stream", bytes: Buffer.from("MZ") })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveUpload(a, { name: "fake.pdf", mime: "application/pdf", bytes: Buffer.from("<html>") })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveUpload(a, { name: "empty.txt", mime: "text/plain", bytes: Buffer.alloc(0) })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await db.select().from(files).where(eq(files.companyId, a.companyId))).length).toBe(before);
  });
});

describe("readFile", () => {
  it("returns the bytes when a checker grants access", async () => {
    const a = await actorIn();
    const f = await saveUpload(a, { name: "a.pdf", mime: "application/pdf", bytes: PDF });
    const r = await readFile(a, f.id, [denyAll, allowAll]);
    expect(r.bytes.equals(PDF)).toBe(true);
    expect(r).toMatchObject({ name: "a.pdf", mime: "application/pdf" });
  });

  it("is NOT_FOUND when no checker grants access (default deny) or there are no checkers", async () => {
    const a = await actorIn();
    const f = await saveUpload(a, { name: "a.pdf", mime: "application/pdf", bytes: PDF });
    await expect(readFile(a, f.id, [denyAll])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFile(a, f.id, [])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never reaches a checker for another company's file, even one that allows everything", async () => {
    const a = await actorIn();
    const b = await actorIn();
    const f = await saveUpload(a, { name: "a.pdf", mime: "application/pdf", bytes: PDF });
    let called = false;
    const spy: FileAccessChecker = async () => ((called = true), true);
    await expect(readFile(b, f.id, [spy])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(called).toBe(false);
  });

  it("is NOT_FOUND for an unknown id", async () => {
    const a = await actorIn();
    await expect(readFile(a, "00000000-0000-0000-0000-000000000000", [allowAll])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
