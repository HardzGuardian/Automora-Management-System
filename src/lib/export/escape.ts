export type ExportColumn = {
  key: string;
  label: string;
  /** "number" cells are written as numbers in XLSX when the value is numeric. Default "text". */
  type?: "text" | "number";
};
export type ExportRow = Record<string, unknown>;

const NUMERIC = /^[+-]?\d+(\.\d+)?$/;

/**
 * Spreadsheet formula-injection defence: a cell that starts with = + - @ (or a tab/CR) is
 * prefixed with an apostrophe so Excel/Sheets treat it as text. Genuine numbers such as
 * "-1500.50" are left alone.
 */
export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  const s = typeof value === "string" ? value : String(value);
  if (s === "" || NUMERIC.test(s)) return s;
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export async function collect<T>(source: Iterable<T> | AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}
