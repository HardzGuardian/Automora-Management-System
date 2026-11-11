import { describe, expect, it } from "vitest";
import { isAllowedAttachmentContent } from "./attachment-content";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("attachment content validation", () => {
  it("requires PDF, PNG, and JPEG content signatures", () => {
    expect(isAllowedAttachmentContent("receipt.pdf", bytes("%PDF-1.7\n%%EOF"))).toBe(true);
    expect(isAllowedAttachmentContent("receipt.pdf", bytes("not a PDF"))).toBe(false);
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    png[19] = 1;
    png[23] = 1;
    expect(isAllowedAttachmentContent("receipt.png", png)).toBe(true);
    expect(isAllowedAttachmentContent("receipt.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(true);
  });

  it("accepts UTF-8 text and rejects binary control characters", () => {
    expect(isAllowedAttachmentContent("items.csv", bytes("description,total\nService,25.00\n"))).toBe(true);
    expect(isAllowedAttachmentContent("items.csv", new Uint8Array([0x61, 0x00, 0x62]))).toBe(false);
    expect(isAllowedAttachmentContent("items.csv", new Uint8Array([0xff, 0xfe]))).toBe(false);
  });

  it("rejects ZIP files without the expected Office document entries", () => {
    expect(isAllowedAttachmentContent("invoice.docx", bytes("PK\\x03\\x04"))).toBe(false);
    expect(isAllowedAttachmentContent("report.xlsx", bytes("PK\\x03\\x04"))).toBe(false);
  });
});
