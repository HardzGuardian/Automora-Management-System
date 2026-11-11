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
import { financeExportRequestSchema, financeReportRangeSchema, type FinanceExportRequest } from "./schemas";

export type FinanceExportRecord = Readonly<Record<string, string | number | null>>;

/** Adapter port; bind to the documented toCsv/toXlsx/streamExport helpers. */
export type FinanceExportAdapter = {
  /** Must apply the documented formula-injection escaping to all string cells. */
  toCsv(rows: readonly FinanceExportRecord[]): string;
  /** Must encode string cells as text, never as formulas. */
  toXlsx(rows: readonly FinanceExportRecord[]): Promise<Uint8Array>;
  streamExport(input: {
    body: string | Uint8Array;
    contentType: string;
    fileName: string;
  }): Response;
};

async function loadAllReceivables(actor: Actor, range: { fromDate: string; toDate: string }): Promise<FinanceExportRecord[]> {
  const first = await getReceivablesReport(actor, { ...range, page: 1, pageSize: 100 });
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total; page += 1) {
    const next = await getReceivablesReport(actor, { ...range, page, pageSize: 100 });
    rows.push(...next.rows);
  }
  return rows.map((row) => ({
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    currency: row.currency,
    total: row.total,
    confirmedReceipts: row.confirmedReceipts,
    outstanding: row.outstanding,
    status: row.status,
  }));
}

async function loadAllExpenses(actor: Actor, range: { fromDate: string; toDate: string }): Promise<FinanceExportRecord[]> {
  const first = await getExpenseRegisterReport(actor, { ...range, page: 1, pageSize: 100 });
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total; page += 1) {
    const next = await getExpenseRegisterReport(actor, { ...range, page, pageSize: 100 });
    rows.push(...next.rows);
  }
  return rows.map((row) => ({
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
  }));
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

  let rows: FinanceExportRecord[];
  switch (parsed.data.report) {
    case "receivables":
      rows = await loadAllReceivables(actor, range.data);
      break;
    case "expense-register":
      rows = await loadAllExpenses(actor, range.data);
      break;
    case "cash-movement": {
      const first = await getCashMovementReport(actor, { ...range.data, page: 1, pageSize: 100 });
      const combined = [...first.rows];
      for (let page = 2; combined.length < first.total; page += 1) {
        const next = await getCashMovementReport(actor, { ...range.data, page, pageSize: 100 });
        combined.push(...next.rows);
      }
      rows = combined.map((row) => ({
        date: row.date,
        currency: row.currency,
        confirmedReceipts: row.confirmedReceipts,
        confirmedExpensePayments: row.confirmedExpensePayments,
        netCashMovement: row.netCashMovement,
      }));
      break;
    }
    case "summary": {
      const summary = await getFinanceReportSummary(actor, range.data);
      rows = [
        ...summary.period.invoiceTotalsByCurrency.map((row) => ({ metric: "invoices_by_issue_date", ...row })),
        ...summary.period.confirmedReceiptsByCurrency.map((row) => ({ metric: "confirmed_receipts_by_payment_date", ...row })),
        ...summary.period.expenseTotalsByCurrency.map((row) => ({ metric: "expenses_by_expense_date", ...row })),
        ...summary.pointInTime.outstandingReceivablesByCurrency.map((row) => ({ metric: "outstanding_receivables_point_in_time", ...row })),
        ...summary.period.cashMovementByCurrency.map((row) => ({ metric: "cash_movement_by_payment_date", ...row })),
      ];
      break;
    }
  }

  const fileName = `finance-${parsed.data.report}-${range.data.fromDate}-${range.data.toDate}.${parsed.data.format}`;
  const body = parsed.data.format === "csv" ? adapter.toCsv(rows) : await adapter.toXlsx(rows);
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
      rowCount: rows.length,
    },
  }));
  return adapter.streamExport({ body, contentType, fileName });
}
