import { z } from "zod";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const financeReportRangeSchema = z.object({
  fromDate: businessDate,
  toDate: businessDate,
}).refine((value) => value.fromDate <= value.toDate, {
  message: "Start date must be on or before end date.",
  path: ["fromDate"],
});
export const receivablesReportSchema = financeReportRangeSchema.extend({
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 100).default(1),
  pageSize: z.number().int().positive().max(100).default(50),
});
export const cashMovementReportSchema = financeReportRangeSchema.extend({
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 100).default(1),
  pageSize: z.number().int().positive().max(100).default(50),
});

export type FinanceReportRange = z.infer<typeof financeReportRangeSchema>;
export type ReceivablesReportInput = z.input<typeof receivablesReportSchema>;
export type CashMovementReportInput = z.input<typeof cashMovementReportSchema>;
