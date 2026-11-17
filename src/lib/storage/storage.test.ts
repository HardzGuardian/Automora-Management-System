import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sanitizeFileName, validateUpload } from "./allowlist";
import { newStorageKey } from "./keys";
import { localDriver } from "./local";

const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const MAX = 10 * 1024 * 1024;

const ok = (name: string, mime: string, bytes: Buffer) => validateUpload({ name, mime, bytes }, MAX);

describe("validateUpload", () => {
  it("accepts every allowed type with matching extension, mime and signature", () => {
    expect(ok("spec.pdf", "application/pdf", PDF).ok).toBe(true);
    expect(ok("shot.png", "image/png", PNG).ok).toBe(true);
    expect(ok("photo.JPG", "image/jpeg", JPG).ok).toBe(true);
    expect(ok("photo.jpeg", "image/jpeg", JPG).ok).toBe(true);
    expect(ok("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ZIP).ok).toBe(true);
    expect(ok("sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP).ok).toBe(true);
    expect(ok("data.csv", "text/csv", Buffer.from("a,b\n1,2\n")).ok).toBe(true);
    expect(ok("notes.txt", "text/plain", Buffer.from("hello")).ok).toBe(true);
  });

  it("rejects disallowed extensions", () => {
    for (const name of ["run.exe", "page.html", "x.svg", "x.js", "x.php", "x.sh", "x.bat", "archive.zip", "noextension"]) {
      expect(ok(name, "application/octet-stream", Buffer.from("x")).ok).toBe(false);
    }
  });

  it("rejects a mime type that does not match the extension", () => {
    expect(ok("spec.pdf", "text/html", PDF).ok).toBe(false);
    expect(ok("shot.png", "application/pdf", PNG).ok).toBe(false);
  });

  it("rejects content whose signature does not match (renamed executables)", () => {
    expect(ok("evil.pdf", "application/pdf", Buffer.from("MZ\x90\x00this is an exe")).ok).toBe(false);
    expect(ok("evil.png", "image/png", Buffer.from("<html><script>alert(1)</script>")).ok).toBe(false);
    expect(ok("evil.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.from("not a zip")).ok).toBe(false);
    expect(ok("evil.txt", "text/plain", Buffer.from([0x68, 0x00, 0x69])).ok).toBe(false); // NUL byte in text
  });

  it("rejects empty and oversized files", () => {
    expect(ok("a.txt", "text/plain", Buffer.alloc(0)).ok).toBe(false);
    expect(validateUpload({ name: "a.txt", mime: "text/plain", bytes: Buffer.alloc(11) }, 10).ok).toBe(false);
    expect(validateUpload({ name: "a.txt", mime: "text/plain", bytes: Buffer.alloc(10, 97) }, 10).ok).toBe(true);
  });

  it("treats only the final extension as the type (double extensions)", () => {
    expect(ok("report.pdf.exe", "application/pdf", PDF).ok).toBe(false);
    expect(ok("report.exe.pdf", "application/pdf", PDF).ok).toBe(true);
  });
});

describe("sanitizeFileName", () => {
  it("drops directories, control characters and overlong names", () => {
    expect(sanitizeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFileName("C:\\Users\\me\\Doc.pdf")).toBe("Doc.pdf");
    expect(sanitizeFileName("we\u0000ird\nname.pdf")).toBe("weirdname.pdf");
    expect(sanitizeFileName("a".repeat(500) + ".pdf").length).toBeLessThanOrEqual(200);
    expect(sanitizeFileName("a".repeat(500) + ".pdf").endsWith(".pdf")).toBe(true);
    expect(sanitizeFileName("   ")).toBe("file");
  });
});

describe("newStorageKey", () => {
  it("is companyId/uuid with no user-controlled text", () => {
    const company = randomUUID();
    const a = newStorageKey(company);
    const b = newStorageKey(company);
    expect(a).toMatch(new RegExp(`^${company}/[0-9a-f-]{36}$`));
    expect(a).not.toBe(b);
  });
});

describe("local driver", () => {
  it("round-trips bytes and deletes", async () => {
    const key = newStorageKey(randomUUID());
    await localDriver.put(key, PDF, "application/pdf");
    expect((await localDriver.get(key)).equals(PDF)).toBe(true);
    await localDriver.delete(key);
    await expect(localDriver.get(key)).rejects.toThrow();
    await expect(localDriver.delete(key)).resolves.toBeUndefined(); // idempotent
  });

  it("refuses keys that could escape the storage directory", async () => {
    for (const key of ["../../etc/passwd", "/abs/path", "a/b/c", "..\\x", "company/../x", ""]) {
      await expect(localDriver.get(key)).rejects.toThrow();
      await expect(localDriver.put(key, Buffer.from("x"), "text/plain")).rejects.toThrow();
    }
  });
});
