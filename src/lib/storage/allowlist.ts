type Sniff = (b: Buffer) => boolean;

const startsWith = (sig: number[]): Sniff => (b) => b.length >= sig.length && sig.every((v, i) => b[i] === v);
const isText: Sniff = (b) => !b.subarray(0, 8192).includes(0);

type Rule = { mimes: readonly string[]; canonical: string; sniff: Sniff };

// Allowed uploads (open decision #9 default): 10 MB; pdf, png, jpg, docx, xlsx, csv, txt.
// Extension, declared MIME type and the file's actual signature must all agree.
const RULES: Readonly<Record<string, Rule>> = {
  pdf: { mimes: ["application/pdf"], canonical: "application/pdf", sniff: startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]) },
  png: { mimes: ["image/png"], canonical: "image/png", sniff: startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { mimes: ["image/jpeg"], canonical: "image/jpeg", sniff: startsWith([0xff, 0xd8, 0xff]) },
  jpeg: { mimes: ["image/jpeg"], canonical: "image/jpeg", sniff: startsWith([0xff, 0xd8, 0xff]) },
  docx: {
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    canonical: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sniff: startsWith([0x50, 0x4b, 0x03, 0x04]),
  },
  xlsx: {
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    canonical: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sniff: startsWith([0x50, 0x4b, 0x03, 0x04]),
  },
  csv: { mimes: ["text/csv", "application/vnd.ms-excel"], canonical: "text/csv", sniff: isText },
  txt: { mimes: ["text/plain"], canonical: "text/plain", sniff: isText },
};

export type UploadCheck = { ok: true; ext: string; mime: string } | { ok: false; reason: string };

export function validateUpload(file: { name: string; mime: string; bytes: Buffer }, maxBytes: number): UploadCheck {
  if (file.bytes.length === 0) return { ok: false, reason: "The file is empty" };
  if (file.bytes.length > maxBytes) {
    return { ok: false, reason: `The file is larger than ${Math.floor(maxBytes / (1024 * 1024))} MB` };
  }
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  const rule = RULES[ext];
  if (!rule) return { ok: false, reason: "This file type is not allowed" };
  const mime = file.mime.split(";")[0].trim().toLowerCase();
  if (!rule.mimes.includes(mime)) return { ok: false, reason: "The file type does not match its extension" };
  if (!rule.sniff(file.bytes)) return { ok: false, reason: "The file content does not match its type" };
  return { ok: true, ext, mime: rule.canonical };
}

/** Display name only (never used to build a storage key): no directories, no control characters. */
export function sanitizeFileName(raw: string): string {
  const noControl = raw.replace(/[\u0000-\u001f\u007f]/g, "");
  const last = noControl.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (last === "" || /^\.+$/.test(last)) return "file";
  if (last.length <= 200) return last;
  const dot = last.lastIndexOf(".");
  const ext = dot > 0 && last.length - dot <= 10 ? last.slice(dot) : "";
  return last.slice(0, 200 - ext.length) + ext;
}
