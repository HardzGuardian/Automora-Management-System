import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { withTransaction } from "@/db";
import { expensePayments, expenses } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { beginIdempotentOperation, completeIdempotentOperation } from "@/lib/idempotency/with-idempotency";
import { audit } from "@/modules/audit";
import {
  confirmExpensePaymentSchema,
  expensePaymentDtoSchema,
  recordExpensePaymentSchema,
  reverseExpensePaymentSchema,
  type RecordExpensePaymentInput,
  type ReverseExpensePaymentInput,
} from "./schemas";
import { calcExpenseOutstanding } from "../expenses/balance";
import { calcAvailablePaymentAmount } from "../payments/reservations";

type ExpensePaymentTransaction = Parameters<Parameters<typeof withTransaction>[0]>[0];

export type ExpensePaymentDTO = {
  id: string;
  expenseId: string;
  amount: string;
  paymentDate: string;
  method: RecordExpensePaymentInput["method"];
  reference: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "reversed";
};

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Expense payment input is invalid.", parsed.error.flatten());
  return parsed.data;
}

function toExpensePaymentDTO(value: unknown): ExpensePaymentDTO {
  const parsed = expensePaymentDtoSchema.safeParse(value);
  if (!parsed.success) throw new DomainError("CONFLICT", "Expense payment data could not be returned.");
  return parsed.data;
}

const confirmedExpenseTotal = sql<string>`COALESCE(SUM(CASE WHEN ${expensePayments.status} = 'confirmed' AND ${expensePayments.reversedAt} IS NULL THEN ${expensePayments.amount}::numeric ELSE 0 END), 0)::numeric`;
const pendingExpenseTotal = sql<string>`COALESCE(SUM(CASE WHEN ${expensePayments.status} = 'pending' THEN ${expensePayments.amount}::numeric ELSE 0 END), 0)::numeric`;

async function lockExpense(tx: ExpensePaymentTransaction, companyId: string, expenseId: string) {
  const [expense] = await tx.select({ id: expenses.id, total: expenses.total }).from(expenses)
    .where(and(
      eq(expenses.id, expenseId),
      eq(expenses.companyId, companyId),
      isNull(expenses.archivedAt),
    )).limit(1).for("update");
  if (!expense) throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.");
  return expense;
}

async function getExpensePaymentReservations(tx: ExpensePaymentTransaction, companyId: string, expenseId: string) {
  const [sum] = await tx.select({
    confirmed: confirmedExpenseTotal,
    pending: pendingExpenseTotal,
  }).from(expensePayments).where(and(
    eq(expensePayments.expenseId, expenseId),
    eq(expensePayments.companyId, companyId),
  ));
  return { confirmed: sum?.confirmed ?? "0", pending: sum?.pending ?? "0" };
}

export async function recordExpensePayment(actor: Actor, input: RecordExpensePaymentInput): Promise<ExpensePaymentDTO> {
  requirePermission(actor, "finance.expenses.pay");
  const parsed = parseInput(recordExpensePaymentSchema, input);
  const amount = fromMinor(toMinor(parsed.amount));
  const requestHash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
  return withTransaction(async (tx) => {
    const claim = await beginIdempotentOperation(tx, {
      companyId: actor.companyId,
      key: parsed.idempotencyKey,
      operation: "expensePayment.record",
      requestHash,
    });
    if (claim.replay) return toExpensePaymentDTO(claim.response);

    const expense = await lockExpense(tx, actor.companyId, parsed.expenseId);
    const reservations = await getExpensePaymentReservations(tx, actor.companyId, expense.id);
    const available = calcAvailablePaymentAmount(
      toMinor(expense.total),
      toMinor(reservations.confirmed),
      toMinor(reservations.pending),
    );
    if (toMinor(amount) > available) throw new DomainError("CONFLICT", "Payment exceeds the expense balance available after pending payments.");
    const now = parsed.status === "confirmed" ? new Date() : null;
    const [payment] = await tx.insert(expensePayments).values({
      companyId: actor.companyId,
      expenseId: parsed.expenseId,
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
    }).returning({ id: expensePayments.id });
    if (!payment) throw new DomainError("CONFLICT", "Expense payment could not be recorded.");
    const dto = toExpensePaymentDTO({
      id: payment.id,
      expenseId: parsed.expenseId,
      amount,
      paymentDate: parsed.paymentDate,
      method: parsed.method,
      reference: parsed.reference ?? null,
      notes: parsed.notes ?? null,
      status: parsed.status,
    });
    await completeIdempotentOperation(tx, claim.id, "expense_payment", payment.id, dto);
    await audit.record(tx, {
      actor,
      entity: "expense_payment",
      entityId: payment.id,
      action: "expense_payment.recorded",
      after: { expenseId: parsed.expenseId, amount, paymentDate: parsed.paymentDate, method: parsed.method, status: parsed.status },
    });
    return dto;
  });
}

