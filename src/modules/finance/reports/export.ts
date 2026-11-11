import "server-only";
import { withTransaction } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { audit } from "@/modules/audit";
import { getReceivablesReport } from "./receivables";
import { getExpenseRegisterReport } from "./expense-register";
import { getCashMovementReport } from "./cash-movement";
import { getFinanceReportSummary } from "./summary";
import { iterateReportPages } from "./export-pagination";
import { financeExportRequestSchema, financeReportRangeSchema, type FinanceExportRequest } from "./schemas";

export type FinanceExportRecord = Readonly<Record<string, string | number | null>>;

/** Streaming adapter port; bind to the documented toCsv/toXlsx/streamExport helpers. */
export type FinanceExportAdapter = {
  /** Must escape formula-leading strings and emit encoded chunks as rows are consumed. */
  toCsv(rows: AsyncIterable<FinanceExportRecord>): AsyncIterable<Uint8Array>;
  /** Must encode strings as text and emit XLSX chunks without buffering all report rows. */
  toXlsx(rows: AsyncIterable<FinanceExportRecord>): AsyncIterable<Uint8Array>;
  streamExport(input: {
    body: AsyncIterable<Uint8Array>;
    contentType: string;
    fileName: string;
  }): Response;
};

async function* streamReceivables(actor: Actor, range: { fromDate: string; toDate: string }): AsyncGenerator<FinanceExportRecord> {
  const rows = iterateReportPages(
    (page) => getReceivablesReport(actor, { ...range, page, pageSize: 100 }),
    (row) => row.invoiceId,
  );
  for await (const row of rows) yield {
      invoiceNumber: row.invoiceNumber,
      clientName: row.clientName,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      currency: row.currency,
      total: row.total,
      confirmedReceipts: row.confirmedReceipts,
      outstanding: row.outstanding,
      status: row.status,
    };
}

async function* streamExpenses(actor: Actor, range: { fromDate: string; toDate: string }): AsyncGenerator<FinanceExportRecord> {
  const rows = iterateReportPages(
    (page) => getExpenseRegisterReport(actor, { ...range, page, pageSize: 100 }),
    (row) => row.expenseId,
  );
  for await (const row of rows) yield {
      expenseCode: row.expenseCode,
      category: row.categoryName,
      projectId: row.projectId,
      payee: row.payee,
      description: row.description,
      expenseDate: row.expenseDate,
      dueDate: row.dueDate,
      currency: row.currency,
      total: row.total,
      confirmedPayments: row.confirmedPayments,
      outstanding: row.outstanding,
      status: row.status,
    };
}

async function* streamCashMovement(actor: Actor, range: { fromDate: string; toDate: string }): AsyncGenerator<FinanceExportRecord> {
  const rows = iterateReportPages(
    (page) => getCashMovementReport(actor, { ...range, page, pageSize: 100 }),
    (row) => `${row.date}:${row.currency}`,
  );
  for await (const row of rows) yield {
    date: row.date,
    currency: row.currency,
    confirmedReceipts: row.confirmedReceipts,
    confirmedExpensePayments: row.confirmedExpensePayments,
    netCashMovement: row.netCashMovement,
  };
}

async function* streamRows(rows: readonly FinanceExportRecord[]): AsyncGenerator<FinanceExportRecord> {
  yield* rows;
}

export async function exportFinanceReport(
  actor: Actor,
  input: FinanceExportRequest,
  adapter: FinanceExportAdapter,
): Promise<Response> {
  requirePermission(actor, "finance.reports.read");
  requirePermission(actor, "finance.reports.export");
  const parsed = financeExportRequestSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Finance export request is invalid.", parsed.error.flatten());
  const range = financeReportRangeSchema.safeParse({ fromDate: parsed.data.fromDate, toDate: parsed.data.toDate });
  if (!range.success) throw new DomainError("VALIDATION", "Finance export date range is invalid.", range.error.flatten());

  let rows: AsyncIterable<FinanceExportRecord>;
  switch (parsed.data.report) {
    case "receivables":
      rows = streamReceivables(actor, range.data);
      break;
    case "expense-register":
      rows = streamExpenses(actor, range.data);
      break;
    case "cash-movement":
      rows = streamCashMovement(actor, range.data);
      break;
    case "summary": {
      const summary = await getFinanceReportSummary(actor, range.data);
      rows = streamRows([
        ...summary.period.invoiceTotalsByCurrency.map((row) => ({ metric: "invoices_by_issue_date", ...row })),
        ...summary.period.confirmedReceiptsByCurrency.map((row) => ({ metric: "confirmed_receipts_by_payment_date", ...row })),
        ...summary.period.expenseTotalsByCurrency.map((row) => ({ metric: "expenses_by_expense_date", ...row })),
        ...summary.pointInTime.outstandingReceivablesByCurrency.map((row) => ({ metric: "outstanding_receivables_point_in_time", ...row })),
        ...summary.period.cashMovementByCurrency.map((row) => ({ metric: "cash_movement_by_payment_date", ...row })),
      ]);
      break;
    }
  }

  const fileName = `finance-${parsed.data.report}-${range.data.fromDate}-${range.data.toDate}.${parsed.data.format}`;
  const body = parsed.data.format === "csv" ? adapter.toCsv(rows) : adapter.toXlsx(rows);
  const contentType = parsed.data.format === "csv"
    ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await withTransaction(async (tx) => audit.record(tx, {
    actor,
    entity: "finance_report",
    entityId: actor.companyId,
    action: "finance.report.exported",
    after: {
      report: parsed.data.report,
      format: parsed.data.format,
      fromDate: range.data.fromDate,
      toDate: range.data.toDate,
    },
  }));
  return adapter.streamExport({ body, contentType, fileName });
}
