import { z } from "zod";

const amount = z.string().max(128).regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => {
  const whole = value.split(".")[0]?.replace(/^0+/, "") || "0";
  return whole.length <= 12;
}, "Amount must fit NUMERIC(14,2).").refine((value) => /[1-9]/.test(value), "Amount must be positive.");
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const createReceiptSchema = z.object({
  invoiceId: z.string().uuid(),
  amount,
  paymentDate: businessDate,
  method: z.enum(["bank_transfer", "upi", "cash", "card", "other"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["pending", "confirmed"]).default("pending"),
  idempotencyKey: z.string().uuid(),
}).superRefine((value, context) => {
  if (value.method !== "cash" && !value.reference) {
    context.addIssue({ code: "custom", path: ["reference"], message: "Reference is required for this payment method." });
  }
});

export const receiptDtoSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount,
  paymentDate: businessDate,
  method: z.enum(["bank_transfer", "upi", "cash", "card", "other"]),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["pending", "confirmed", "reversed"]),
});

export const confirmReceiptSchema = z.object({ paymentId: z.string().uuid() });
export const reverseReceiptSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});
export const receiptListSchema = z.object({
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 100).default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  invoiceId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(["pending", "confirmed", "reversed"]).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ReceiptDTOInput = z.infer<typeof receiptDtoSchema>;
export type ReverseReceiptInput = z.infer<typeof reverseReceiptSchema>;
export type ReceiptListInput = z.infer<typeof receiptListSchema>;
export type ReceiptListQueryInput = z.input<typeof receiptListSchema>;