export async function confirmExpensePayment(actor: Actor, paymentId: string): Promise<ExpensePaymentDTO> {
  requirePermission(actor, "finance.expenses.pay");
  const parsed = parseInput(confirmExpensePaymentSchema, { paymentId });
  return withTransaction(async (tx) => {
    const [preflight] = await tx.select({ expenseId: expensePayments.expenseId }).from(expensePayments).where(and(
      eq(expensePayments.id, parsed.paymentId),
      eq(expensePayments.companyId, actor.companyId),
    )).limit(1);
    if (!preflight) throw new DomainError("EXPENSE_PAYMENT_NOT_FOUND", "Expense payment was not found.");
    const expense = await lockExpense(tx, actor.companyId, preflight.expenseId);
    const [payment] = await tx.select().from(expensePayments).where(and(
      eq(expensePayments.id, parsed.paymentId),
      eq(expensePayments.companyId, actor.companyId),
      eq(expensePayments.expenseId, expense.id),
    )).limit(1).for("update");
    if (!payment) throw new DomainError("EXPENSE_PAYMENT_NOT_FOUND", "Expense payment was not found.");
    if (payment.status !== "pending") throw new DomainError("CONFLICT", "Only pending expense payments can be confirmed.");

    const { confirmed } = await getExpensePaymentReservations(tx, actor.companyId, expense.id);
    const outstanding = calcExpenseOutstanding(toMinor(expense.total), toMinor(confirmed));
    if (toMinor(payment.amount) > outstanding) throw new DomainError("CONFLICT", "Payment would overpay this expense.");

    const now = new Date();
    await tx.update(expensePayments).set({
      status: "confirmed",
      confirmedAt: now,
      confirmedBy: actor.userId,
      updatedAt: now,
      updatedBy: actor.userId,
    }).where(and(eq(expensePayments.id, payment.id), eq(expensePayments.companyId, actor.companyId)));
    await audit.record(tx, {
      actor,
      entity: "expense_payment",
      entityId: payment.id,
      action: "expense_payment.confirmed",
      before: { status: "pending" },
      after: { status: "confirmed", expenseId: expense.id, amount: payment.amount },
    });
    return toExpensePaymentDTO({ ...payment, status: "confirmed" });
  });
}

export async function reverseExpensePayment(actor: Actor, input: ReverseExpensePaymentInput): Promise<ExpensePaymentDTO> {
  requirePermission(actor, "finance.expenses.reverse");
  const parsed = parseInput(reverseExpensePaymentSchema, input);
  return withTransaction(async (tx) => {
    const [preflight] = await tx.select({ expenseId: expensePayments.expenseId }).from(expensePayments).where(and(
      eq(expensePayments.id, parsed.paymentId),
      eq(expensePayments.companyId, actor.companyId),
    )).limit(1);
    if (!preflight) throw new DomainError("EXPENSE_PAYMENT_NOT_FOUND", "Expense payment was not found.");
    const expense = await lockExpense(tx, actor.companyId, preflight.expenseId);
    const [payment] = await tx.select().from(expensePayments).where(and(
      eq(expensePayments.id, parsed.paymentId),
      eq(expensePayments.companyId, actor.companyId),
      eq(expensePayments.expenseId, expense.id),
    )).limit(1).for("update");
    if (!payment) throw new DomainError("EXPENSE_PAYMENT_NOT_FOUND", "Expense payment was not found.");
    if (payment.status !== "confirmed") throw new DomainError("CONFLICT", "Only confirmed expense payments can be reversed.");

    const now = new Date();
    await tx.update(expensePayments).set({
      status: "reversed",
      reversedAt: now,
      reversedBy: actor.userId,
      reverseReason: parsed.reason,
      updatedAt: now,
      updatedBy: actor.userId,
    }).where(and(eq(expensePayments.id, payment.id), eq(expensePayments.companyId, actor.companyId)));
    await audit.record(tx, {
      actor,
      entity: "expense_payment",
      entityId: payment.id,
      action: "expense_payment.reversed",
      before: { status: "confirmed", amount: payment.amount },
      after: { status: "reversed", expenseId: expense.id, reason: parsed.reason },
    });
    return toExpensePaymentDTO({ ...payment, status: "reversed" });
  });
}
