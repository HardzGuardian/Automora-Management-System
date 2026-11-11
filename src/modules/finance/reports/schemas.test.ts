import { describe, expect, it } from "vitest";
import { cashMovementReportSchema, financeExportRequestSchema, financeReportRangeSchema, receivablesReportSchema } from "./schemas";

describe("finance report date range", () => {
  it("accepts valid ordered dates", () => {
    expect(financeReportRangeSchema.safeParse({ fromDate: "2026-01-01", toDate: "2026-01-31" }).success).toBe(true);
  });

  it("rejects invalid dates and reversed ranges", () => {
    expect(financeReportRangeSchema.safeParse({ fromDate: "2026-02-30", toDate: "2026-03-01" }).success).toBe(false);
    expect(financeReportRangeSchema.safeParse({ fromDate: "2026-02-01", toDate: "2026-01-01" }).success).toBe(false);
  });

  it("defaults report pagination and caps page size", () => {
    const range = { fromDate: "2026-01-01", toDate: "2026-01-31" };
    expect(receivablesReportSchema.parse(range)).toMatchObject({ page: 1, pageSize: 50 });
    expect(cashMovementReportSchema.safeParse({ ...range, pageSize: 101 }).success).toBe(false);
  });
});

describe("finance export request", () => {
  it("accepts only supported reports and formats with a date range", () => {
    const valid = { report: "receivables", format: "csv", fromDate: "2026-01-01", toDate: "2026-01-31" };
    expect(financeExportRequestSchema.safeParse(valid).success).toBe(true);
    expect(financeExportRequestSchema.safeParse({ ...valid, report: "employees" }).success).toBe(false);
    expect(financeExportRequestSchema.safeParse({ ...valid, format: "pdf" }).success).toBe(false);
  });

  it("rejects malformed or reversed date ranges", () => {
    expect(financeReportRangeSchema.safeParse({ fromDate: "2026-02-30", toDate: "2026-03-01" }).success).toBe(false);
    expect(financeReportRangeSchema.safeParse({ fromDate: "2026-02-01", toDate: "2026-01-01" }).success).toBe(false);
  });
});
