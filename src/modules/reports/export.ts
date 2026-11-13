import "server-only";
import { z } from "zod";
import { withTransaction } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { collect, toCsvStream, toPdf, toXlsxStream, type ExportColumn, type ExportRow } from "@/lib/export";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { exportFinanceReport, type FinanceExportAdapter, type FinanceExportRequest } from "@/modules/finance";
import { iterateReport, runReport, type ReportFilters, type ReportKey } from "./reports";

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const MIME: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const safeHeaders = (format: ExportFormat, fileName: string) => ({
  "Content-Type": MIME[format],
  "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`,
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
});

/**
 * Exports a report using the SAME query, filters and scope as the on-screen report
 * (iterateReport → runReport), and only the report's declared columns.
 */
export async function exportReport(actor: Actor, key: ReportKey, formatInput: string, filters: ReportFilters): Promise<Response> {
  requirePermission(actor, "reports.export");
  const format = z.enum(EXPORT_FORMATS).safeParse(formatInput);
  if (!format.success) throw new DomainError("VALIDATION", "Choose CSV, XLSX or PDF");
  const fmt = format.data;

  // Runs the permission/scope/validation checks (and the first page) before any bytes are sent.
  const first = await runReport(actor, key, { ...filters, page: 1, pageSize: 1 });

  await withTransaction((tx) =>
    audit.record(tx, {
      actor,
      entity: "report",
      entityId: key,
      action: "report.exported",
      after: { report: key, format: fmt, filters },
    }),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${key}-${stamp}.${fmt}`;
  const rows = iterateReport(actor, key, filters) as AsyncIterable<ExportRow>;

  if (fmt === "pdf") {
    const all: ExportRow[] = [];
    for await (const r of rows) {
      all.push(r);
      if (all.length >= 2000) break;
    }
    const pdf = await toPdf(first.title, first.columns, all, { subtitle: first.subtitle || `Generated ${stamp}` });
    return new Response(new Uint8Array(pdf), { headers: safeHeaders(fmt, fileName) });
  }
  const body = fmt === "csv" ? toCsvStream(first.columns, rows, { bom: true }) : toXlsxStream(first.columns, rows, { sheetName: first.title });
  return new Response(body, { headers: safeHeaders(fmt, fileName) });
}

/** Adapter that lets Chintan's finance export service use the shared streaming export library. */
function financeAdapter(): FinanceExportAdapter {
  const columnsFor = async (rows: AsyncIterable<Readonly<Record<string, string | number | null>>>) => {
    // Column list comes from the first row's keys, which are fixed per report by the finance service.
    const iterator = rows[Symbol.asyncIterator]();
    const first = await iterator.next();
    const keys = first.done ? [] : Object.keys(first.value);
    const columns: ExportColumn[] = keys.map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) }));
    async function* all(): AsyncGenerator<ExportRow> {
      if (!first.done) yield first.value;
      for (let n = await iterator.next(); !n.done; n = await iterator.next()) yield n.value;
    }
    return { columns, rows: all() };
  };
  const toChunks = (stream: ReadableStream<Uint8Array>) => stream as unknown as AsyncIterable<Uint8Array>;
  return {
    toCsv: (rows) => {
      async function* run() {
        const { columns, rows: r } = await columnsFor(rows);
        yield* toChunks(toCsvStream(columns, r, { bom: true }));
      }
      return run();
    },
    toXlsx: (rows) => {
      async function* run() {
        const { columns, rows: r } = await columnsFor(rows);
        yield* toChunks(toXlsxStream(columns, r, { sheetName: "Finance report" }));
      }
      return run();
    },
    streamExport: ({ body, contentType, fileName }) => {
      const iterator = body[Symbol.asyncIterator]();
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const n = await iterator.next();
          if (n.done) controller.close();
          else controller.enqueue(n.value);
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    },
  };
}

export function exportFinanceReportResponse(actor: Actor, request: FinanceExportRequest): Promise<Response> {
  return exportFinanceReport(actor, request, financeAdapter());
}

