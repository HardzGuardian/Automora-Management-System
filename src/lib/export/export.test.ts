import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { collect, escapeCell, toCsv, toCsvStream, toPdf, toXlsx, type ExportColumn } from "./index";

const cols: ExportColumn[] = [
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "note", label: "Note" },
];

describe("escapeCell (formula injection)", () => {
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "=HYPERLINK(\"http://evil\")", "\t=1", "\r=1"])("prefixes %j", (v) => {
    expect(escapeCell(v)).toBe(`'${v}`);
  });
  it("leaves ordinary text, numbers, empty and null alone", () => {
    expect(escapeCell("Hello")).toBe("Hello");
    expect(escapeCell("a=b")).toBe("a=b");
    expect(escapeCell(42)).toBe("42");
    expect(escapeCell(null)).toBe("");
    expect(escapeCell(undefined)).toBe("");
    expect(escapeCell("")).toBe("");
  });
  it("does not mangle genuine negative or signed numbers", () => {
    expect(escapeCell("-1500.50")).toBe("-1500.50");
    expect(escapeCell("+12")).toBe("+12");
  });
  it("formats dates as ISO strings", () => {
    expect(escapeCell(new Date("2026-03-10T00:00:00Z"))).toBe("2026-03-10T00:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("writes a header, quotes commas, quotes and newlines, and uses CRLF", async () => {
    const out = await toCsv(cols, [
      { name: "Acme, Inc.", amount: "10.00", note: 'He said "hi"' },
      { name: "Line\nbreak", amount: 5, note: null },
    ]);
    expect(out).toBe('Name,Amount,Note\r\n"Acme, Inc.",10.00,"He said ""hi"""\r\n"Line\nbreak",5,\r\n');
  });

  it("neutralises formula injection in every cell, including quoted ones", async () => {
    const out = await toCsv(cols, [{ name: "=cmd|' /C calc'!A0", amount: "1", note: '@SUM("x"),=1' }]);
    expect(out).toContain("'=cmd|' /C calc'!A0");
    expect(out).toContain(`"'@SUM(""x""),=1"`);
  });

  it("exports only the declared columns (allowlist), ignoring other fields", async () => {
    const out = await toCsv(cols, [{ name: "A", amount: 1, note: "n", passwordHash: "secret", internalId: 7 } as never]);
    expect(out).not.toContain("secret");
    expect(out).not.toContain("internalId");
    expect(out.split("\r\n")[0]).toBe("Name,Amount,Note");
  });

  it("streams large exports from an async source without materialising them", async () => {
    async function* rows() {
      for (let i = 0; i < 25_000; i++) yield { name: `Row ${i}`, amount: i, note: "x" };
    }
    const stream = toCsvStream(cols, rows());
    const reader = stream.getReader();
    let chunks = 0;
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks++;
      bytes += value.length;
    }
    expect(chunks).toBeGreaterThan(10);
    expect(bytes).toBeGreaterThan(25_000 * 10);
  });

  it("can prepend a BOM for Excel", async () => {
    expect((await toCsv(cols, [], { bom: true })).charCodeAt(0)).toBe(0xfeff);
  });
});

describe("toXlsx", () => {
  async function read(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    return wb.worksheets[0];
  }

  it("writes a header and typed rows", async () => {
    const ws = await read(await toXlsx(cols, [{ name: "A", amount: 12.5, note: "n" }], { sheetName: "Report" }));
    expect(ws.name).toBe("Report");
    expect(ws.getRow(1).values).toEqual([undefined, "Name", "Amount", "Note"]);
    expect(ws.getRow(2).getCell(2).value).toBe(12.5);
  });

  it("stores formula-looking strings as text, never as formulas", async () => {
    const ws = await read(await toXlsx(cols, [{ name: "=1+1", amount: "1", note: "@SUM(A1)" }]));
    const a = ws.getRow(2).getCell(1);
    expect(typeof a.value).toBe("string");
    expect(a.value).toBe("'=1+1");
    expect(a.formula).toBeUndefined();
    expect(ws.getRow(2).getCell(3).value).toBe("'@SUM(A1)");
  });

  it("exports only declared columns", async () => {
    const ws = await read(await toXlsx(cols, [{ name: "A", amount: 1, note: "n", secret: "s" } as never]));
    expect(ws.columnCount).toBe(3);
  });
});

describe("toPdf", () => {
  it("produces a PDF document with a title", async () => {
    const buf = await toPdf("Task register", cols, [{ name: "A", amount: "1.00", note: "n" }], { subtitle: "1 Jan – 31 Jan" });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
  });
});

describe("collect", () => {
  it("drains sync and async sources", async () => {
    expect(await collect([1, 2])).toEqual([1, 2]);
    expect(
      await collect(
        (async function* () {
          yield 1;
          yield 2;
        })(),
      ),
    ).toEqual([1, 2]);
  });
});

describe("toXlsxStream", () => {
  it("streams a workbook that opens and contains every row", async () => {
    const { toXlsxStream } = await import("./index");
    async function* rows() {
      for (let i = 0; i < 3000; i++) yield { name: i === 0 ? "=EVIL()" : `Row ${i}`, amount: i, note: "n" };
    }
    const reader = toXlsxStream(cols, rows()).getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(parts) as never);
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(3001);
    expect(ws.getRow(2).getCell(1).value).toBe("'=EVIL()");
    expect(ws.getRow(3001).getCell(2).value).toBe(2999);
  });
});
