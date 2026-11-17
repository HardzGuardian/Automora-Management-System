import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { invoices, payments } from "@/db/schema";
import { requiresSecondConfirmer } from "@/modules/settings";
import { receiptListSchema, type ReceiptListInput, type ReceiptListQueryInput } from "./schemas";

export type ReceiptListRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  currency: string;
  amount: string;
  paymentDate: string;
  method: "bank_transfer" | "upi" | "cash" | "card" | "other";
  reference: string | null;
  status: "pending" | "confirmed" | "reversed";
};

export type ReceiptListDTO = { rows: ReceiptListRow[]; total: number; page: number; pageSize: number };

function parseInput(input: ReceiptListQueryInput): ReceiptListInput {
  const parsed = receiptListSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Receipt filters are invalid.", parsed.error.flatten());
  return parsed.data;
}

export async function listReceipts(actor: Actor, input: ReceiptListQueryInput = {}): Promise<ReceiptListDTO> {
  requirePermission(actor, "finance.payments.read");
  const filters = parseInput(input);
  const where = [eq(payments.companyId, actor.companyId)];
  if (filters.invoiceId) where.push(eq(payments.invoiceId, filters.invoiceId));
  if (filters.status) where.push(eq(payments.status, filters.status));
  // Client and project belong to the invoice, so these filters go through it.
  if (filters.clientId) where.push(eq(invoices.clientId, filters.clientId));
  if (filters.projectId) where.push(eq(invoices.projectId, filters.projectId));
  const condition = and(...where);
  const [countRow] = await db.select({ value: count() }).from(payments).innerJoin(invoices, and(
    eq(invoices.id, payments.invoiceId),
    eq(invoices.companyId, payments.companyId),
  )).where(condition);
  const rows = await db.select({
    id: payments.id,
    invoiceId: payments.invoiceId,
    invoiceNumber: invoices.invoiceNumber,
    currency: invoices.currency,
    amount: payments.amount,
    paymentDate: payments.paymentDate,
    method: payments.method,
    reference: payments.reference,
    status: payments.status,
  }).from(payments).innerJoin(invoices, and(
    eq(invoices.id, payments.invoiceId),
    eq(invoices.companyId, payments.companyId),
  )).where(condition).orderBy(desc(payments.paymentDate), desc(payments.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return {
    rows: rows.map((row) => ({ ...row, amount: fromMinor(toMinor(row.amount)) })),
    total: countRow?.value ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getReceiptDetail(
  actor: Actor,
  paymentId: string,
): Promise<ReceiptListRow & { notes: string | null; awaitingSecondPerson: boolean }> {
  requirePermission(actor, "finance.payments.read");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
    throw new DomainError("VALIDATION", "Receipt ID is invalid.");
  }
  const [receipt] = await db.select({
    id: payments.id,
    invoiceId: payments.invoiceId,
    invoiceNumber: invoices.invoiceNumber,
    currency: invoices.currency,
    amount: payments.amount,
    paymentDate: payments.paymentDate,
    method: payments.method,
    reference: payments.reference,
    status: payments.status,
    notes: payments.notes,
    createdBy: payments.createdBy,
  }).from(payments).innerJoin(invoices, and(
    eq(invoices.id, payments.invoiceId),
    eq(invoices.companyId, payments.companyId),
  )).where(and(
    eq(payments.id, paymentId),
    eq(payments.companyId, actor.companyId),
  )).limit(1);
  if (!receipt) throw new DomainError("PAYMENT_NOT_FOUND", "Receipt was not found.");
  const { createdBy, ...row } = receipt;
  // Pending, recorded by this user, and the company wants someone else to confirm it.
  const awaitingSecondPerson = row.status === "pending" && createdBy === actor.userId && (await requiresSecondConfirmer(actor.companyId));
  return { ...row, amount: fromMinor(toMinor(row.amount)), awaitingSecondPerson };
}
