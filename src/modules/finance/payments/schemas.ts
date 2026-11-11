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
  status: z.enum(["pending", "confirmed"]),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ReceiptDTOInput = z.infer<typeof receiptDtoSchema>;
