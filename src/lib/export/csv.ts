import { escapeCell, type ExportColumn, type ExportRow } from "./escape";

const BOM = "﻿";
const ROWS_PER_CHUNK = 500;

function csvCell(value: unknown): string {
  const s = escapeCell(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(columns: readonly ExportColumn[], row: ExportRow): string {
  // Only declared columns are read: the column list is the export allowlist.
  return columns.map((c) => csvCell(row[c.key])).join(",") + "\r\n";
}

const header = (columns: readonly ExportColumn[]) => columns.map((c) => csvCell(c.label)).join(",") + "\r\n";

export async function toCsv(
  columns: readonly ExportColumn[],
  rows: Iterable<ExportRow> | AsyncIterable<ExportRow>,
  opts: { bom?: boolean } = {},
): Promise<string> {
  let out = (opts.bom ? BOM : "") + header(columns);
  for await (const row of rows) out += csvLine(columns, row);
  return out;
}

/** Streams a CSV in chunks so a large export never sits in memory as one string. */
export function toCsvStream(
  columns: readonly ExportColumn[],
  rows: Iterable<ExportRow> | AsyncIterable<ExportRow>,
  opts: { bom?: boolean } = {},
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const iterator = (Symbol.asyncIterator in rows ? (rows as AsyncIterable<ExportRow>)[Symbol.asyncIterator]() : (async function* () { yield* rows as Iterable<ExportRow>; })());
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let chunk = "";
      if (!started) {
        started = true;
        chunk += (opts.bom ? BOM : "") + header(columns);
      }
      for (let i = 0; i < ROWS_PER_CHUNK; i++) {
        const { done, value } = await iterator.next();
        if (done) {
          controller.enqueue(enc.encode(chunk));
          controller.close();
          return;
        }
        chunk += csvLine(columns, value);
      }
      controller.enqueue(enc.encode(chunk));
    },
  });
}
