import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { escapeCell, type ExportColumn, type ExportRow } from "./escape";

type Source = Iterable<ExportRow> | AsyncIterable<ExportRow>;
const NUMERIC = /^[+-]?\d+(\.\d+)?$/;

function cellValue(col: ExportColumn, raw: unknown): string | number {
  if (col.type === "number" && (typeof raw === "number" || (typeof raw === "string" && NUMERIC.test(raw)))) return Number(raw);
  // Strings are always written as text cells (never formulas) and carry the injection prefix.
  return escapeCell(raw);
}

function rowValues(columns: readonly ExportColumn[], row: ExportRow): (string | number)[] {
  return columns.map((c) => cellValue(c, row[c.key]));
}

export async function toXlsx(
  columns: readonly ExportColumn[],
  rows: Source,
  opts: { sheetName?: string } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((opts.sheetName ?? "Report").slice(0, 31));
  ws.addRow(columns.map((c) => c.label)).font = { bold: true };
  for await (const row of rows) ws.addRow(rowValues(columns, row));
  ws.columns.forEach((c) => (c.width = 18));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Streaming XLSX for large exports: rows are committed as they arrive. */
export function toXlsxStream(columns: readonly ExportColumn[], rows: Source, opts: { sheetName?: string } = {}): ReadableStream<Uint8Array> {
  const pass = new PassThrough();
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: false, useSharedStrings: false });
  const ws = wb.addWorksheet((opts.sheetName ?? "Report").slice(0, 31));
  void (async () => {
    try {
      ws.addRow(columns.map((c) => c.label)).commit();
      for await (const row of rows) ws.addRow(rowValues(columns, row)).commit();
      ws.commit();
      await wb.commit();
    } catch (e) {
      pass.destroy(e instanceof Error ? e : new Error("export failed"));
    }
  })();
  return Readable.toWeb(pass) as unknown as ReadableStream<Uint8Array>;
}
