const ZIP_END = 0x06054b50;
const ZIP_ENTRY = 0x02014b50;

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function hasPrefix(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return false;
  const tail = new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - 1024)));
  return tail.includes("%%EOF");
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 24
    && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    && readUint32BigEndian(bytes, 8) === 13
    && new TextDecoder().decode(bytes.slice(12, 16)) === "IHDR"
    && readUint32BigEndian(bytes, 16) > 0
    && readUint32BigEndian(bytes, 20) > 0;
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && hasPrefix(bytes, [0xff, 0xd8, 0xff])
    && bytes[bytes.length - 2] === 0xff
    && bytes[bytes.length - 1] === 0xd9;
}

function zipEntryNames(bytes: Uint8Array): Set<string> | null {
  const searchStart = Math.max(0, bytes.length - 65_557);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (readUint32(bytes, offset) === ZIP_END) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0 || endOffset + 22 > bytes.length) return null;

  const disk = readUint16(bytes, endOffset + 4);
  const directoryDisk = readUint16(bytes, endOffset + 6);
  const entriesOnDisk = readUint16(bytes, endOffset + 8);
  const entriesTotal = readUint16(bytes, endOffset + 10);
  const directorySize = readUint32(bytes, endOffset + 12);
  const directoryOffset = readUint32(bytes, endOffset + 16);
  if (disk !== 0 || directoryDisk !== 0 || entriesOnDisk !== entriesTotal || entriesTotal === 0xffff) return null;
  if (directoryOffset + directorySize > endOffset) return null;

  const names = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = directoryOffset;
  try {
    for (let index = 0; index < entriesTotal; index += 1) {
      if (offset + 46 > endOffset || readUint32(bytes, offset) !== ZIP_ENTRY) return null;
      const nameLength = readUint16(bytes, offset + 28);
      const extraLength = readUint16(bytes, offset + 30);
      const commentLength = readUint16(bytes, offset + 32);
      const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
      if (nextOffset > endOffset) return null;
      names.add(decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)));
      offset = nextOffset;
    }
  } catch {
    return null;
  }
  return offset === directoryOffset + directorySize ? names : null;
}

function hasOfficeDocumentSignature(bytes: Uint8Array, documentPath: string): boolean {
  const names = zipEntryNames(bytes);
  return names !== null
    && names.has("[Content_Types].xml")
    && names.has("_rels/.rels")
    && names.has(documentPath);
}

function isUtf8Text(bytes: Uint8Array): boolean {
  try {
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content);
  } catch {
    return false;
  }
}

/** Verify file content independently from caller-provided filename and MIME metadata. */
export function isAllowedAttachmentContent(fileName: string, bytes: Uint8Array): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf": return hasPdfSignature(bytes);
    case "png": return hasPngSignature(bytes);
    case "jpg":
    case "jpeg": return hasJpegSignature(bytes);
    case "docx": return hasOfficeDocumentSignature(bytes, "word/document.xml");
    case "xlsx": return hasOfficeDocumentSignature(bytes, "xl/workbook.xml");
    case "csv":
    case "txt": return isUtf8Text(bytes);
    default: return false;
  }
}
