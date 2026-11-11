import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { withTransaction } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { beginIdempotentOperation, completeIdempotentOperation } from "@/lib/idempotency/with-idempotency";
import { audit } from "@/modules/audit";
import { createReceiptSchema, receiptDtoSchema, type CreateReceiptInput } from "./schemas";
import { calcOutstanding } from "../invoices/balance";
import { invoices, paymentAllocations, payments } from "@/db/schema";

export type ReceiptDTO = {
  id: string;
  invoiceId: string;
  amount: string;
  paymentDate: string;
  method: CreateReceiptInput["method"];
  reference: string | null;
  notes: string | null;
  status: "pending" | "confirmed";
};

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Receipt input is invalid.", parsed.error.flatten());
  return parsed.data;
}

const confirmedAllocationTotal = sql<string>`COALESCE(SUM(CASE WHEN ${payments.id} IS NOT NULL THEN ${paymentAllocations.amount}::numeric ELSE 0 END), 0)::numeric`;

export async function recordReceipt(actor: Actor, input: CreateReceiptInput): Promise<ReceiptDTO> {
  requirePermission(actor, "finance.payments.record");
  const parsed = parseInput(createReceiptSchema, input);
  if (parsed.status === "confirmed") requirePermission(actor, "finance.payments.confirm");
  const amountMinor = toMinor(parsed.amount);
  if (amountMinor <= 0) throw new DomainError("VALIDATION", "Receipt amount must be positive.");
  const amount = fromMinor(amountMinor);
  const requestHash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");

  return withTransaction(async (tx) => {
    const claim = await beginIdempotentOperation(tx, {
      companyId: actor.companyId,
      key: parsed.idempotencyKey,
      operation: "payment.recordReceipt",
      requestHash,
    });
    if (claim.replay) return parseInput(receiptDtoSchema, claim.response);

    const invoiceRows = await tx.select({
      id: invoices.id,
      status: invoices.status,
      total: invoices.total,
    }).from(invoices).where(and(
      eq(invoices.id, parsed.invoiceId),
      eq(invoices.companyId, actor.companyId),
    )).limit(1).for("update");
    const currentInvoice = invoiceRows[0];
    if (!currentInvoice) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");
    if (currentInvoice.status !== "issued") {
      throw new DomainError("CONFLICT", "Only issued invoices can receive payments.");
    }

    const [confirmed] = await tx.select({ total: confirmedAllocationTotal })
      .from(paymentAllocations)
      .leftJoin(payments, and(
        eq(payments.id, paymentAllocations.paymentId),
        eq(payments.companyId, paymentAllocations.companyId),
        eq(payments.status, "confirmed"),
        isNull(payments.reversedAt),
      ))
      .where(and(
        eq(paymentAllocations.invoiceId, parsed.invoiceId),
        eq(paymentAllocations.companyId, actor.companyId),
      ));
    const outstandingMinor = calcOutstanding(toMinor(currentInvoice.total), toMinor(confirmed?.total ?? "0"));
    if (parsed.status === "confirmed" && amountMinor > outstandingMinor) {
      throw new DomainError("CONFLICT", "Receipt would overpay the invoice.");
    }

    const now = parsed.status === "confirmed" ? new Date() : null;
    const [payment] = await tx.insert(payments).values({
      companyId: actor.companyId,
      invoiceId: parsed.invoiceId,
      amount,
      paymentDate: parsed.paymentDate,
      method: parsed.method,
      reference: parsed.reference ?? null,
      notes: parsed.notes ?? null,
      status: parsed.status,
      confirmedAt: now,
      confirmedBy: now ? actor.userId : null,
      idempotencyKey: parsed.idempotencyKey,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }).returning({ id: payments.id });
    if (!payment) throw new DomainError("CONFLICT", "Receipt could not be recorded.");

    await tx.insert(paymentAllocations).values({
      companyId: actor.companyId,
      paymentId: payment.id,
      invoiceId: parsed.invoiceId,
      amount,
      createdBy: actor.userId,
    });

    const receipt: ReceiptDTO = {
      id: payment.id,
      invoiceId: parsed.invoiceId,
      amount,
      paymentDate: parsed.paymentDate,
      method: parsed.method,
      reference: parsed.reference ?? null,
      notes: parsed.notes ?? null,
      status: parsed.status,
    };
    await completeIdempotentOperation(tx, claim.id, "payment", payment.id, receipt);
    await audit.record(tx, {
      actor,
      entity: "payment",
      entityId: payment.id,
      action: "payment.recorded",
      after: {
        invoiceId: parsed.invoiceId,
        amount,
        paymentDate: parsed.paymentDate,
        method: parsed.method,
        status: parsed.status,
      },
    });
    return receipt;
  });
}
