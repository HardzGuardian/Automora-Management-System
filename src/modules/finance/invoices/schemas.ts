import { z } from "zod";

const DECIMAL_TEXT = /^\d+(?:\.\d+)?$/;
const numericText = (precision: number, scale: number) => z.string()
  .max(128)
  .regex(DECIMAL_TEXT)
  .refine((value) => {
    const [integerPart = "", fractionPart = ""] = value.split(".");
    const significantInteger = integerPart.replace(/^0+/, "") || "0";
    return significantInteger.length <= precision - scale && fractionPart.length <= scale;
  }, `Value must fit NUMERIC(${precision},${scale}).`);
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: numericText(14, 4),
  unitPrice: numericText(14, 2),
  discount: numericText(14, 2).default("0"),
  taxRate: numericText(7, 4).default("0"),
});

export const createInvoiceDraftSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  dueDate: businessDate.nullable().optional(),
  idempotencyKey: z.string().uuid(),
  items: z.array(invoiceLineInputSchema).max(100).default([]),
});

export const updateInvoiceDraftSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  dueDate: businessDate.nullable().optional(),
});

export const updateInvoiceLineSchema = invoiceLineInputSchema.extend({
  itemId: z.string().uuid(),
});

export const removeInvoiceLineSchema = z.object({ itemId: z.string().uuid() });

export const invoiceDraftDtoSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  invoiceNumber: z.string().nullable(),
  status: z.literal("draft"),
  dueDate: businessDate.nullable(),
  currency: z.string().length(3),
  subtotal: numericText(14, 2),
  discountTotal: numericText(14, 2),
  taxTotal: numericText(14, 2),
  total: numericText(14, 2),
  items: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    quantity: numericText(14, 4),
    unitPrice: numericText(14, 2),
    discount: numericText(14, 2),
    taxRate: numericText(7, 4),
    subtotal: numericText(14, 2),
    taxAmount: numericText(14, 2),
    lineTotal: numericText(14, 2),
  })).max(100),
});

export type InvoiceLineInputDTO = z.infer<typeof invoiceLineInputSchema>;
export type CreateInvoiceDraftInput = z.infer<typeof createInvoiceDraftSchema>;
export type UpdateInvoiceDraftInput = z.infer<typeof updateInvoiceDraftSchema>;
export type UpdateInvoiceLineInput = z.infer<typeof updateInvoiceLineSchema>;
export type InvoiceDraftDTOInput = z.infer<typeof invoiceDraftDtoSchema>;
